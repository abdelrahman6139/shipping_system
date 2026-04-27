import { Router } from 'express';
import { DeliveryType } from '@prisma/client';
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

const router = Router();

const createOrderSchema = z.object({
  recipientName: z.string().min(2).optional(),
  recipientPhone: z.string().min(7).optional(),
  pickupAddress: z.string().min(5),
  destination: z.string().min(5),
  packageDescription: z.string().min(3),
  weight: z.number().positive(),
  length: z.number().positive(),
  width: z.number().positive(),
  height: z.number().positive(),
  deliveryType: z.enum(['STANDARD', 'EXPRESS', 'SAME_DAY']).default('STANDARD'),
  zoneId: z.string().uuid(),
  notes: z.string().optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(['PENDING', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'COLLECTED', 'CANCELLED']),
});

// POST /api/orders/calculate-price
router.post('/calculate-price', authenticate, async (req: AuthRequest, res) => {
  try {
    const { weight, length, width, height, deliveryType, zoneId } = req.body;
    const price = await calculatePrice({ weight, length, width, height, deliveryType, zoneId });
    return res.json({ price });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// GET /api/orders
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { status, deliveryType, driverId, clientId, dateFrom, dateTo, search } = req.query;
    const page = Math.max(parseInt((req.query.page as string) || '1', 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt((req.query.limit as string) || '20', 10) || 20, 1), 100);
    const skip = (page - 1) * limit;
    const where: any = {};

    if (req.user?.role === 'CLIENT') where.clientId = req.user.userId;
    else if (req.user?.role === 'DRIVER') where.driverId = req.user.userId;
    else {
      if (clientId) where.clientId = clientId;
      if (driverId) where.driverId = driverId;
    }

    if (status) where.status = status;
    if (deliveryType) where.deliveryType = deliveryType;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom as string);
      if (dateTo) where.createdAt.lte = new Date(dateTo as string);
    }

    if (search && typeof search === 'string' && search.trim().length > 0) {
      const q = search.trim();
      where.OR = [
        { id: { contains: q, mode: 'insensitive' } },
        { destination: { contains: q, mode: 'insensitive' } },
        { pickupAddress: { contains: q, mode: 'insensitive' } },
        { packageDescription: { contains: q, mode: 'insensitive' } },
        { recipientName: { contains: q, mode: 'insensitive' } },
        { recipientPhone: { contains: q, mode: 'insensitive' } },
        { client: { name: { contains: q, mode: 'insensitive' } } },
        { driver: { name: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [total, orders] = await prisma.$transaction([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        include: {
          client: { select: { id: true, name: true, email: true, phone: true } },
          driver: { select: { id: true, name: true, email: true, phone: true } },
          zone: true,
          invoice: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const totalPages = Math.max(Math.ceil(total / limit), 1);

    return res.json({
      orders,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  } catch {
    return res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// GET /api/orders/:id
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        client: { select: { id: true, name: true, email: true, phone: true } },
        driver: { select: { id: true, name: true, email: true, phone: true } },
        zone: { include: { pricingRule: true } },
        invoice: true,
        refund: true,
        tickets: { include: { messages: true } },
      },
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    // Restrict access
    if (req.user?.role === 'CLIENT' && order.clientId !== req.user.userId)
      return res.status(403).json({ error: 'Forbidden' });
    if (req.user?.role === 'DRIVER' && order.driverId !== req.user.userId)
      return res.status(403).json({ error: 'Forbidden' });
    return res.json({ order });
  } catch {
    return res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// POST /api/orders
router.post('/', authenticate, requireRole('CLIENT', 'ADMIN'), async (req: AuthRequest, res) => {
  try {
    const data = createOrderSchema.parse(req.body);
    const price = await calculatePrice(data);
    const clientId = req.user?.role === 'CLIENT' ? req.user.userId : (req.body.clientId || req.user?.userId);

    const order = await prisma.order.create({
      data: {
        ...data,
        clientId: clientId!,
        totalPrice: price,
      },
      include: {
        client: { select: { id: true, name: true, email: true } },
        zone: true,
      },
    });

    // Generate invoice
    const pdfUrl = await generateInvoicePDF(order.id);
    await prisma.invoice.create({ data: { orderId: order.id, pdfUrl } });

    // Notify client
    await notifyOrderCreated(order.client.email, order.id);

    // Emit real-time event
    const io = req.app.get('io');
    if (io) {
      io.to('role:ADMIN').emit('order:created', order);
      io.to(`user:${order.clientId}`).emit('order:created', order);
    }

    return res.status(201).json({ order, price });
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    return res.status(500).json({ error: err.message || 'Failed to create order' });
  }
});

// PUT /api/orders/:id
router.put('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: { client: true } });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    if (req.user?.role === 'CLIENT') {
      if (order.clientId !== req.user.userId) return res.status(403).json({ error: 'Forbidden' });
      if (order.status !== 'PENDING') return res.status(400).json({ error: 'Can only modify pending orders' });
    }

    const { pickupAddress, destination, packageDescription, weight, length, width, height, deliveryType, zoneId, notes } = req.body;
    let totalPrice = order.totalPrice;

    if (weight || length || width || height || deliveryType || zoneId) {
      totalPrice = await calculatePrice({
        weight: weight || order.weight,
        length: length || order.length,
        width: width || order.width,
        height: height || order.height,
        deliveryType: (deliveryType || order.deliveryType) as DeliveryType,
        zoneId: zoneId || order.zoneId!,
      });
    }

    const updated = await prisma.order.update({
      where: { id: req.params.id },
      data: { pickupAddress, destination, packageDescription, weight, length, width, height, deliveryType, zoneId, notes, totalPrice },
      include: { client: { select: { id: true, name: true, email: true } }, zone: true },
    });

    const io = req.app.get('io');
    if (io) {
      io.to('role:ADMIN').emit('order:updated', updated);
      io.to(`user:${updated.clientId}`).emit('order:updated', updated);
      if (updated.driverId) io.to(`user:${updated.driverId}`).emit('order:updated', updated);
    }

    return res.json({ order: updated });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to update order' });
  }
});

// PATCH /api/orders/:id/status
router.patch('/:id/status', authenticate, requireRole('DRIVER', 'ADMIN'), async (req: AuthRequest, res) => {
  try {
    const { status } = updateStatusSchema.parse(req.body);
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { client: true, driver: true },
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    if (req.user?.role === 'DRIVER' && order.driverId !== req.user.userId)
      return res.status(403).json({ error: 'Forbidden' });

    const updated = await prisma.order.update({
      where: { id: req.params.id },
      data: { status },
      include: { client: { select: { name: true, email: true } }, driver: { select: { name: true } }, zone: true },
    });

    // Create driver earning when delivered
    if (status === 'DELIVERED' && order.driverId) {
      const { amount, commissionType, commissionValue } = await getDriverEarningAmount(order.totalPrice, order.driverId, order.zoneId ?? undefined);
      const companyProfit = Math.round((order.totalPrice - amount) * 100) / 100;
      await prisma.driverEarning.upsert({
        where:  { orderId: order.id },
        update: { amount, orderTotal: order.totalPrice, companyProfit, commissionType, commissionValue },
        create: { driverId: order.driverId, orderId: order.id, amount, orderTotal: order.totalPrice, companyProfit, commissionType, commissionValue },
      });
    }

    await notifyStatusUpdate(updated.client.email, order.id, status);

    const io = req.app.get('io');
    if (io) {
      io.to('role:ADMIN').emit('order:statusUpdated', { orderId: order.id, status, order: updated });
      io.to(`user:${order.clientId}`).emit('order:statusUpdated', { orderId: order.id, status, order: updated });
      if (order.driverId) io.to(`user:${order.driverId}`).emit('order:statusUpdated', { orderId: order.id, status, order: updated });
    }

    return res.json({ order: updated });
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    return res.status(500).json({ error: 'Failed to update status' });
  }
});

// PATCH /api/orders/:id/assign
router.patch('/:id/assign', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res) => {
  try {
    const { driverId } = req.body;
    const driver = await prisma.user.findUnique({ where: { id: driverId } });
    if (!driver || driver.role !== 'DRIVER') return res.status(400).json({ error: 'Invalid driver' });

    const updated = await prisma.order.update({
      where: { id: req.params.id },
      data: { driverId, status: 'ASSIGNED' },
      include: { client: { select: { name: true, email: true } }, driver: { select: { name: true, email: true } }, zone: true },
    });

    await notifyOrderAssigned(updated.client.email, updated.id, driver.name);
    await notifyDriverAssigned(driver.email, updated.id);

    const io = req.app.get('io');
    if (io) {
      io.to('role:ADMIN').emit('order:assigned', { orderId: updated.id, driverId, order: updated });
      io.to(`user:${updated.clientId}`).emit('order:assigned', { orderId: updated.id, driverId, order: updated });
      io.to(`user:${driverId}`).emit('order:assigned', { orderId: updated.id, driverId, order: updated });
    }

    return res.json({ order: updated });
  } catch {
    return res.status(500).json({ error: 'Failed to assign driver' });
  }
});

// DELETE /api/orders/:id (cancel)
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: { client: true } });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    if (req.user?.role === 'CLIENT') {
      if (order.clientId !== req.user.userId) return res.status(403).json({ error: 'Forbidden' });
      if (order.status !== 'PENDING') return res.status(400).json({ error: 'Can only cancel pending orders' });
    }

    const updated = await prisma.order.update({
      where: { id: req.params.id },
      data: { status: 'CANCELLED' },
    });

    const io = req.app.get('io');
    if (io) {
      io.to('role:ADMIN').emit('order:cancelled', { orderId: updated.id });
      io.to(`user:${updated.clientId}`).emit('order:cancelled', { orderId: updated.id });
      if (updated.driverId) io.to(`user:${updated.driverId}`).emit('order:cancelled', { orderId: updated.id });
    }

    return res.json({ order: updated });
  } catch {
    return res.status(500).json({ error: 'Failed to cancel order' });
  }
});

export default router;
