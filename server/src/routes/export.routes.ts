import { Router } from 'express';
import ExcelJS from 'exceljs';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';

const router = Router();
const MAX_EXPORT_ROWS = 5000;

const STATUS_FILLS: Record<string, string> = {
  DELIVERED: 'C6EFCE',
  COLLECTED: 'C6EFCE',
  PENDING: 'FFEB9C',
  ASSIGNED: 'FFEB9C',
  PICKED_UP: 'D9EAD3',
  IN_TRANSIT: 'D9EAD3',
  CANCELLED: 'FFC7CE',
  RETURNED: 'FCE4D6',
};

function money(value?: number | null) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function parseDate(value: unknown) {
  if (!value || typeof value !== 'string') return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function dateRangeFromQuery(query: any) {
  const now = new Date();
  const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (query.range === 'today') return { startDate: startOfDay(now), endDate: now };
  if (query.range === 'last7') {
    const startDate = startOfDay(now);
    startDate.setDate(startDate.getDate() - 6);
    return { startDate, endDate: now };
  }
  if (query.range === 'last30') {
    const startDate = startOfDay(now);
    startDate.setDate(startDate.getDate() - 29);
    return { startDate, endDate: now };
  }
  if (query.range === 'thisMonth') return { startDate: new Date(now.getFullYear(), now.getMonth(), 1), endDate: now };
  return { startDate: undefined, endDate: undefined };
}

function orderWhere(query: any) {
  const where: any = {};
  if (query.status) where.status = query.status;
  if (query.clientId) where.clientId = query.clientId;
  if (query.driverId) where.driverId = query.driverId;
  if (query.collectionStatus) where.collectionStatus = query.collectionStatus;

  const ranged = dateRangeFromQuery(query);
  const startDate = parseDate(query.startDate) || ranged.startDate;
  const endDate = parseDate(query.endDate) || ranged.endDate;
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = startDate;
    if (endDate) {
      const inclusiveEnd = new Date(endDate);
      inclusiveEnd.setHours(23, 59, 59, 999);
      where.createdAt.lte = inclusiveEnd;
    }
  }
  if (query.search && typeof query.search === 'string' && query.search.trim()) {
    const q = query.search.trim();
    where.OR = [
      { shipmentNumber: { contains: q, mode: 'insensitive' } },
      { recipientName: { contains: q, mode: 'insensitive' } },
      { recipientPhone: { contains: q, mode: 'insensitive' } },
      { destination: { contains: q, mode: 'insensitive' } },
      { pickupAddress: { contains: q, mode: 'insensitive' } },
      { client: { name: { contains: q, mode: 'insensitive' } } },
      { driver: { name: { contains: q, mode: 'insensitive' } } },
    ];
  }
  return where;
}

function setupWorksheet(worksheet: ExcelJS.Worksheet, title: string, headers: string[]) {
  worksheet.addRow([title]);
  worksheet.mergeCells(1, 1, 1, headers.length);
  const titleCell = worksheet.getCell(1, 1);
  titleCell.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF111827' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  worksheet.getRow(1).height = 24;

  const headerRow = worksheet.addRow(headers);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    };
  });
  worksheet.views = [{ state: 'frozen', ySplit: 2 }];
  worksheet.autoFilter = {
    from: { row: 2, column: 1 },
    to: { row: 2, column: headers.length },
  };
}

function autoWidth(worksheet: ExcelJS.Worksheet) {
  worksheet.columns.forEach((column) => {
    let maxLength = 12;
    column.eachCell?.({ includeEmpty: true }, (cell) => {
      const value = cell.value == null ? '' : String(cell.value);
      maxLength = Math.max(maxLength, Math.min(value.length + 2, 42));
    });
    column.width = maxLength;
  });
}

function styleMoneyColumns(worksheet: ExcelJS.Worksheet, columns: number[]) {
  columns.forEach((columnNumber) => {
    worksheet.getColumn(columnNumber).numFmt = '#,##0.00 "EGP"';
  });
}

function colorStatusCell(cell: ExcelJS.Cell, status: string) {
  const fill = STATUS_FILLS[status];
  if (!fill) return;
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${fill}` } };
  cell.font = { bold: true, color: { argb: 'FF111827' } };
}

function sendWorkbook(res: any, workbook: ExcelJS.Workbook, filename: string) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return workbook.xlsx.writeBuffer().then((buffer) => res.send(Buffer.from(buffer)));
}

async function fetchOrders(query: any) {
  return prisma.order.findMany({
    where: orderWhere(query),
    take: MAX_EXPORT_ROWS,
    orderBy: { createdAt: 'desc' },
    select: {
      shipmentNumber: true,
      status: true,
      collectionStatus: true,
      recipientName: true,
      recipientPhone: true,
      destination: true,
      pickupAddress: true,
      deliveryType: true,
      itemPrice: true,
      deliveryFee: true,
      addonsTotal: true,
      grandTotal: true,
      totalPrice: true,
      addons: true,
      createdAt: true,
      updatedAt: true,
      client: { select: { name: true, email: true, phone: true } },
      driver: { select: { name: true, phone: true } },
      zone: { select: { name: true } },
    },
  });
}

router.get('/orders.xlsx', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res) => {
  try {
    const orders = await fetchOrders(req.query);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Shipping System';
    workbook.created = new Date();
    const worksheet = workbook.addWorksheet('Orders', { properties: { defaultRowHeight: 18 } });
    const headers = [
      'Shipment Number', 'Status', 'Collection Status', 'Merchant', 'Merchant Phone',
      'Receiver', 'Receiver Phone', 'Zone', 'Delivery Type', 'Item Price',
      'Delivery Fee', 'Add-ons Total', 'Grand Total / COD', 'Add-ons',
      'Created At', 'Updated At',
    ];
    setupWorksheet(worksheet, 'Orders Export', headers);
    orders.forEach((order) => {
      const row = worksheet.addRow([
        order.shipmentNumber,
        order.status,
        order.collectionStatus,
        order.client?.name || '',
        order.client?.phone || '',
        order.recipientName || '',
        order.recipientPhone || '',
        order.zone?.name || '',
        order.deliveryType,
        money(order.itemPrice),
        money(order.deliveryFee),
        money(order.addonsTotal),
        money(order.grandTotal || order.totalPrice),
        Array.isArray(order.addons) ? order.addons.map((a: any) => `${a.name}: ${money(a.amount)}`).join(', ') : '',
        order.createdAt,
        order.updatedAt,
      ]);
      colorStatusCell(row.getCell(2), order.status);
    });
    styleMoneyColumns(worksheet, [10, 11, 12, 13]);
    worksheet.getColumn(15).numFmt = 'yyyy-mm-dd hh:mm';
    worksheet.getColumn(16).numFmt = 'yyyy-mm-dd hh:mm';
    autoWidth(worksheet);
    return sendWorkbook(res, workbook, `orders-report-${new Date().toISOString().slice(0, 10)}.xlsx`);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to export orders' });
  }
});

router.get('/users.xlsx', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res) => {
  try {
    const where: any = {};
    if (req.query.role) where.role = req.query.role;
    if (req.query.isActive === 'true') where.isActive = true;
    if (req.query.isActive === 'false') where.isActive = false;
    if (req.query.search && typeof req.query.search === 'string' && req.query.search.trim()) {
      const q = req.query.search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
      ];
    }
    const users = await prisma.user.findMany({
      where,
      take: MAX_EXPORT_ROWS,
      orderBy: { createdAt: 'desc' },
      select: {
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
        _count: { select: { clientOrders: true, driverOrders: true } },
      },
    });
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Shipping System';
    workbook.created = new Date();
    const worksheet = workbook.addWorksheet('Users');
    const headers = ['Name', 'Email', 'Phone', 'Role', 'Status', 'Client Orders', 'Driver Orders', 'Created At'];
    setupWorksheet(worksheet, 'Users Export', headers);
    users.forEach((user) => {
      worksheet.addRow([
        user.name,
        user.email,
        user.phone || '',
        user.role,
        user.isActive ? 'Active' : 'Disabled',
        user._count.clientOrders,
        user._count.driverOrders,
        user.createdAt,
      ]);
    });
    worksheet.getColumn(8).numFmt = 'yyyy-mm-dd hh:mm';
    autoWidth(worksheet);
    return sendWorkbook(res, workbook, `users-report-${new Date().toISOString().slice(0, 10)}.xlsx`);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to export users' });
  }
});

router.get('/reports.xlsx', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res) => {
  try {
    const orders = await fetchOrders(req.query);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Shipping System';
    workbook.created = new Date();

    const financial = workbook.addWorksheet('Financial Summary');
    setupWorksheet(financial, 'Financial Summary', ['Metric', 'Amount']);
    const itemValue = orders.reduce((sum, order) => sum + money(order.itemPrice), 0);
    const shippingRevenue = orders.reduce((sum, order) => sum + money(order.deliveryFee) + money(order.addonsTotal), 0);
    const grandTotal = orders.reduce((sum, order) => sum + money(order.grandTotal || order.totalPrice), 0);
    const settled = orders
      .filter((order) => order.collectionStatus === 'SETTLED_TO_MERCHANT')
      .reduce((sum, order) => sum + money(order.grandTotal || order.totalPrice), 0);
    const owedToMerchant = orders
      .filter((order) => ['DRIVER_COLLECTED', 'COMPANY_RECEIVED'].includes(order.collectionStatus))
      .reduce((sum, order) => sum + money(order.itemPrice), 0);
    [
      ['Item value', itemValue],
      ['Shipping revenue', shippingRevenue],
      ['Grand total / COD', grandTotal],
      ['Settled to merchant', settled],
      ['Owed to merchant', owedToMerchant],
    ].forEach((row) => financial.addRow(row));
    styleMoneyColumns(financial, [2]);
    autoWidth(financial);

    const merchantMap = new Map<string, any>();
    const driverMap = new Map<string, any>();
    orders.forEach((order) => {
      const merchant = order.client?.name || 'Unknown';
      const m = merchantMap.get(merchant) || { merchant, orders: 0, itemValue: 0, shippingRevenue: 0, grandTotal: 0 };
      m.orders += 1;
      m.itemValue += money(order.itemPrice);
      m.shippingRevenue += money(order.deliveryFee) + money(order.addonsTotal);
      m.grandTotal += money(order.grandTotal || order.totalPrice);
      merchantMap.set(merchant, m);

      const driver = order.driver?.name || 'Unassigned';
      const d = driverMap.get(driver) || { driver, assigned: 0, delivered: 0, cancelled: 0, returned: 0, cod: 0 };
      d.assigned += 1;
      if (order.status === 'DELIVERED' || order.status === 'COLLECTED') d.delivered += 1;
      if (order.status === 'CANCELLED') d.cancelled += 1;
      if (order.status === 'RETURNED') d.returned += 1;
      d.cod += money(order.grandTotal || order.totalPrice);
      driverMap.set(driver, d);
    });

    const merchants = workbook.addWorksheet('Merchants');
    setupWorksheet(merchants, 'Merchant Summary', ['Merchant', 'Orders', 'Item Value', 'Shipping Revenue', 'Grand Total / COD']);
    [...merchantMap.values()].forEach((row) => merchants.addRow([row.merchant, row.orders, row.itemValue, row.shippingRevenue, row.grandTotal]));
    styleMoneyColumns(merchants, [3, 4, 5]);
    autoWidth(merchants);

    const drivers = workbook.addWorksheet('Drivers');
    setupWorksheet(drivers, 'Driver Summary', ['Driver', 'Assigned', 'Delivered', 'Cancelled', 'Returned', 'COD']);
    [...driverMap.values()].forEach((row) => drivers.addRow([row.driver, row.assigned, row.delivered, row.cancelled, row.returned, row.cod]));
    styleMoneyColumns(drivers, [6]);
    autoWidth(drivers);

    const ordersSheet = workbook.addWorksheet('Orders');
    setupWorksheet(ordersSheet, 'Orders', ['Shipment Number', 'Status', 'Merchant', 'Driver', 'Item Price', 'Shipping Revenue', 'Grand Total / COD', 'Created At']);
    orders.forEach((order) => {
      const row = ordersSheet.addRow([
        order.shipmentNumber,
        order.status,
        order.client?.name || '',
        order.driver?.name || '',
        money(order.itemPrice),
        money(order.deliveryFee) + money(order.addonsTotal),
        money(order.grandTotal || order.totalPrice),
        order.createdAt,
      ]);
      colorStatusCell(row.getCell(2), order.status);
    });
    styleMoneyColumns(ordersSheet, [5, 6, 7]);
    ordersSheet.getColumn(8).numFmt = 'yyyy-mm-dd hh:mm';
    autoWidth(ordersSheet);

    return sendWorkbook(res, workbook, `logistics-bi-report-${new Date().toISOString().slice(0, 10)}.xlsx`);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to export reports' });
  }
});

router.get('/', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res) => {
  const type = String(req.query.type || 'orders');
  const params = new URLSearchParams();
  Object.entries(req.query).forEach(([key, value]) => {
    if (key === 'type') return;
    if (Array.isArray(value)) value.forEach((entry) => params.append(key, String(entry)));
    else if (value != null) params.set(key, String(value));
  });
  const suffix = params.toString() ? `?${params.toString()}` : '';
  if (type === 'users') return res.redirect(307, `/api/admin/export/users.xlsx${suffix}`);
  if (type === 'reports') return res.redirect(307, `/api/admin/export/reports.xlsx${suffix}`);
  return res.redirect(307, `/api/admin/export/orders.xlsx${suffix}`);
});

export default router;
