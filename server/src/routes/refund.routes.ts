import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/auth';
import { notifyRefundProcessed } from '../services/notification.service';
import { prisma } from '../lib/prisma';

const router = Router();

const createRefundSchema = z.object({
  orderId: z.string().uuid(),
  amount: z.number().positive(),
  reason: z.string().optional(),
});

// GET /api/refunds
router.get('/', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const refunds = await prisma.refund.findMany({
      include: { order: { include: { client: { select: { name: true, email: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ refunds });
  } catch {
    return res.status(500).json({ error: 'Failed to fetch refunds' });
  }
});

// POST /api/refunds
router.post('/', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const data = createRefundSchema.parse(req.body);
    const order = await prisma.order.findUnique({
      where: { id: data.orderId },
      include: { client: { select: { email: true } } },
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const refund = await prisma.refund.upsert({
      where: { orderId: data.orderId },
      create: { orderId: data.orderId, amount: data.amount, reason: data.reason, status: 'PROCESSED', processedAt: new Date() },
      update: { amount: data.amount, reason: data.reason, status: 'PROCESSED', processedAt: new Date() },
    });

    await notifyRefundProcessed(order.client.email, data.orderId, data.amount);

    return res.status(201).json({ refund });
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    return res.status(500).json({ error: 'Failed to process refund' });
  }
});

// PATCH /api/refunds/:id/status
router.patch('/:id/status', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const { status } = z.object({ status: z.enum(['PENDING', 'PROCESSED', 'REJECTED']) }).parse(req.body);
    const refund = await prisma.refund.update({
      where: { id: req.params.id },
      data: { status, processedAt: status === 'PROCESSED' ? new Date() : undefined },
    });
    return res.json({ refund });
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    return res.status(500).json({ error: 'Failed to update refund' });
  }
});

export default router;
