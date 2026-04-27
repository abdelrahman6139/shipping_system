import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { notifyTicketUpdate } from '../services/notification.service';
import { prisma } from '../lib/prisma';

const router = Router();

const createTicketSchema = z.object({
  orderId: z.string().uuid().optional(),
  subject: z.string().min(5),
  message: z.string().min(10),
});

const replySchema = z.object({
  message: z.string().min(1),
});

const updateStatusSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED']),
});

// GET /api/tickets
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const where: any = {};
    if (req.user?.role === 'CLIENT') where.clientId = req.user.userId;

    const tickets = await prisma.ticket.findMany({
      where,
      include: {
        client: { select: { id: true, name: true, email: true } },
        order: { select: { id: true, status: true, deliveryType: true } },
        messages: {
          include: { sender: { select: { id: true, name: true, role: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
    return res.json({ tickets });
  } catch {
    return res.status(500).json({ error: 'Failed to fetch tickets' });
  }
});

// GET /api/tickets/:id
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id: req.params.id },
      include: {
        client: { select: { id: true, name: true, email: true } },
        order: true,
        messages: {
          include: { sender: { select: { id: true, name: true, role: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    if (req.user?.role === 'CLIENT' && ticket.clientId !== req.user.userId)
      return res.status(403).json({ error: 'Forbidden' });
    return res.json({ ticket });
  } catch {
    return res.status(500).json({ error: 'Failed to fetch ticket' });
  }
});

// POST /api/tickets
router.post('/', authenticate, requireRole('CLIENT'), async (req: AuthRequest, res) => {
  try {
    const data = createTicketSchema.parse(req.body);
    const ticket = await prisma.ticket.create({
      data: {
        clientId: req.user!.userId,
        orderId: data.orderId,
        subject: data.subject,
        messages: {
          create: { senderId: req.user!.userId, message: data.message },
        },
      },
      include: {
        client: { select: { id: true, name: true, email: true } },
        messages: { include: { sender: { select: { id: true, name: true, role: true } } } },
      },
    });
    return res.status(201).json({ ticket });
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    return res.status(500).json({ error: 'Failed to create ticket' });
  }
});

// POST /api/tickets/:id/messages
router.post('/:id/messages', authenticate, async (req: AuthRequest, res) => {
  try {
    const { message } = replySchema.parse(req.body);
    const ticket = await prisma.ticket.findUnique({
      where: { id: req.params.id },
      include: { client: { select: { email: true } } },
    });
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    if (req.user?.role === 'CLIENT' && ticket.clientId !== req.user.userId)
      return res.status(403).json({ error: 'Forbidden' });

    const msg = await prisma.ticketMessage.create({
      data: { ticketId: ticket.id, senderId: req.user!.userId, message },
      include: { sender: { select: { id: true, name: true, role: true } } },
    });
    await prisma.ticket.update({ where: { id: ticket.id }, data: { updatedAt: new Date() } });
    return res.status(201).json({ message: msg });
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    return res.status(500).json({ error: 'Failed to send message' });
  }
});

// PATCH /api/tickets/:id/status
router.patch('/:id/status', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res) => {
  try {
    const { status } = updateStatusSchema.parse(req.body);
    const ticket = await prisma.ticket.update({
      where: { id: req.params.id },
      data: { status },
      include: { client: { select: { email: true } } },
    });
    await notifyTicketUpdate(ticket.client.email, ticket.id, status);
    return res.json({ ticket });
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    return res.status(500).json({ error: 'Failed to update ticket' });
  }
});

export default router;
