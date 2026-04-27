"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const auth_1 = require("../middleware/auth");
const notification_service_1 = require("../services/notification.service");
const prisma_1 = require("../lib/prisma");
const router = (0, express_1.Router)();
const createRefundSchema = zod_1.z.object({
    orderId: zod_1.z.string().uuid(),
    amount: zod_1.z.number().positive(),
    reason: zod_1.z.string().optional(),
});
// GET /api/refunds
router.get('/', auth_1.authenticate, (0, auth_1.requireRole)('ADMIN'), async (req, res) => {
    try {
        const refunds = await prisma_1.prisma.refund.findMany({
            include: { order: { include: { client: { select: { name: true, email: true } } } } },
            orderBy: { createdAt: 'desc' },
        });
        return res.json({ refunds });
    }
    catch {
        return res.status(500).json({ error: 'Failed to fetch refunds' });
    }
});
// POST /api/refunds
router.post('/', auth_1.authenticate, (0, auth_1.requireRole)('ADMIN'), async (req, res) => {
    try {
        const data = createRefundSchema.parse(req.body);
        const order = await prisma_1.prisma.order.findUnique({
            where: { id: data.orderId },
            include: { client: { select: { email: true } } },
        });
        if (!order)
            return res.status(404).json({ error: 'Order not found' });
        const refund = await prisma_1.prisma.refund.upsert({
            where: { orderId: data.orderId },
            create: { orderId: data.orderId, amount: data.amount, reason: data.reason, status: 'PROCESSED', processedAt: new Date() },
            update: { amount: data.amount, reason: data.reason, status: 'PROCESSED', processedAt: new Date() },
        });
        await (0, notification_service_1.notifyRefundProcessed)(order.client.email, data.orderId, data.amount);
        return res.status(201).json({ refund });
    }
    catch (err) {
        if (err.name === 'ZodError')
            return res.status(400).json({ error: err.errors });
        return res.status(500).json({ error: 'Failed to process refund' });
    }
});
// PATCH /api/refunds/:id/status
router.patch('/:id/status', auth_1.authenticate, (0, auth_1.requireRole)('ADMIN'), async (req, res) => {
    try {
        const { status } = zod_1.z.object({ status: zod_1.z.enum(['PENDING', 'PROCESSED', 'REJECTED']) }).parse(req.body);
        const refund = await prisma_1.prisma.refund.update({
            where: { id: req.params.id },
            data: { status, processedAt: status === 'PROCESSED' ? new Date() : undefined },
        });
        return res.json({ refund });
    }
    catch (err) {
        if (err.name === 'ZodError')
            return res.status(400).json({ error: err.errors });
        return res.status(500).json({ error: 'Failed to update refund' });
    }
});
exports.default = router;
