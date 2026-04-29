import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { getCache, setCache, stableCacheKey, TTL } from '../utils/cache';

const router = Router();

const DELIVERED_STATUSES = ['DELIVERED', 'COLLECTED'] as const;
const COLLECTION_STATES = [
  'NOT_COLLECTED',
  'DRIVER_COLLECTED',
  'COMPANY_RECEIVED',
  'SETTLED_TO_MERCHANT',
] as const;

function n(value: unknown) {
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value);
  return 0;
}

function money(value: unknown) {
  return Math.round(n(value) * 100) / 100;
}

function pct(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 1000) / 10 : 0;
}

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function parseDateRange(query: any) {
  const now = new Date();
  let startDate: Date;
  let endDate = endOfDay(query.endDate ? new Date(query.endDate) : now);
  const range = typeof query.range === 'string' ? query.range : 'last30';

  if (query.startDate) {
    startDate = startOfDay(new Date(query.startDate));
  } else if (range === 'today') {
    startDate = startOfDay(now);
  } else if (range === 'last7') {
    startDate = startOfDay(now);
    startDate.setDate(startDate.getDate() - 6);
  } else if (range === 'thisMonth') {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  } else {
    startDate = startOfDay(now);
    startDate.setDate(startDate.getDate() - 29);
  }

  if (endDate < startDate) endDate = endOfDay(startDate);
  return { range, startDate, endDate };
}

function orderDateWhere(range: { startDate: Date; endDate: Date }) {
  return { createdAt: { gte: range.startDate, lte: range.endDate } };
}

function earningDateWhere(range: { startDate: Date; endDate: Date }) {
  return { date: { gte: range.startDate, lte: range.endDate } };
}

// GET /api/analytics/client-dashboard
router.get('/client-dashboard', authenticate, requireRole('CLIENT'), async (req: AuthRequest, res) => {
  try {
    const clientId = req.user!.userId;
    const cacheKey = stableCacheKey('dashboard:client', { userId: clientId });
    const cached = getCache(cacheKey);
    if (cached) return res.json(cached);

    const [statusRows, collectionRows, latestOrders] = await Promise.all([
      prisma.order.groupBy({
        by: ['status'],
        where: { clientId },
        _count: { _all: true },
      }),
      prisma.order.groupBy({
        by: ['collectionStatus'],
        where: { clientId, status: { in: [...DELIVERED_STATUSES] } },
        _sum: { totalPrice: true, itemPrice: true, grandTotal: true },
        _count: { _all: true },
      }),
      prisma.order.findMany({
        where: { clientId },
        select: {
          id: true,
          shipmentNumber: true,
          destination: true,
          recipientName: true,
          status: true,
          collectionStatus: true,
          totalPrice: true,
          itemPrice: true,
          deliveryFee: true,
          addonsTotal: true,
          grandTotal: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    const statusCounts = Object.fromEntries(statusRows.map((row) => [row.status, row._count._all]));
    const collection = Object.fromEntries(COLLECTION_STATES.map((state) => [state, { count: 0, amount: 0, merchantAmount: 0 }])) as Record<string, { count: number; amount: number; merchantAmount: number }>;
    for (const row of collectionRows) {
      collection[row.collectionStatus] = {
        count: row._count._all,
        amount: money(row._sum.grandTotal || row._sum.totalPrice),
        merchantAmount: money(row._sum.itemPrice),
      };
    }

    const payload = {
      summary: {
        totalOrders: statusRows.reduce((sum, row) => sum + row._count._all, 0),
        pendingOrders: statusCounts.PENDING || 0,
        inTransitOrders: (statusCounts.ASSIGNED || 0) + (statusCounts.PICKED_UP || 0) + (statusCounts.IN_TRANSIT || 0),
        deliveredShipments: (statusCounts.DELIVERED || 0) + (statusCounts.COLLECTED || 0),
        pendingCollectionAmount: collection.NOT_COLLECTED.amount,
        amountNotSettledToMerchant: collection.DRIVER_COLLECTED.merchantAmount + collection.COMPANY_RECEIVED.merchantAmount,
        amountSettledToMerchant: collection.SETTLED_TO_MERCHANT.merchantAmount,
      },
      latestOrders,
    };

    return res.json(setCache(cacheKey, payload, TTL.dashboard));
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch client dashboard' });
  }
});

function pagination(query: any) {
  const page = Math.max(parseInt(String(query.page || '1'), 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(String(query.limit || '10'), 10) || 10, 1), 50);
  return { page, limit, skip: (page - 1) * limit };
}

async function buildFinancial(range: { startDate: Date; endDate: Date }) {
  const where = {
    ...orderDateWhere(range),
    status: { in: [...DELIVERED_STATUSES] },
  };

  const [collectionRows, earnings, pendingRefunds, revenue] = await Promise.all([
    prisma.order.groupBy({
      by: ['collectionStatus'],
      where,
      _sum: { totalPrice: true, itemPrice: true, deliveryFee: true, addonsTotal: true, grandTotal: true },
      _count: { _all: true },
    }),
    prisma.driverEarning.aggregate({
      where: earningDateWhere(range),
      _sum: { amount: true, companyProfit: true },
    }),
    prisma.refund.aggregate({
      where: { status: 'PENDING' },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.order.aggregate({
      where: { ...orderDateWhere(range), status: { notIn: ['CANCELLED', 'RETURNED'] } },
      _sum: { totalPrice: true, itemPrice: true, deliveryFee: true, addonsTotal: true, grandTotal: true },
      _count: true,
    }),
  ]);

  const collection = Object.fromEntries(
    COLLECTION_STATES.map((state) => [state, { status: state, count: 0, amount: 0, merchantAmount: 0 }]),
  ) as Record<string, { status: string; count: number; amount: number; merchantAmount: number }>;

  for (const row of collectionRows) {
    collection[row.collectionStatus] = {
      status: row.collectionStatus,
      count: row._count._all,
      amount: money(row._sum.grandTotal || row._sum.totalPrice),
      merchantAmount: money(row._sum.itemPrice),
    };
  }

  const collectedFromCustomers =
    collection.DRIVER_COLLECTED.amount +
    collection.COMPANY_RECEIVED.amount +
    collection.SETTLED_TO_MERCHANT.amount;
  const owedToMerchants = collection.DRIVER_COLLECTED.merchantAmount + collection.COMPANY_RECEIVED.merchantAmount;
  const shippingRevenue = money(revenue._sum.deliveryFee) + money(revenue._sum.addonsTotal);

  return {
    totalRevenue: money(shippingRevenue),
    shippingRevenue: money(shippingRevenue),
    itemValue: money(revenue._sum.itemPrice),
    codTotal: money(revenue._sum.grandTotal || revenue._sum.totalPrice),
    totalOrders: revenue._count,
    totalDriverPayout: money(earnings._sum.amount),
    companyProfit: money(earnings._sum.companyProfit),
    pendingRefunds: { count: pendingRefunds._count, amount: money(pendingRefunds._sum.amount) },
    collection: {
      notCollected: collection.NOT_COLLECTED,
      driverCollected: collection.DRIVER_COLLECTED,
      companyReceived: collection.COMPANY_RECEIVED,
      settledToMerchant: collection.SETTLED_TO_MERCHANT,
    },
    cards: {
      collectedFromCustomers: money(collectedFromCustomers),
      withDrivers: collection.DRIVER_COLLECTED.amount,
      withCompany: collection.COMPANY_RECEIVED.amount,
      settledToMerchants: collection.SETTLED_TO_MERCHANT.merchantAmount,
      owedToMerchants: money(owedToMerchants),
    },
    pipeline: [
      { key: 'NOT_COLLECTED', label: 'Not collected from customer', ...collection.NOT_COLLECTED },
      { key: 'DRIVER_COLLECTED', label: 'With drivers', ...collection.DRIVER_COLLECTED },
      { key: 'COMPANY_RECEIVED', label: 'With company', ...collection.COMPANY_RECEIVED },
      { key: 'SETTLED_TO_MERCHANT', label: 'Settled to merchants', ...collection.SETTLED_TO_MERCHANT },
    ],
  };
}

async function buildMerchantAnalytics(range: { startDate: Date; endDate: Date }, page: number, limit: number, skip: number) {
  const [total, rows] = await Promise.all([
    prisma.user.count({ where: { role: 'CLIENT' } }),
    prisma.$queryRaw<any[]>`
      SELECT
        u.id,
        u.name,
        u.email,
        u.phone,
        COUNT(o.id)::int AS "totalOrders",
        COALESCE(SUM(COALESCE(o."deliveryFee", 0) + COALESCE(o."addonsTotal", 0)) FILTER (WHERE o.status::text NOT IN ('CANCELLED', 'RETURNED')), 0)::float AS "totalRevenue",
        COALESCE(SUM(o."itemPrice") FILTER (WHERE o.status::text NOT IN ('CANCELLED', 'RETURNED')), 0)::float AS "itemValue",
        COALESCE(SUM(COALESCE(o."grandTotal", o."totalPrice", 0)) FILTER (WHERE o."collectionStatus"::text IN ('DRIVER_COLLECTED', 'COMPANY_RECEIVED', 'SETTLED_TO_MERCHANT')), 0)::float AS "collectedFromCustomers",
        COALESCE(SUM(COALESCE(o."grandTotal", o."totalPrice", 0)) FILTER (WHERE o.status::text IN ('DELIVERED', 'COLLECTED') AND o."collectionStatus"::text = 'NOT_COLLECTED'), 0)::float AS "notCollected",
        COALESCE(SUM(o."itemPrice") FILTER (WHERE o."collectionStatus"::text IN ('DRIVER_COLLECTED', 'COMPANY_RECEIVED')), 0)::float AS "owedToMerchant",
        COALESCE(SUM(o."itemPrice") FILTER (WHERE o."collectionStatus"::text = 'SETTLED_TO_MERCHANT'), 0)::float AS "settledToMerchant",
        COUNT(o.id) FILTER (WHERE o.status::text IN ('DELIVERED', 'COLLECTED'))::int AS "deliveredOrders",
        COUNT(o.id) FILTER (WHERE o.status::text = 'CANCELLED')::int AS "cancelledOrders",
        COUNT(o.id) FILTER (WHERE o.status::text = 'RETURNED')::int AS "returnedOrders"
      FROM "users" u
      LEFT JOIN "orders" o
        ON o."clientId" = u.id
       AND o."createdAt" >= ${range.startDate}
       AND o."createdAt" <= ${range.endDate}
      WHERE u.role::text = 'CLIENT'
      GROUP BY u.id
      ORDER BY "owedToMerchant" DESC, "totalOrders" DESC, u.name ASC
      LIMIT ${limit} OFFSET ${skip}
    `,
  ]);

  const merchantIds = rows.map((row) => row.id);
  const [zoneGroups, typeGroups, zones] = merchantIds.length
    ? await Promise.all([
        prisma.order.groupBy({
          by: ['clientId', 'zoneId'],
          where: { clientId: { in: merchantIds }, ...orderDateWhere(range) },
          _count: { _all: true },
          _sum: { deliveryFee: true, addonsTotal: true },
        }),
        prisma.order.groupBy({
          by: ['clientId', 'deliveryType'],
          where: { clientId: { in: merchantIds }, ...orderDateWhere(range) },
          _count: { _all: true },
          _sum: { deliveryFee: true, addonsTotal: true },
        }),
        prisma.zone.findMany({ select: { id: true, name: true } }),
      ])
    : [[], [], []];

  const zoneNames = new Map(zones.map((zone) => [zone.id, zone.name]));
  const byZone = new Map<string, any[]>();
  const byType = new Map<string, any[]>();

  for (const row of zoneGroups) {
    if (!byZone.has(row.clientId)) byZone.set(row.clientId, []);
    byZone.get(row.clientId)!.push({
      zoneId: row.zoneId,
      zone: row.zoneId ? zoneNames.get(row.zoneId) || 'Unknown' : 'Unassigned',
      count: row._count._all,
      revenue: money(row._sum.deliveryFee) + money(row._sum.addonsTotal),
    });
  }

  for (const row of typeGroups) {
    if (!byType.has(row.clientId)) byType.set(row.clientId, []);
    byType.get(row.clientId)!.push({
      deliveryType: row.deliveryType,
      count: row._count._all,
      revenue: money(row._sum.deliveryFee) + money(row._sum.addonsTotal),
    });
  }

  const merchants = rows.map((row) => {
    const totalOrders = n(row.totalOrders);
    const cancelledOrders = n(row.cancelledOrders);
    const returnedOrders = n(row.returnedOrders);
    const deliveredOrders = n(row.deliveredOrders);
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      totalOrders,
      totalRevenue: money(row.totalRevenue),
      itemValue: money(row.itemValue),
      collectedFromCustomers: money(row.collectedFromCustomers),
      notCollected: money(row.notCollected),
      owedToMerchant: money(row.owedToMerchant),
      settledToMerchant: money(row.settledToMerchant),
      successRate: pct(deliveredOrders, totalOrders),
      cancellationRate: pct(cancelledOrders, totalOrders),
      returnRate: pct(returnedOrders, totalOrders),
      ordersByZone: byZone.get(row.id) || [],
      ordersByDeliveryType: byType.get(row.id) || [],
    };
  });

  return {
    merchants,
    pagination: { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) },
  };
}

async function buildDriverAnalytics(range: { startDate: Date; endDate: Date }, page: number, limit: number, skip: number) {
  const [total, rows, timeSeries] = await Promise.all([
    prisma.user.count({ where: { role: 'DRIVER' } }),
    prisma.$queryRaw<any[]>`
      SELECT
        u.id,
        u.name,
        u.email,
        u.phone,
        COUNT(o.id)::int AS "assignedShipments",
        COUNT(o.id) FILTER (WHERE o.status::text IN ('DELIVERED', 'COLLECTED'))::int AS "deliveredShipments",
        COUNT(o.id) FILTER (WHERE o.status::text = 'CANCELLED')::int AS "cancelledShipments",
        COUNT(o.id) FILTER (WHERE o.status::text = 'RETURNED')::int AS "returnedShipments",
        COALESCE(AVG(EXTRACT(EPOCH FROM (o."updatedAt" - o."createdAt")) / 3600) FILTER (WHERE o.status::text IN ('DELIVERED', 'COLLECTED')), 0)::float AS "avgDeliveryHours",
        COALESCE(SUM(de.amount), 0)::float AS "earnings",
        COALESCE(SUM(COALESCE(o."grandTotal", o."totalPrice", 0)) FILTER (WHERE o."collectionStatus"::text IN ('DRIVER_COLLECTED', 'COMPANY_RECEIVED', 'SETTLED_TO_MERCHANT')), 0)::float AS "cashCollected",
        COALESCE(SUM(COALESCE(o."grandTotal", o."totalPrice", 0)) FILTER (WHERE o.status::text IN ('DELIVERED', 'COLLECTED') AND o."collectionStatus"::text = 'NOT_COLLECTED'), 0)::float AS "cashNotCollected"
      FROM "users" u
      LEFT JOIN "orders" o
        ON o."driverId" = u.id
       AND o."createdAt" >= ${range.startDate}
       AND o."createdAt" <= ${range.endDate}
      LEFT JOIN "driver_earnings" de ON de."orderId" = o.id
      WHERE u.role::text = 'DRIVER'
      GROUP BY u.id
      ORDER BY "deliveredShipments" DESC, "assignedShipments" DESC, u.name ASC
      LIMIT ${limit} OFFSET ${skip}
    `,
    prisma.$queryRaw<any[]>`
      SELECT
        to_char(date_trunc('day', o."createdAt"), 'YYYY-MM-DD') AS "date",
        u.id AS "driverId",
        u.name AS "driver",
        COUNT(o.id) FILTER (WHERE o.status::text IN ('DELIVERED', 'COLLECTED'))::int AS "delivered",
        COALESCE(SUM(de.amount), 0)::float AS "earnings"
      FROM "users" u
      JOIN "orders" o ON o."driverId" = u.id
      LEFT JOIN "driver_earnings" de ON de."orderId" = o.id
      WHERE u.role::text = 'DRIVER'
        AND o."createdAt" >= ${range.startDate}
        AND o."createdAt" <= ${range.endDate}
      GROUP BY 1, u.id
      ORDER BY 1 ASC, "delivered" DESC
    `,
  ]);

  const drivers = rows.map((row) => {
    const assignedShipments = n(row.assignedShipments);
    const deliveredShipments = n(row.deliveredShipments);
    const cancelledShipments = n(row.cancelledShipments);
    const returnedShipments = n(row.returnedShipments);
    const cancellationRate = pct(cancelledShipments, assignedShipments);
    const returnRate = pct(returnedShipments, assignedShipments);
    const alerts = [
      cancellationRate >= 25 ? 'High cancellation rate' : null,
      returnRate >= 20 ? 'High return rate' : null,
      n(row.avgDeliveryHours) >= 72 ? 'Delayed delivery average' : null,
    ].filter(Boolean);

    return {
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      assignedShipments,
      deliveredShipments,
      cancelledShipments,
      returnedShipments,
      successRate: pct(deliveredShipments, assignedShipments),
      cancellationRate,
      returnRate,
      avgDeliveryHours: Math.round(n(row.avgDeliveryHours) * 10) / 10,
      earnings: money(row.earnings),
      cashCollected: money(row.cashCollected),
      cashNotCollected: money(row.cashNotCollected),
      alerts,
    };
  });

  return {
    drivers,
    performanceOverTime: timeSeries.map((row) => ({
      date: row.date,
      driverId: row.driverId,
      driver: row.driver,
      delivered: n(row.delivered),
      earnings: money(row.earnings),
    })),
    pagination: { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) },
  };
}

async function buildOrderAnalytics(range: { startDate: Date; endDate: Date }) {
  const where = orderDateWhere(range);
  const [
    statusRows,
    deliveryRows,
    revenueByDay,
    statusTrend,
    cancellationReturnTrend,
    revenueByZoneRows,
    funnelCounts,
    profit,
  ] = await Promise.all([
    prisma.order.groupBy({ by: ['status'], where, _count: { _all: true } }),
    prisma.order.groupBy({ by: ['deliveryType'], where, _count: { _all: true } }),
    prisma.$queryRaw<any[]>`
      SELECT
        to_char(date_trunc('day', "createdAt"), 'YYYY-MM-DD') AS "date",
        COALESCE(SUM(COALESCE("deliveryFee", 0) + COALESCE("addonsTotal", 0)) FILTER (WHERE status::text NOT IN ('CANCELLED', 'RETURNED')), 0)::float AS "revenue",
        COUNT(id)::int AS "orders"
      FROM "orders"
      WHERE "createdAt" >= ${range.startDate}
        AND "createdAt" <= ${range.endDate}
      GROUP BY 1
      ORDER BY 1 ASC
    `,
    prisma.$queryRaw<any[]>`
      SELECT
        to_char(date_trunc('day', "createdAt"), 'YYYY-MM-DD') AS "date",
        status::text AS "status",
        COUNT(id)::int AS "count"
      FROM "orders"
      WHERE "createdAt" >= ${range.startDate}
        AND "createdAt" <= ${range.endDate}
      GROUP BY 1, 2
      ORDER BY 1 ASC
    `,
    prisma.$queryRaw<any[]>`
      SELECT
        to_char(date_trunc('day', "createdAt"), 'YYYY-MM-DD') AS "date",
        COUNT(id) FILTER (WHERE status::text = 'CANCELLED')::int AS "cancelled",
        COUNT(id) FILTER (WHERE status::text = 'RETURNED')::int AS "returned"
      FROM "orders"
      WHERE "createdAt" >= ${range.startDate}
        AND "createdAt" <= ${range.endDate}
      GROUP BY 1
      ORDER BY 1 ASC
    `,
    prisma.$queryRaw<any[]>`
      SELECT
        COALESCE(z.name, 'Unassigned') AS "zone",
        COUNT(o.id)::int AS "orders",
        COALESCE(SUM(COALESCE(o."deliveryFee", 0) + COALESCE(o."addonsTotal", 0)) FILTER (WHERE o.status::text NOT IN ('CANCELLED', 'RETURNED')), 0)::float AS "revenue"
      FROM "orders" o
      LEFT JOIN "zones" z ON z.id = o."zoneId"
      WHERE o."createdAt" >= ${range.startDate}
        AND o."createdAt" <= ${range.endDate}
      GROUP BY z.name
      ORDER BY "revenue" DESC
      LIMIT 12
    `,
    Promise.all([
      prisma.order.count({ where }),
      prisma.order.count({ where: { ...where, status: { in: ['ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', ...DELIVERED_STATUSES] } } }),
      prisma.order.count({ where: { ...where, status: { in: ['PICKED_UP', 'IN_TRANSIT', ...DELIVERED_STATUSES] } } }),
      prisma.order.count({ where: { ...where, status: { in: ['IN_TRANSIT', ...DELIVERED_STATUSES] } } }),
      prisma.order.count({ where: { ...where, status: { in: [...DELIVERED_STATUSES] } } }),
    ]),
    prisma.driverEarning.aggregate({
      where: earningDateWhere(range),
      _avg: { companyProfit: true, amount: true },
      _sum: { companyProfit: true, amount: true },
    }),
  ]);

  const [created, assigned, pickedUp, inTransit, delivered] = funnelCounts;

  return {
    ordersByStatus: statusRows.map((row) => ({ status: row.status, count: row._count._all })),
    ordersByType: deliveryRows.map((row) => ({ type: row.deliveryType, count: row._count._all })),
    revenueByDay: revenueByDay.map((row) => ({ date: row.date, revenue: money(row.revenue), orders: n(row.orders) })),
    statusTrend: statusTrend.map((row) => ({ date: row.date, status: row.status, count: n(row.count) })),
    cancellationReturnTrend: cancellationReturnTrend.map((row) => ({
      date: row.date,
      cancelled: n(row.cancelled),
      returned: n(row.returned),
    })),
    revenueByZone: revenueByZoneRows.map((row) => ({
      zone: row.zone,
      orders: n(row.orders),
      revenue: money(row.revenue),
    })),
    deliveryFunnel: [
      { stage: 'Created', count: created },
      { stage: 'Assigned', count: assigned },
      { stage: 'Picked Up', count: pickedUp },
      { stage: 'In Transit', count: inTransit },
      { stage: 'Delivered', count: delivered },
    ],
    profit: {
      totalCompanyProfit: money(profit._sum.companyProfit),
      totalDriverPayout: money(profit._sum.amount),
      avgCompanyProfitPerOrder: money(profit._avg.companyProfit),
      avgDriverPayoutPerOrder: money(profit._avg.amount),
    },
  };
}

async function buildBI(query: any) {
  const range = parseDateRange(query);
  const { page, limit, skip } = pagination(query);

  const [financial, merchantAnalytics, driverAnalytics, orderAnalytics, userCounts] = await Promise.all([
    buildFinancial(range),
    buildMerchantAnalytics(range, page, limit, skip),
    buildDriverAnalytics(range, page, limit, skip),
    buildOrderAnalytics(range),
    prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
  ]);

  const userCountMap = Object.fromEntries(userCounts.map((row) => [row.role, row._count._all]));
  const totalOrders = orderAnalytics.ordersByStatus.reduce((sum, row) => sum + row.count, 0);
  const pendingOrders = orderAnalytics.ordersByStatus.find((row) => row.status === 'PENDING')?.count || 0;
  const deliveredOrders = orderAnalytics.ordersByStatus
    .filter((row) => DELIVERED_STATUSES.includes(row.status as any))
    .reduce((sum, row) => sum + row.count, 0);
  const cancelledOrders = orderAnalytics.ordersByStatus.find((row) => row.status === 'CANCELLED')?.count || 0;
  const returnedOrders = orderAnalytics.ordersByStatus.find((row) => row.status === 'RETURNED')?.count || 0;

  return {
    filters: {
      range: range.range,
      startDate: range.startDate.toISOString(),
      endDate: range.endDate.toISOString(),
      page,
      limit,
    },
    summary: {
      totalOrders,
      pendingOrders,
      deliveredOrders,
      cancelledOrders,
      returnedOrders,
      totalClients: userCountMap.CLIENT || 0,
      totalDrivers: userCountMap.DRIVER || 0,
      totalAdmins: userCountMap.ADMIN || 0,
      totalRevenue: financial.totalRevenue,
      shippingRevenue: financial.shippingRevenue,
      itemValue: financial.itemValue,
      codTotal: financial.codTotal,
      owedToMerchants: financial.cards.owedToMerchants,
      settledToMerchants: financial.cards.settledToMerchants,
    },
    financial,
    merchantAnalytics,
    driverAnalytics,
    orderAnalytics,
  };
}

router.get('/bi', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res) => {
  try {
    const range = parseDateRange(req.query);
    const { page, limit } = pagination(req.query);
    const cacheKey = stableCacheKey('analytics:bi', {
      role: req.user?.role,
      userId: req.user?.userId,
      range: range.range,
      startDate: range.startDate.toISOString(),
      endDate: range.endDate.toISOString(),
      page,
      limit,
    });
    const cached = getCache(cacheKey);
    if (cached) return res.json(cached);

    const data = await buildBI({ ...req.query, page, limit });
    return res.json(setCache(cacheKey, data, TTL.analytics));
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch BI analytics' });
  }
});

// GET /api/analytics/dashboard
router.get('/dashboard', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res) => {
  try {
    const cacheKey = stableCacheKey('dashboard:admin', {
      role: req.user?.role,
      userId: req.user?.userId,
    });
    const cached = getCache(cacheKey);
    if (cached) return res.json(cached);

    const now = new Date();
    const todayStart = startOfDay(now);
    const weekStart = startOfDay(now);
    weekStart.setDate(weekStart.getDate() - 6);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalOrders,
      pendingOrders,
      deliveredOrders,
      cancelledOrders,
      returnedOrders,
      revenueToday,
      revenueWeek,
      revenueMonth,
      totalClients,
      totalDrivers,
      activeDrivers,
      financial,
    ] = await Promise.all([
      prisma.order.count(),
      prisma.order.count({ where: { status: 'PENDING' } }),
      prisma.order.count({ where: { status: { in: [...DELIVERED_STATUSES] } } }),
      prisma.order.count({ where: { status: 'CANCELLED' } }),
      prisma.order.count({ where: { status: 'RETURNED' } }),
      prisma.order.aggregate({ where: { createdAt: { gte: todayStart }, status: { notIn: ['CANCELLED', 'RETURNED'] } }, _sum: { deliveryFee: true, addonsTotal: true } }),
      prisma.order.aggregate({ where: { createdAt: { gte: weekStart }, status: { notIn: ['CANCELLED', 'RETURNED'] } }, _sum: { deliveryFee: true, addonsTotal: true } }),
      prisma.order.aggregate({ where: { createdAt: { gte: monthStart }, status: { notIn: ['CANCELLED', 'RETURNED'] } }, _sum: { deliveryFee: true, addonsTotal: true } }),
      prisma.user.count({ where: { role: 'CLIENT', isActive: true } }),
      prisma.user.count({ where: { role: 'DRIVER' } }),
      prisma.user.count({ where: { role: 'DRIVER', isActive: true } }),
      buildFinancial({ startDate: monthStart, endDate: endOfDay(now) }),
    ]);

    return res.json(setCache(cacheKey, {
      totalOrders,
      pendingOrders,
      deliveredOrders,
      cancelledOrders,
      returnedOrders,
      revenueToday: money(revenueToday._sum.deliveryFee) + money(revenueToday._sum.addonsTotal),
      revenueWeek: money(revenueWeek._sum.deliveryFee) + money(revenueWeek._sum.addonsTotal),
      revenueMonth: money(revenueMonth._sum.deliveryFee) + money(revenueMonth._sum.addonsTotal),
      totalClients,
      totalDrivers,
      activeDrivers,
      financial: financial.collection,
      owedToMerchants: financial.cards.owedToMerchants,
    }, TTL.dashboard));
  } catch {
    return res.status(500).json({ error: 'Failed to fetch dashboard analytics' });
  }
});

// GET /api/analytics/charts
router.get('/charts', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res) => {
  try {
    const range = parseDateRange(req.query);
    const cacheKey = stableCacheKey('analytics:charts', {
      role: req.user?.role,
      userId: req.user?.userId,
      range: range.range,
      startDate: range.startDate.toISOString(),
      endDate: range.endDate.toISOString(),
    });
    const cached = getCache(cacheKey);
    if (cached) return res.json(cached);

    const [orders, drivers] = await Promise.all([
      buildOrderAnalytics(range),
      buildDriverAnalytics(range, 1, 5, 0),
    ]);

    return res.json(setCache(cacheKey, {
      revenueByDay: orders.revenueByDay,
      ordersByStatus: orders.ordersByStatus,
      ordersByType: orders.ordersByType,
      collectionByStatus: (await buildFinancial(range)).pipeline.map((item) => ({ status: item.key, count: item.count })),
      topDrivers: drivers.drivers.slice(0, 5).map((driver) => ({
        id: driver.id,
        name: driver.name,
        deliveries: driver.deliveredShipments,
        earnings: driver.earnings,
        revenue: driver.cashCollected + driver.cashNotCollected,
      })),
      statusTrend: orders.statusTrend,
      revenueByZone: orders.revenueByZone,
    }, TTL.analytics));
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch chart analytics' });
  }
});

// GET /api/analytics/financial
router.get('/financial', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res) => {
  try {
    const range = parseDateRange(req.query);
    const cacheKey = stableCacheKey('analytics:financial', {
      role: req.user?.role,
      userId: req.user?.userId,
      range: range.range,
      startDate: range.startDate.toISOString(),
      endDate: range.endDate.toISOString(),
    });
    const cached = getCache(cacheKey);
    if (cached) return res.json(cached);

    const financial = await buildFinancial(range);
    return res.json(setCache(cacheKey, financial, TTL.analytics));
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch financial report' });
  }
});

// GET /api/analytics/driver/:id
router.get('/driver/:id', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const range = parseDateRange(req.query);
    const driverId = req.params.id;
    const [driver, orders, earnings] = await Promise.all([
      prisma.user.findUnique({ where: { id: driverId }, select: { id: true, name: true, phone: true, commissionType: true, commissionValue: true } }),
      prisma.order.findMany({
        where: { driverId, ...orderDateWhere(range) },
        select: {
          id: true,
          shipmentNumber: true,
          status: true,
          totalPrice: true,
          itemPrice: true,
          deliveryFee: true,
          addonsTotal: true,
          grandTotal: true,
          deliveryType: true,
          createdAt: true,
          updatedAt: true,
          collectionStatus: true,
          cancellationReason: true,
          returnReason: true,
          zone: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      prisma.driverEarning.aggregate({
        where: { driverId, ...earningDateWhere(range) },
        _sum: { amount: true, companyProfit: true, orderTotal: true },
      }),
    ]);

    if (!driver) return res.status(404).json({ error: 'Driver not found' });
    const delivered = orders.filter((o) => DELIVERED_STATUSES.includes(o.status as any)).length;
    const cancelled = orders.filter((o) => o.status === 'CANCELLED').length;
    const returned = orders.filter((o) => o.status === 'RETURNED').length;

    return res.json({
      driver,
      summary: {
        totalOrders: orders.length,
        delivered,
        cancelled,
        returned,
        active: orders.filter((o) => ['ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'].includes(o.status)).length,
        totalRevenue: money(earnings._sum.orderTotal),
        totalEarnings: money(earnings._sum.amount),
        totalCompanyProfit: money(earnings._sum.companyProfit),
        successRate: pct(delivered, orders.length),
      },
      orders,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch driver report' });
  }
});

// GET /api/analytics/client/:id
router.get('/client/:id', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const range = parseDateRange(req.query);
    const clientId = req.params.id;
    const [client, orders] = await Promise.all([
      prisma.user.findUnique({ where: { id: clientId }, select: { id: true, name: true, email: true, phone: true, createdAt: true } }),
      prisma.order.findMany({
        where: { clientId, ...orderDateWhere(range) },
        select: {
          id: true,
          shipmentNumber: true,
          status: true,
          totalPrice: true,
          itemPrice: true,
          deliveryFee: true,
          addonsTotal: true,
          grandTotal: true,
          deliveryType: true,
          createdAt: true,
          collectionStatus: true,
          cancellationReason: true,
          returnReason: true,
          zone: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    ]);

    if (!client) return res.status(404).json({ error: 'Client not found' });
    const delivered = orders.filter((o) => DELIVERED_STATUSES.includes(o.status as any)).length;
    const cancelled = orders.filter((o) => o.status === 'CANCELLED').length;
    const returned = orders.filter((o) => o.status === 'RETURNED').length;
    const notCollected = orders
      .filter((o) => DELIVERED_STATUSES.includes(o.status as any) && o.collectionStatus === 'NOT_COLLECTED')
      .reduce((sum, o) => sum + (o.grandTotal || o.totalPrice), 0);
    const unsettled = orders
      .filter((o) => ['DRIVER_COLLECTED', 'COMPANY_RECEIVED'].includes(o.collectionStatus))
      .reduce((sum, o) => sum + o.itemPrice, 0);
    const settled = orders
      .filter((o) => o.collectionStatus === 'SETTLED_TO_MERCHANT')
      .reduce((sum, o) => sum + o.itemPrice, 0);

    return res.json({
      client,
      summary: {
        totalOrders: orders.length,
        delivered,
        cancelled,
        returned,
        active: orders.filter((o) => ['PENDING', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'].includes(o.status)).length,
        pendingCollectionAmount: money(notCollected),
        amountNotSettledToMerchant: money(unsettled),
        settledAmount: money(settled),
        successRate: pct(delivered, orders.length),
      },
      orders,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch client report' });
  }
});

export default router;
