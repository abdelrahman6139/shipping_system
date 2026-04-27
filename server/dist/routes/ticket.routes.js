"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const auth_1 = require("../middleware/auth");
const notification_service_1 = require("../services/notification.service");
const prisma_1 = require("../lib/prisma");
const router = (0, express_1.Router)();
const createTicketSchema = zod_1.z.object({
    orderId: zod_1.z.string().uuid().optional(),
    subject: zod_1.z.string().min(5),
    message: zod_1.z.string().min(10),
});
const replySchema = zod_1.z.object({
    message: zod_1.z.string().min(1),
});
const updateStatusSchema = zod_1.z.object({
    status: zod_1.z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED']),
});
// GET /api/tickets
router.get('/', auth_1.authenticate, async (req, res) => {
    try {
        const where = {};
        if (req.user?.role === 'CLIENT')
            where.clientId = req.user.userId;
        const tickets = await prisma_1.prisma.ticket.findMany({
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
    }
    catch {
        return res.status(500).json({ error: 'Failed to fetch tickets' });
    }
});
// GET /api/tickets/:id
router.get('/:id', auth_1.authenticate, async (req, res) => {
    try {
        const ticket = await prisma_1.prisma.ticket.findUnique({
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
        if (!ticket)
            return res.status(404).json({ error: 'Ticket not found' });
        if (req.user?.role === 'CLIENT' && ticket.clientId !== req.user.userId)
            return res.status(403).json({ error: 'Forbidden' });
        return res.json({ ticket });
    }
    catch {
        return res.status(500).json({ error: 'Failed to fetch ticket' });
    }
});
// POST /api/tickets
router.post('/', auth_1.authenticate, (0, auth_1.requireRole)('CLIENT'), async (req, res) => {
    try {
        const data = createTicketSchema.parse(req.body);
        const ticket = await prisma_1.prisma.ticket.create({
            data: {
                clientId: req.user.userId,
                orderId: data.orderId,
                subject: data.subject,
                messages: {
                    create: { senderId: req.user.userId, message: data.message },
                },
            },
            include: {
                client: { select: { id: true, name: true, email: true } },
                messages: { include: { sender: { select: { id: true, name: true, role: true } } } },
            },
        });
        return res.status(201).json({ ticket });
    }
    catch (err) {
        if (err.name === 'ZodError')
            return res.status(400).json({ error: err.errors });
        return res.status(500).json({ error: 'Failed to create ticket' });
    }
});
// POST /api/tickets/:id/messages
router.post('/:id/messages', auth_1.authenticate, async (req, res) => {
    try {
        const { message } = replySchema.parse(req.body);
        const ticket = await prisma_1.prisma.ticket.findUnique({
            where: { id: req.params.id },
            include: { client: { select: { email: true } } },
        });
        if (!ticket)
            return res.status(404).json({ error: 'Ticket not found' });
        if (req.user?.role === 'CLIENT' && ticket.clientId !== req.user.userId)
            return res.status(403).json({ error: 'Forbidden' });
        const msg = await prisma_1.prisma.ticketMessage.create({
            data: { ticketId: ticket.id, senderId: req.user.userId, message },
            include: { sender: { select: { id: true, name: true, role: true } } },
        });
        await prisma_1.prisma.ticket.update({ where: { id: ticket.id }, data: { updatedAt: new Date() } });
        return res.status(201).json({ message: msg });
    }
    catch (err) {
        if (err.name === 'ZodError')
            return res.status(400).json({ error: err.errors });
        return res.status(500).json({ error: 'Failed to send message' });
    }
});
// PATCH /api/tickets/:id/status
router.patch('/:id/status', auth_1.authenticate, (0, auth_1.requireRole)('ADMIN'), async (req, res) => {
    try {
        const { status } = updateStatusSchema.parse(req.body);
        const ticket = await prisma_1.prisma.ticket.update({
            where: { id: req.params.id },
            data: { status },
            include: { client: { select: { email: true } } },
        });
        await (0, notification_service_1.notifyTicketUpdate)(ticket.client.email, ticket.id, status);
        return res.json({ ticket });
    }
    catch (err) {
        if (err.name === 'ZodError')
            return res.status(400).json({ error: err.errors });
        return res.status(500).json({ error: 'Failed to update ticket' });
    }
});
exports.default = router;
