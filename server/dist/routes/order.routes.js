"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const auth_1 = require("../middleware/auth");
const pricing_service_1 = require("../services/pricing.service");
const pdf_service_1 = require("../services/pdf.service");
const notification_service_1 = require("../services/notification.service");
const pricing_service_2 = require("../services/pricing.service");
const prisma_1 = require("../lib/prisma");
const router = (0, express_1.Router)();
const createOrderSchema = zod_1.z.object({
    pickupAddress: zod_1.z.string().min(5),
    destination: zod_1.z.string().min(5),
    packageDescription: zod_1.z.string().min(3),
    weight: zod_1.z.number().positive(),
    length: zod_1.z.number().positive(),
    width: zod_1.z.number().positive(),
    height: zod_1.z.number().positive(),
    deliveryType: zod_1.z.enum(['STANDARD', 'EXPRESS', 'SAME_DAY']).default('STANDARD'),
    zoneId: zod_1.z.string().uuid(),
    notes: zod_1.z.string().optional(),
});
const updateStatusSchema = zod_1.z.object({
    status: zod_1.z.enum(['PENDING', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED']),
});
// POST /api/orders/calculate-price
router.post('/calculate-price', auth_1.authenticate, async (req, res) => {
    try {
        const { weight, length, width, height, deliveryType, zoneId } = req.body;
        const price = await (0, pricing_service_1.calculatePrice)({ weight, length, width, height, deliveryType, zoneId });
        return res.json({ price });
    }
    catch (err) {
        return res.status(400).json({ error: err.message });
    }
});
// GET /api/orders
router.get('/', auth_1.authenticate, async (req, res) => {
    try {
        const { status, deliveryType, driverId, clientId, dateFrom, dateTo, search } = req.query;
        const page = Math.max(parseInt(req.query.page || '1', 10) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10) || 20, 1), 100);
        const skip = (page - 1) * limit;
        const where = {};
        if (req.user?.role === 'CLIENT')
            where.clientId = req.user.userId;
        else if (req.user?.role === 'DRIVER')
            where.driverId = req.user.userId;
        else {
            if (clientId)
                where.clientId = clientId;
            if (driverId)
                where.driverId = driverId;
        }
        if (status)
            where.status = status;
        if (deliveryType)
            where.deliveryType = deliveryType;
        if (dateFrom || dateTo) {
            where.createdAt = {};
            if (dateFrom)
                where.createdAt.gte = new Date(dateFrom);
            if (dateTo)
                where.createdAt.lte = new Date(dateTo);
        }
        if (search && typeof search === 'string' && search.trim().length > 0) {
            const q = search.trim();
            where.OR = [
                { id: { contains: q, mode: 'insensitive' } },
                { destination: { contains: q, mode: 'insensitive' } },
                { pickupAddress: { contains: q, mode: 'insensitive' } },
                { packageDescription: { contains: q, mode: 'insensitive' } },
                { client: { name: { contains: q, mode: 'insensitive' } } },
                { driver: { name: { contains: q, mode: 'insensitive' } } },
            ];
        }
        const [total, orders] = await prisma_1.prisma.$transaction([
            prisma_1.prisma.order.count({ where }),
            prisma_1.prisma.order.findMany({
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
    }
    catch {
        return res.status(500).json({ error: 'Failed to fetch orders' });
    }
});
// GET /api/orders/:id
router.get('/:id', auth_1.authenticate, async (req, res) => {
    try {
        const order = await prisma_1.prisma.order.findUnique({
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
        if (!order)
            return res.status(404).json({ error: 'Order not found' });
        // Restrict access
        if (req.user?.role === 'CLIENT' && order.clientId !== req.user.userId)
            return res.status(403).json({ error: 'Forbidden' });
        if (req.user?.role === 'DRIVER' && order.driverId !== req.user.userId)
            return res.status(403).json({ error: 'Forbidden' });
        return res.json({ order });
    }
    catch {
        return res.status(500).json({ error: 'Failed to fetch order' });
    }
});
// POST /api/orders
router.post('/', auth_1.authenticate, (0, auth_1.requireRole)('CLIENT', 'ADMIN'), async (req, res) => {
    try {
        const data = createOrderSchema.parse(req.body);
        const price = await (0, pricing_service_1.calculatePrice)(data);
        const clientId = req.user?.role === 'CLIENT' ? req.user.userId : (req.body.clientId || req.user?.userId);
        const order = await prisma_1.prisma.order.create({
            data: {
                ...data,
                clientId: clientId,
                totalPrice: price,
            },
            include: {
                client: { select: { id: true, name: true, email: true } },
                zone: true,
            },
        });
        // Generate invoice
        const pdfUrl = await (0, pdf_service_1.generateInvoicePDF)(order.id);
        await prisma_1.prisma.invoice.create({ data: { orderId: order.id, pdfUrl } });
        // Notify client
        await (0, notification_service_1.notifyOrderCreated)(order.client.email, order.id);
        // Emit real-time event
        const io = req.app.get('io');
        if (io) {
            io.to('role:ADMIN').emit('order:created', order);
            io.to(`user:${order.clientId}`).emit('order:created', order);
        }
        return res.status(201).json({ order, price });
    }
    catch (err) {
        if (err.name === 'ZodError')
            return res.status(400).json({ error: err.errors });
        return res.status(500).json({ error: err.message || 'Failed to create order' });
    }
});
// PUT /api/orders/:id
router.put('/:id', auth_1.authenticate, async (req, res) => {
    try {
        const order = await prisma_1.prisma.order.findUnique({ where: { id: req.params.id }, include: { client: true } });
        if (!order)
            return res.status(404).json({ error: 'Order not found' });
        if (req.user?.role === 'CLIENT') {
            if (order.clientId !== req.user.userId)
                return res.status(403).json({ error: 'Forbidden' });
            if (order.status !== 'PENDING')
                return res.status(400).json({ error: 'Can only modify pending orders' });
        }
        const { pickupAddress, destination, packageDescription, weight, length, width, height, deliveryType, zoneId, notes } = req.body;
        let totalPrice = order.totalPrice;
        if (weight || length || width || height || deliveryType || zoneId) {
            totalPrice = await (0, pricing_service_1.calculatePrice)({
                weight: weight || order.weight,
                length: length || order.length,
                width: width || order.width,
                height: height || order.height,
                deliveryType: (deliveryType || order.deliveryType),
                zoneId: zoneId || order.zoneId,
            });
        }
        const updated = await prisma_1.prisma.order.update({
            where: { id: req.params.id },
            data: { pickupAddress, destination, packageDescription, weight, length, width, height, deliveryType, zoneId, notes, totalPrice },
            include: { client: { select: { id: true, name: true, email: true } }, zone: true },
        });
        const io = req.app.get('io');
        if (io) {
            io.to('role:ADMIN').emit('order:updated', updated);
            io.to(`user:${updated.clientId}`).emit('order:updated', updated);
            if (updated.driverId)
                io.to(`user:${updated.driverId}`).emit('order:updated', updated);
        }
        return res.json({ order: updated });
    }
    catch (err) {
        return res.status(500).json({ error: err.message || 'Failed to update order' });
    }
});
// PATCH /api/orders/:id/status
router.patch('/:id/status', auth_1.authenticate, (0, auth_1.requireRole)('DRIVER', 'ADMIN'), async (req, res) => {
    try {
        const { status } = updateStatusSchema.parse(req.body);
        const order = await prisma_1.prisma.order.findUnique({
            where: { id: req.params.id },
            include: { client: true, driver: true },
        });
        if (!order)
            return res.status(404).json({ error: 'Order not found' });
        if (req.user?.role === 'DRIVER' && order.driverId !== req.user.userId)
            return res.status(403).json({ error: 'Forbidden' });
        const updated = await prisma_1.prisma.order.update({
            where: { id: req.params.id },
            data: { status },
            include: { client: { select: { name: true, email: true } }, driver: { select: { name: true } }, zone: true },
        });
        // Create driver earning when delivered
        if (status === 'DELIVERED' && order.driverId) {
            const earning = await (0, pricing_service_2.getDriverEarningAmount)(order.totalPrice);
            await prisma_1.prisma.driverEarning.upsert({
                where: { orderId: order.id },
                update: { amount: earning },
                create: { driverId: order.driverId, orderId: order.id, amount: earning },
            });
        }
        await (0, notification_service_1.notifyStatusUpdate)(updated.client.email, order.id, status);
        const io = req.app.get('io');
        if (io) {
            io.to('role:ADMIN').emit('order:statusUpdated', { orderId: order.id, status, order: updated });
            io.to(`user:${order.clientId}`).emit('order:statusUpdated', { orderId: order.id, status, order: updated });
            if (order.driverId)
                io.to(`user:${order.driverId}`).emit('order:statusUpdated', { orderId: order.id, status, order: updated });
        }
        return res.json({ order: updated });
    }
    catch (err) {
        if (err.name === 'ZodError')
            return res.status(400).json({ error: err.errors });
        return res.status(500).json({ error: 'Failed to update status' });
    }
});
// PATCH /api/orders/:id/assign
router.patch('/:id/assign', auth_1.authenticate, (0, auth_1.requireRole)('ADMIN'), async (req, res) => {
    try {
        const { driverId } = req.body;
        const driver = await prisma_1.prisma.user.findUnique({ where: { id: driverId } });
        if (!driver || driver.role !== 'DRIVER')
            return res.status(400).json({ error: 'Invalid driver' });
        const updated = await prisma_1.prisma.order.update({
            where: { id: req.params.id },
            data: { driverId, status: 'ASSIGNED' },
            include: { client: { select: { name: true, email: true } }, driver: { select: { name: true, email: true } }, zone: true },
        });
        await (0, notification_service_1.notifyOrderAssigned)(updated.client.email, updated.id, driver.name);
        await (0, notification_service_1.notifyDriverAssigned)(driver.email, updated.id);
        const io = req.app.get('io');
        if (io) {
            io.to('role:ADMIN').emit('order:assigned', { orderId: updated.id, driverId, order: updated });
            io.to(`user:${updated.clientId}`).emit('order:assigned', { orderId: updated.id, driverId, order: updated });
            io.to(`user:${driverId}`).emit('order:assigned', { orderId: updated.id, driverId, order: updated });
        }
        return res.json({ order: updated });
    }
    catch {
        return res.status(500).json({ error: 'Failed to assign driver' });
    }
});
// DELETE /api/orders/:id (cancel)
router.delete('/:id', auth_1.authenticate, async (req, res) => {
    try {
        const order = await prisma_1.prisma.order.findUnique({ where: { id: req.params.id }, include: { client: true } });
        if (!order)
            return res.status(404).json({ error: 'Order not found' });
        if (req.user?.role === 'CLIENT') {
            if (order.clientId !== req.user.userId)
                return res.status(403).json({ error: 'Forbidden' });
            if (order.status !== 'PENDING')
                return res.status(400).json({ error: 'Can only cancel pending orders' });
        }
        const updated = await prisma_1.prisma.order.update({
            where: { id: req.params.id },
            data: { status: 'CANCELLED' },
        });
        const io = req.app.get('io');
        if (io) {
            io.to('role:ADMIN').emit('order:cancelled', { orderId: updated.id });
            io.to(`user:${updated.clientId}`).emit('order:cancelled', { orderId: updated.id });
            if (updated.driverId)
                io.to(`user:${updated.driverId}`).emit('order:cancelled', { orderId: updated.id });
        }
        return res.json({ order: updated });
    }
    catch {
        return res.status(500).json({ error: 'Failed to cancel order' });
    }
});
exports.default = router;
