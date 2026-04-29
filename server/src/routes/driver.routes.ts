import { Router } from 'express';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';

const router = Router();

// GET /api/driver/earnings
router.get('/earnings', authenticate, requireRole('DRIVER'), async (req: AuthRequest, res) => {
  try {
    const driverId = req.user!.userId;
    const period = typeof req.query.period === 'string' ? req.query.period : undefined;
    const page  = Math.max(parseInt((req.query.page  as string) || '1',  10) || 1, 1);
    const limit = Math.min(Math.max(parseInt((req.query.limit as string) || '20', 10) || 20, 1), 100);
    const skip  = (page - 1) * limit;

    const now = new Date();
    let startDate: Date | undefined;

    if (period === 'day') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (period === 'week') {
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
    } else if (period === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const where: any = { driverId };
    if (startDate) where.date = { gte: startDate };

    const [total, earnings, totals, byDayRows] = await prisma.$transaction([
      prisma.driverEarning.count({ where }),
      prisma.driverEarning.findMany({
        where,
        select: {
          id: true,
          amount: true,
          orderTotal: true,
          companyProfit: true,
          commissionType: true,
          commissionValue: true,
          date: true,
          order: {
            select: {
              id: true,
              shipmentNumber: true,
              destination: true,
              status: true,
              collectionStatus: true,
              client: { select: { name: true } },
              zone: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { date: 'desc' },
        skip,
        take: limit,
      }),
      prisma.driverEarning.aggregate({
        where,
        _sum: { amount: true, orderTotal: true, companyProfit: true },
        _count: true,
        _avg: { amount: true },
      }),
      prisma.driverEarning.groupBy({
        by: ['date'],
        where,
        _sum: { amount: true, orderTotal: true },
        orderBy: { date: 'asc' },
      }),
    ]);

    const totalDriverEarning  = totals._sum.amount || 0;
    const totalOrderValue     = totals._sum.orderTotal || 0;
    const totalCompanyProfit  = totals._sum.companyProfit || 0;
    const deliveriesCount     = totals._count;
    const averageEarning      = totals._avg.amount || 0;

    // Group by day for chart using stable YYYY-MM-DD keys.
    const byDayMap = byDayRows.reduce((acc: Record<string, { driverEarning: number; orderTotal: number }>, e) => {
      const day = new Date(e.date).toISOString().slice(0, 10);
      if (!acc[day]) acc[day] = { driverEarning: 0, orderTotal: 0 };
      acc[day].driverEarning += e._sum?.amount || 0;
      acc[day].orderTotal    += e._sum?.orderTotal || 0;
      return acc;
    }, {});

    const byDay = Object.entries(byDayMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, driverEarning: v.driverEarning, orderTotal: v.orderTotal }));

    const bestDay = byDay.reduce<{ date: string; driverEarning: number } | null>((best, item) => {
      if (!best || item.driverEarning > best.driverEarning) return item;
      return best;
    }, null);

    return res.json({
      earnings,
      total: Math.round(totalDriverEarning * 100) / 100,
      byDay,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1),
      },
      summary: {
        deliveriesCount,
        totalOrderValue:    Math.round(totalOrderValue    * 100) / 100,
        totalDriverEarning: Math.round(totalDriverEarning * 100) / 100,
        totalCompanyProfit: Math.round(totalCompanyProfit * 100) / 100,
        averageEarning:     Math.round(averageEarning     * 100) / 100,
        bestDay,
      },
    });
  } catch {
    return res.status(500).json({ error: 'Failed to fetch earnings' });
  }
});

// GET /api/driver/stats
router.get('/stats', authenticate, requireRole('DRIVER'), async (req: AuthRequest, res) => {
  try {
    const driverId = req.user!.userId;

    const [
      totalDeliveries,
      pendingDeliveries,
      deliveredOrders,
      cashCollected,
      cashNotCollected,
      totalEarnings,
    ] = await Promise.all([
      prisma.order.count({ where: { driverId, status: { in: ['DELIVERED', 'COLLECTED'] } } }),
      prisma.order.count({ where: { driverId, status: { in: ['ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'] } } }),
      prisma.order.count({ where: { driverId, status: { in: ['DELIVERED', 'COLLECTED'] } } }),
      prisma.order.aggregate({
        where: { driverId, collectionStatus: { in: ['DRIVER_COLLECTED', 'COMPANY_RECEIVED', 'SETTLED_TO_MERCHANT'] } },
        _sum: { totalPrice: true, grandTotal: true },
        _count: true,
      }),
      prisma.order.aggregate({
        where: { driverId, status: { in: ['DELIVERED', 'COLLECTED'] }, collectionStatus: 'NOT_COLLECTED' },
        _sum: { totalPrice: true, grandTotal: true },
        _count: true,
      }),
      prisma.driverEarning.aggregate({ where: { driverId }, _sum: { amount: true } }),
    ]);

    return res.json({
      totalDeliveries,
      pendingDeliveries,
      deliveredOrders,
      cashCollected: {
        count: cashCollected._count,
        amount: cashCollected._sum.grandTotal || cashCollected._sum.totalPrice || 0,
      },
      cashNotCollected: {
        count: cashNotCollected._count,
        amount: cashNotCollected._sum.grandTotal || cashNotCollected._sum.totalPrice || 0,
      },
      totalEarnings: totalEarnings._sum.amount || 0,
    });
  } catch {
    return res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;
