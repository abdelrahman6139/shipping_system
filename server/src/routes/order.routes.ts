import { Router } from 'express';
import { CollectionStatus, DeliveryType, OrderStatus } from '@prisma/client';
import { z } from 'zod';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { calculatePrice } from '../services/pricing.service';
import { generateInvoicePDF } from '../services/pdf.service';
import {
  notifyOrderCreated,
  notifyOrderAssigned,
  notifyDriverAssigned,
  notifyStatusUpdate,
} from '../services/notification.service';
import { getDriverEarningAmount } from '../services/pricing.service';
import { prisma } from '../lib/prisma';
import { deleteCache, deleteCacheByPrefix, getCache, setCache, TTL } from '../utils/cache';

const router = Router();

const EGYPTIAN_PHONE_RE = /^(\+20|0020|0)?1[0125]\d{8}$/;

const egyptianPhone = z
  .string()
  .regex(EGYPTIAN_PHONE_RE, 'رقم الهاتف غير صحيح — يجب أن يكون رقم مصري (مثال: 01012345678)')
  .optional();

function generateShipmentNumber(): string {
  const ts  = Date.now().toString(36).toUpperCase();
  const rnd = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `SHP-${ts}${rnd}`.slice(0, 14);
}

const createOrderSchema = z.object({
  recipientName:      z.string().min(2).optional(),
  recipientPhone:     egyptianPhone,
  pickupAddress:      z.string().min(5, 'عنوان الاستلام يجب أن يكون 5 أحرف على الأقل'),
  destination:        z.string().min(5, 'عنوان التسليم يجب أن يكون 5 أحرف على الأقل'),
  packageDescription: z.string().min(3).optional(),
  deliveryType:       z.enum(['STANDARD', 'EXPRESS', 'SAME_DAY']).default('STANDARD'),
  zoneId:             z.string().uuid('يجب اختيار منطقة صحيحة'),
  notes:              z.string().optional(),
  itemPrice:          z.coerce.number().positive('سعر المنتج يجب أن يكون أكبر من صفر'),
  addons:             z.array(z.object({
    name:   z.string().trim().min(1).max(80),
    amount: z.coerce.number().min(0).max(100000),
  })).optional().default([]),
});

const updateStatusSchema = z.object({
  status:             z.enum(['PENDING', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED', 'RETURNED']),
  collectionStatus:   z.enum(['NOT_COLLECTED', 'DRIVER_COLLECTED', 'COMPANY_RECEIVED', 'SETTLED_TO_MERCHANT']).optional(),
  cancellationReason: z.string().optional(),
  returnReason:       z.string().optional(),
  returnFrom:         z.string().optional(),
});

const DRIVER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING:    [],
  ASSIGNED:   ['PICKED_UP'],
  PICKED_UP:  ['IN_TRANSIT'],
  IN_TRANSIT: ['DELIVERED'],
  DELIVERED:  [],
  COLLECTED:  [],
  CANCELLED:  [],
  RETURNED:   [],
};

const DRIVER_BLOCKED_TARGET_STATUSES: OrderStatus[] = ['PENDING', 'ASSIGNED', 'CANCELLED', 'RETURNED', 'COLLECTED'];

function canDriverUpdateStatus(currentStatus: OrderStatus, nextStatus: OrderStatus) {
  if (DRIVER_BLOCKED_TARGET_STATUSES.includes(nextStatus)) return false;
  if (currentStatus === nextStatus) return true;
  return DRIVER_STATUS_TRANSITIONS[currentStatus]?.includes(nextStatus) ?? false;
}

function roundMoney(value: number) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function normalizeAddons(addons: Array<{ name: string; amount: number }>) {
  return addons
    .map((addon) => ({ name: addon.name.trim(), amount: roundMoney(addon.amount) }))
    .filter((addon) => addon.name.length > 0 && addon.amount > 0);
}

function getOrderPricing(itemPrice: number, deliveryFee: number, addons: Array<{ name: string; amount: number }>) {
  const normalizedAddons = normalizeAddons(addons);
  const addonsTotal = roundMoney(normalizedAddons.reduce((sum, addon) => sum + addon.amount, 0));
  const roundedItemPrice = roundMoney(itemPrice);
  const roundedDeliveryFee = roundMoney(deliveryFee);
  const grandTotal = roundMoney(roundedItemPrice + roundedDeliveryFee + addonsTotal);
  return {
    itemPrice: roundedItemPrice,
    deliveryFee: roundedDeliveryFee,
    addons: normalizedAddons,
    addonsTotal,
    grandTotal,
  };
}

function invalidateOrderCaches(shipmentNumber?: string | null) {
  deleteCacheByPrefix('analytics:');
  deleteCacheByPrefix('dashboard:');
  if (shipmentNumber) deleteCache(`tracking:shipment:${shipmentNumber}`);
}

// ─── Public endpoint (no auth) ──────────────────────────────────────────────
// GET /api/orders/track/:shipmentNumber
router.get('/track/:shipmentNumber', async (req, res) => {
  try {
    const cacheKey = `tracking:shipment:${req.params.shipmentNumber}`;
    const cached = getCache(cacheKey);
    if (cached) return res.json(cached);

    const order = await prisma.order.findUnique({
      where:   { shipmentNumber: req.params.shipmentNumber },
      select:  {
        id:               true,
        shipmentNumber:   true,
        status:           true,
        deliveryType:     true,
        collectionStatus: true,
        recipientName:    true,
        destination:      true,
        createdAt:        true,
        updatedAt:        true,
        zone:             { select: { name: true } },
        // Do NOT expose: clientId, driverId, client details, pricing, notes
      },
    });
    if (!order) return res.status(404).json({ error: 'رقم الشحنة غير موجود' });
    return res.json(setCache(cacheKey, { shipment: order }, TTL.tracking));
  } catch {
    return res.status(500).json({ error: 'فشل في جلب بيانات الشحنة' });
  }
});

// POST /api/orders/calculate-price
router.post('/calculate-price', authenticate, async (req: AuthRequest, res) => {
  try {
    const parsed = z.object({
      deliveryType: z.enum(['STANDARD', 'EXPRESS', 'SAME_DAY']),
      zoneId:       z.string().uuid(),
      itemPrice:    z.coerce.number().min(0).optional().default(0),
      addons:       z.array(z.object({
        name:   z.string().trim().min(1).max(80),
        amount: z.coerce.number().min(0).max(100000),
      })).optional().default([]),
    }).parse(req.body);
    const deliveryFee = await calculatePrice({ deliveryType: parsed.deliveryType as DeliveryType, zoneId: parsed.zoneId });
    const pricing = getOrderPricing(parsed.itemPrice, deliveryFee, parsed.addons);
    return res.json({ price: pricing.grandTotal, ...pricing });
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    return res.status(400).json({ error: err.message });
  }
});

// GET /api/orders
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { status, deliveryType, driverId, clientId, dateFrom, dateTo, search, collectionStatus } = req.query;
    const page  = Math.max(parseInt((req.query.page  as string) || '1',  10) || 1, 1);
    const limit = Math.min(Math.max(parseInt((req.query.limit as string) || '20', 10) || 20, 1), 100);
    const skip  = (page - 1) * limit;
    const where: any = {};

    if (req.user?.role === 'CLIENT')      where.clientId = req.user.userId;
    else if (req.user?.role === 'DRIVER') where.driverId = req.user.userId;
    else {
      if (clientId) where.clientId = clientId;
      if (driverId) where.driverId = driverId;
    }

    if (status)           where.status           = status;
    if (deliveryType)     where.deliveryType      = deliveryType;
    if (collectionStatus) where.collectionStatus  = collectionStatus;

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom as string);
      if (dateTo)   where.createdAt.lte = new Date(dateTo   as string);
    }

    if (search && typeof search === 'string' && search.trim().length > 0) {
      const q = search.trim();
      where.OR = [
        { shipmentNumber:     { contains: q, mode: 'insensitive' } },
        { destination:        { contains: q, mode: 'insensitive' } },
        { pickupAddress:      { contains: q, mode: 'insensitive' } },
        { packageDescription: { contains: q, mode: 'insensitive' } },
        { recipientName:      { contains: q, mode: 'insensitive' } },
        { recipientPhone:     { contains: q, mode: 'insensitive' } },
        { client: { name:     { contains: q, mode: 'insensitive' } } },
        { driver: { name:     { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [total, orders] = await prisma.$transaction([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        select: {
          id: true, shipmentNumber: true, status: true, deliveryType: true,
          collectionStatus: true, totalPrice: true, itemPrice: true, deliveryFee: true,
          addonsTotal: true, grandTotal: true, addons: true, createdAt: true, updatedAt: true,
          recipientName: true, recipientPhone: true,
          pickupAddress: true, destination: true, packageDescription: true, notes: true,
          cancellationReason: true, returnReason: true, returnFrom: true,
          clientId: true, driverId: true, zoneId: true,
          client: { select: { id: true, name: true, email: true, phone: true } },
          driver: { select: { id: true, name: true, email: true, phone: true } },
          zone:   { select: { id: true, name: true } },
          invoice: { select: { id: true, pdfUrl: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const totalPages = Math.max(Math.ceil(total / limit), 1);
    return res.json({
      orders,
      pagination: { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
    });
  } catch {
    return res.status(500).json({ error: 'فشل في جلب الطلبات' });
  }
});

// GET /api/orders/:id
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const order = await prisma.order.findUnique({
      where:   { id: req.params.id },
      include: {
        client: { select: { id: true, name: true, email: true, phone: true } },
        driver: { select: { id: true, name: true, email: true, phone: true } },
        zone:   { include: { pricingRule: true } },
        invoice: true,
        refund:  true,
        tickets: { include: { messages: true } },
      },
    });
    if (!order) return res.status(404).json({ error: 'الطلب غير موجود' });

    if (req.user?.role === 'CLIENT' && order.clientId !== req.user.userId)
      return res.status(403).json({ error: 'غير مصرح' });
    if (req.user?.role === 'DRIVER' && order.driverId !== req.user.userId)
      return res.status(403).json({ error: 'غير مصرح' });

    return res.json({ order });
  } catch {
    return res.status(500).json({ error: 'فشل في جلب الطلب' });
  }
});

// POST /api/orders
router.post('/', authenticate, requireRole('CLIENT', 'ADMIN'), async (req: AuthRequest, res) => {
  try {
    const data     = createOrderSchema.parse(req.body);
    const deliveryFee = await calculatePrice({ deliveryType: data.deliveryType as DeliveryType, zoneId: data.zoneId });
    const pricing = getOrderPricing(data.itemPrice, deliveryFee, data.addons);
    const clientId = req.user?.role === 'CLIENT' ? req.user.userId : (req.body.clientId || req.user?.userId);

    let shipmentNumber = generateShipmentNumber();
    for (let i = 0; i < 5; i++) {
      const exists = await prisma.order.findUnique({ where: { shipmentNumber }, select: { id: true } });
      if (!exists) break;
      shipmentNumber = generateShipmentNumber();
    }

    const order = await prisma.order.create({
      data: {
        recipientName:      data.recipientName,
        recipientPhone:     data.recipientPhone,
        pickupAddress:      data.pickupAddress,
        destination:        data.destination,
        packageDescription: data.packageDescription,
        deliveryType:       data.deliveryType as DeliveryType,
        zoneId:             data.zoneId,
        notes:              data.notes,
        shipmentNumber,
        clientId: clientId!,
        itemPrice: pricing.itemPrice,
        deliveryFee: pricing.deliveryFee,
        addons: pricing.addons,
        addonsTotal: pricing.addonsTotal,
        grandTotal: pricing.grandTotal,
        totalPrice: pricing.grandTotal,
        collectionStatus: 'NOT_COLLECTED',
      },
      include: {
        client: { select: { id: true, name: true, email: true } },
        zone:   true,
      },
    });

    const pdfUrl = await generateInvoicePDF(order.id);
    await prisma.invoice.create({ data: { orderId: order.id, pdfUrl } });
    await notifyOrderCreated(order.client.email, order.id);
    invalidateOrderCaches(order.shipmentNumber);

    const io = req.app.get('io');
    if (io) {
      io.to('role:ADMIN').emit('order:created', order);
      io.to(`user:${order.clientId}`).emit('order:created', order);
    }

    return res.status(201).json({ order, price: pricing.grandTotal, pricing });
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    return res.status(500).json({ error: err.message || 'فشل في إنشاء الطلب' });
  }
});

// PUT /api/orders/:id
router.put('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: { client: true } });
    if (!order) return res.status(404).json({ error: 'الطلب غير موجود' });

    if (req.user?.role === 'CLIENT') {
      if (order.clientId !== req.user.userId) return res.status(403).json({ error: 'غير مصرح' });
      if (order.status !== 'PENDING')         return res.status(400).json({ error: 'يمكن تعديل الطلبات المعلقة فقط' });
    }

    const { pickupAddress, destination, packageDescription, deliveryType, zoneId, notes, itemPrice, addons } = req.body;
    let pricing: ReturnType<typeof getOrderPricing> | null = null;
    if (deliveryType || zoneId || itemPrice !== undefined || addons !== undefined) {
      const parsedAddons = addons !== undefined
        ? z.array(z.object({
            name:   z.string().trim().min(1).max(80),
            amount: z.coerce.number().min(0).max(100000),
          })).parse(addons)
        : ((Array.isArray(order.addons) ? order.addons : []) as Array<{ name: string; amount: number }>);
      const nextItemPrice = itemPrice !== undefined
        ? z.coerce.number().positive('سعر المنتج يجب أن يكون أكبر من صفر').parse(itemPrice)
        : Number(order.itemPrice || 0);
      const deliveryFee = await calculatePrice({
        deliveryType: (deliveryType || order.deliveryType) as DeliveryType,
        zoneId:       zoneId || order.zoneId!,
      });
      pricing = getOrderPricing(nextItemPrice, deliveryFee, parsedAddons);
    }

    const updated = await prisma.order.update({
      where:   { id: req.params.id },
      data:    {
        pickupAddress,
        destination,
        packageDescription,
        deliveryType,
        zoneId,
        notes,
        ...(pricing ? {
          itemPrice: pricing.itemPrice,
          deliveryFee: pricing.deliveryFee,
          addons: pricing.addons,
          addonsTotal: pricing.addonsTotal,
          grandTotal: pricing.grandTotal,
          totalPrice: pricing.grandTotal,
        } : {}),
      },
      include: {
        client: { select: { id: true, name: true, email: true } },
        zone:   true,
      },
    });
    invalidateOrderCaches(updated.shipmentNumber);

    const io = req.app.get('io');
    if (io) {
      io.to('role:ADMIN').emit('order:updated', updated);
      io.to(`user:${updated.clientId}`).emit('order:updated', updated);
      if (updated.driverId) io.to(`user:${updated.driverId}`).emit('order:updated', updated);
    }
    return res.json({ order: updated });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'فشل في تحديث الطلب' });
  }
});

// PATCH /api/orders/:id/status
router.patch('/:id/status', authenticate, requireRole('DRIVER', 'ADMIN'), async (req: AuthRequest, res) => {
  try {
    const body = updateStatusSchema.parse(req.body);
    const { status, cancellationReason, returnReason, returnFrom } = body;

    const order = await prisma.order.findUnique({
      where:   { id: req.params.id },
      include: { client: true, driver: true },
    });
    const nextStatus = status as OrderStatus;
    if (!order) return res.status(404).json({ error: 'الطلب غير موجود' });

    if (req.user?.role === 'DRIVER' && order.driverId !== req.user.userId)
      return res.status(403).json({ error: 'غير مصرح' });
    if (req.user?.role === 'DRIVER' && body.collectionStatus && body.collectionStatus !== 'DRIVER_COLLECTED') {
      return res.status(403).json({ error: 'السائق يستطيع تسجيل التحصيل من العميل فقط' });
    }

    if (req.user?.role === 'DRIVER' && !canDriverUpdateStatus(order.status, nextStatus)) {
      return res.status(403).json({ error: 'Driver can only progress assigned orders through the delivery flow' });
    }

    const updateData: any = { status: nextStatus };
    if (body.collectionStatus) updateData.collectionStatus = body.collectionStatus as CollectionStatus;
    updateData.cancellationReason = status === 'CANCELLED' ? (cancellationReason || null) : null;
    updateData.returnReason       = status === 'RETURNED' ? (returnReason || null) : null;
    updateData.returnFrom         = status === 'RETURNED' ? (returnFrom || null) : null;

    // Auto-set collection when status is CANCELLED or RETURNED
    if (status === 'CANCELLED' && !body.collectionStatus) {
      updateData.collectionStatus = 'NOT_COLLECTED' as CollectionStatus;
    }

    const updated = await prisma.order.update({
      where:   { id: req.params.id },
      data:    updateData,
      include: {
        client: { select: { name: true, email: true } },
        driver: { select: { name: true } },
        zone:   true,
      },
    });
    invalidateOrderCaches(updated.shipmentNumber);

    // Create driver earning when delivered
    if (status === 'DELIVERED' && order.driverId) {
      const { amount, commissionType, commissionValue } = await getDriverEarningAmount(
        order.deliveryFee || order.totalPrice,
        order.driverId,
        order.zoneId ?? undefined
      );
      const shippingRevenue = (order.deliveryFee || 0) + (order.addonsTotal || 0);
      const companyProfit = Math.round((shippingRevenue - amount) * 100) / 100;
      await prisma.driverEarning.upsert({
        where:  { orderId: order.id },
        update: { amount, orderTotal: order.totalPrice, companyProfit, commissionType, commissionValue },
        create: {
          driverId:       order.driverId,
          orderId:        order.id,
          amount,
          orderTotal:     order.totalPrice,
          companyProfit,
          commissionType,
          commissionValue,
        },
      });
    }

    await notifyStatusUpdate(updated.client.email, order.id, status);

    const io = req.app.get('io');
    if (io) {
      io.to('role:ADMIN').emit('order:statusUpdated',   { orderId: order.id, previousStatus: order.status, status, order: updated });
      io.to(`user:${order.clientId}`).emit('order:statusUpdated', { orderId: order.id, previousStatus: order.status, status, order: updated });
      if (order.driverId) io.to(`user:${order.driverId}`).emit('order:statusUpdated', { orderId: order.id, previousStatus: order.status, status, order: updated });
    }

    return res.json({ order: updated, previousStatus: order.status, newStatus: status });
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    return res.status(500).json({ error: 'فشل في تحديث الحالة' });
  }
});

// PATCH /api/orders/:id/collection — admin updates financial settlement
router.patch('/:id/collection', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res) => {
  try {
    const { collectionStatus } = z.object({
      collectionStatus: z.enum(['NOT_COLLECTED', 'DRIVER_COLLECTED', 'COMPANY_RECEIVED', 'SETTLED_TO_MERCHANT']),
    }).parse(req.body);

    const updated = await prisma.order.update({
      where: { id: req.params.id },
      data:  { collectionStatus: collectionStatus as CollectionStatus },
    });
    invalidateOrderCaches(updated.shipmentNumber);

    const io = req.app.get('io');
    if (io) {
      io.to('role:ADMIN').emit('order:collectionUpdated', { orderId: updated.id, collectionStatus, order: updated });
      io.to(`user:${updated.clientId}`).emit('order:collectionUpdated', { orderId: updated.id, collectionStatus, order: updated });
      if (updated.driverId) io.to(`user:${updated.driverId}`).emit('order:collectionUpdated', { orderId: updated.id, collectionStatus, order: updated });
    }
    return res.json({ order: updated });
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    return res.status(500).json({ error: 'فشل في تحديث حالة التحصيل' });
  }
});

// PATCH /api/orders/:id/assign
router.patch('/:id/assign', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res) => {
  try {
    const { driverId } = req.body;
    const driver = await prisma.user.findUnique({ where: { id: driverId } });
    if (!driver || driver.role !== 'DRIVER') return res.status(400).json({ error: 'السائق غير صحيح' });

    const updated = await prisma.order.update({
      where:   { id: req.params.id },
      data:    { driverId, status: 'ASSIGNED' },
      include: {
        client: { select: { name: true, email: true } },
        driver: { select: { name: true, email: true } },
        zone:   true,
      },
    });
    invalidateOrderCaches(updated.shipmentNumber);

    await notifyOrderAssigned(updated.client.email, updated.id, driver.name);
    await notifyDriverAssigned(driver.email, updated.id);

    const io = req.app.get('io');
    if (io) {
      io.to('role:ADMIN').emit('order:assigned',          { orderId: updated.id, driverId, order: updated });
      io.to(`user:${updated.clientId}`).emit('order:assigned', { orderId: updated.id, driverId, order: updated });
      io.to(`user:${driverId}`).emit('order:assigned',        { orderId: updated.id, driverId, order: updated });
    }

    return res.json({ order: updated });
  } catch {
    return res.status(500).json({ error: 'فشل في تعيين السائق' });
  }
});

// DELETE /api/orders/:id — cancel
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { cancellationReason } = req.body || {};
    const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: { client: true } });
    if (req.user?.role === 'DRIVER' && order) {
      return res.status(403).json({ error: 'Drivers cannot cancel orders from this endpoint' });
    }
    if (!order) return res.status(404).json({ error: 'الطلب غير موجود' });

    if (req.user?.role === 'CLIENT') {
      if (order.clientId !== req.user.userId) return res.status(403).json({ error: 'غير مصرح' });
      if (order.status !== 'PENDING')         return res.status(400).json({ error: 'يمكن إلغاء الطلبات المعلقة فقط' });
    }

    const updated = await prisma.order.update({
      where: { id: req.params.id },
      data:  {
        status:             'CANCELLED',
        collectionStatus:   'NOT_COLLECTED',
        cancellationReason: cancellationReason || null,
      },
    });
    invalidateOrderCaches(updated.shipmentNumber);

    const io = req.app.get('io');
    if (io) {
      io.to('role:ADMIN').emit('order:cancelled', { orderId: updated.id });
      io.to(`user:${updated.clientId}`).emit('order:cancelled', { orderId: updated.id });
      if (updated.driverId) io.to(`user:${updated.driverId}`).emit('order:cancelled', { orderId: updated.id });
    }

    return res.json({ order: updated });
  } catch {
    return res.status(500).json({ error: 'فشل في إلغاء الطلب' });
  }
});

export default router;
