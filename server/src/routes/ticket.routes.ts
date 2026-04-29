import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { notifyTicketUpdate } from '../services/notification.service';
import { prisma } from '../lib/prisma';
import { deleteCacheByPrefix } from '../utils/cache';

const router = Router();

const createTicketSchema = z.object({
  orderId: z.string().uuid().optional(),
  subject: z.string().min(5, 'الموضوع يجب أن يكون 5 أحرف على الأقل'),
  message: z.string().min(10, 'الرسالة يجب أن تكون 10 أحرف على الأقل'),
});

const replySchema = z.object({
  message: z.string().min(1, 'الرسالة مطلوبة'),
});

const updateStatusSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED']),
});

// GET /api/tickets
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const page  = Math.max(parseInt((req.query.page  as string) || '1',  10) || 1, 1);
    const limit = Math.min(Math.max(parseInt((req.query.limit as string) || '20', 10) || 20, 1), 100);
    const skip  = (page - 1) * limit;

    const { status, search } = req.query;
    const where: any = {};
    if (req.user?.role === 'CLIENT') where.clientId = req.user.userId;
    if (status) where.status = status;
    if (search && typeof search === 'string' && search.trim()) {
      const q = search.trim();
      where.OR = [
        { subject: { contains: q, mode: 'insensitive' } },
        { client: { name: { contains: q, mode: 'insensitive' } } },
        { client: { email: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [total, tickets] = await prisma.$transaction([
      prisma.ticket.count({ where }),
      prisma.ticket.findMany({
        where,
        select: {
          id: true,
          subject: true,
          status: true,
          clientId: true,
          orderId: true,
          createdAt: true,
          updatedAt: true,
          client: { select: { id: true, name: true, email: true } },
          order:  { select: { id: true, shipmentNumber: true, status: true, deliveryType: true } },
          _count: { select: { messages: true } },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const totalPages = Math.max(Math.ceil(total / limit), 1);
    return res.json({
      tickets,
      pagination: { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
    });
  } catch {
    return res.status(500).json({ error: 'فشل في جلب التذاكر' });
  }
});

// GET /api/tickets/:id
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const ticket = await prisma.ticket.findUnique({
      where:   { id: req.params.id },
      include: {
        client: { select: { id: true, name: true, email: true } },
        order:  true,
        messages: {
          include: { sender: { select: { id: true, name: true, role: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!ticket) return res.status(404).json({ error: 'التذكرة غير موجودة' });
    if (req.user?.role === 'CLIENT' && ticket.clientId !== req.user.userId)
      return res.status(403).json({ error: 'غير مصرح' });
    return res.json({ ticket });
  } catch {
    return res.status(500).json({ error: 'فشل في جلب التذكرة' });
  }
});

// POST /api/tickets
router.post('/', authenticate, requireRole('CLIENT'), async (req: AuthRequest, res) => {
  try {
    const data = createTicketSchema.parse(req.body);

    // SECURITY: verify orderId belongs to the requesting client
    if (data.orderId) {
      const order = await prisma.order.findUnique({
        where:  { id: data.orderId },
        select: { clientId: true },
      });
      if (!order) {
        return res.status(404).json({ error: 'الطلب المرتبط غير موجود' });
      }
      if (order.clientId !== req.user!.userId) {
        return res.status(403).json({ error: 'لا يمكنك ربط تذكرة بطلب لا يخصك' });
      }
    }

    const ticket = await prisma.ticket.create({
      data: {
        clientId: req.user!.userId,
        orderId:  data.orderId,
        subject:  data.subject,
        messages: {
          create: { senderId: req.user!.userId, message: data.message },
        },
      },
      include: {
        client:   { select: { id: true, name: true, email: true } },
        messages: { include: { sender: { select: { id: true, name: true, role: true } } } },
      },
    });
    deleteCacheByPrefix('dashboard:');
    return res.status(201).json({ ticket });
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    return res.status(500).json({ error: 'فشل في إنشاء التذكرة' });
  }
});

// POST /api/tickets/:id/messages
router.post('/:id/messages', authenticate, async (req: AuthRequest, res) => {
  try {
    const { message } = replySchema.parse(req.body);
    const ticket = await prisma.ticket.findUnique({
      where:   { id: req.params.id },
      include: { client: { select: { email: true } } },
    });
    if (!ticket) return res.status(404).json({ error: 'التذكرة غير موجودة' });
    if (req.user?.role === 'CLIENT' && ticket.clientId !== req.user.userId)
      return res.status(403).json({ error: 'غير مصرح' });

    const msg = await prisma.ticketMessage.create({
      data:    { ticketId: ticket.id, senderId: req.user!.userId, message },
      include: { sender: { select: { id: true, name: true, role: true } } },
    });
    await prisma.ticket.update({ where: { id: ticket.id }, data: { updatedAt: new Date() } });
    deleteCacheByPrefix('dashboard:');
    return res.status(201).json({ message: msg });
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    return res.status(500).json({ error: 'فشل في إرسال الرسالة' });
  }
});

// PATCH /api/tickets/:id/status — admin only
router.patch('/:id/status', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res) => {
  try {
    const { status } = updateStatusSchema.parse(req.body);
    const ticket = await prisma.ticket.update({
      where:   { id: req.params.id },
      data:    { status },
      include: { client: { select: { email: true } } },
    });
    await notifyTicketUpdate(ticket.client.email, ticket.id, status);
    deleteCacheByPrefix('dashboard:');
    return res.json({ ticket });
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    return res.status(500).json({ error: 'فشل في تحديث حالة التذكرة' });
  }
});

export default router;
