"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const auth_1 = require("../middleware/auth");
const prisma_1 = require("../lib/prisma");
const router = (0, express_1.Router)();
const createUserSchema = zod_1.z.object({
    name: zod_1.z.string().min(2),
    email: zod_1.z.string().email(),
    phone: zod_1.z.string().optional(),
    password: zod_1.z.string().min(6),
    role: zod_1.z.enum(['CLIENT', 'ADMIN', 'DRIVER']),
});
const updateUserSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).optional(),
    email: zod_1.z.string().email().optional(),
    phone: zod_1.z.string().optional(),
    isActive: zod_1.z.boolean().optional(),
});
// GET /api/users
router.get('/', auth_1.authenticate, (0, auth_1.requireRole)('ADMIN'), async (req, res) => {
    try {
        const { role, isActive } = req.query;
        const where = {};
        if (role)
            where.role = role;
        if (isActive !== undefined)
            where.isActive = isActive === 'true';
        const users = await prisma_1.prisma.user.findMany({
            where,
            select: {
                id: true, name: true, email: true, phone: true,
                role: true, isActive: true, createdAt: true,
                _count: { select: { clientOrders: true, driverOrders: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
        return res.json({ users });
    }
    catch {
        return res.status(500).json({ error: 'Failed to fetch users' });
    }
});
// GET /api/users/drivers/available  (must be before /:id to avoid route shadowing)
router.get('/drivers/available', auth_1.authenticate, (0, auth_1.requireRole)('ADMIN'), async (req, res) => {
    try {
        const drivers = await prisma_1.prisma.user.findMany({
            where: { role: 'DRIVER', isActive: true },
            select: {
                id: true, name: true, email: true, phone: true,
                driverOrders: {
                    where: { status: { in: ['ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'] } },
                    select: { id: true, status: true },
                },
            },
        });
        return res.json({ drivers });
    }
    catch {
        return res.status(500).json({ error: 'Failed to fetch drivers' });
    }
});
// GET /api/users/:id
router.get('/:id', auth_1.authenticate, (0, auth_1.requireRole)('ADMIN'), async (req, res) => {
    try {
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: req.params.id },
            select: {
                id: true, name: true, email: true, phone: true,
                role: true, isActive: true, createdAt: true,
                clientOrders: {
                    orderBy: { createdAt: 'desc' },
                    take: 20,
                    include: { zone: true },
                },
                driverOrders: {
                    orderBy: { createdAt: 'desc' },
                    take: 20,
                    include: { zone: true },
                },
                driverEarnings: { orderBy: { date: 'desc' }, take: 20 },
            },
        });
        if (!user)
            return res.status(404).json({ error: 'User not found' });
        return res.json({ user });
    }
    catch {
        return res.status(500).json({ error: 'Failed to fetch user' });
    }
});
// POST /api/users
router.post('/', auth_1.authenticate, (0, auth_1.requireRole)('ADMIN'), async (req, res) => {
    try {
        const data = createUserSchema.parse(req.body);
        const existing = await prisma_1.prisma.user.findUnique({ where: { email: data.email } });
        if (existing)
            return res.status(409).json({ error: 'Email already in use' });
        const hashedPassword = await bcryptjs_1.default.hash(data.password, 12);
        const user = await prisma_1.prisma.user.create({
            data: { ...data, password: hashedPassword },
            select: { id: true, name: true, email: true, phone: true, role: true, isActive: true, createdAt: true },
        });
        return res.status(201).json({ user });
    }
    catch (err) {
        if (err.name === 'ZodError')
            return res.status(400).json({ error: err.errors });
        return res.status(500).json({ error: 'Failed to create user' });
    }
});
// PUT /api/users/:id
router.put('/:id', auth_1.authenticate, (0, auth_1.requireRole)('ADMIN'), async (req, res) => {
    try {
        const data = updateUserSchema.parse(req.body);
        const user = await prisma_1.prisma.user.update({
            where: { id: req.params.id },
            data,
            select: { id: true, name: true, email: true, phone: true, role: true, isActive: true },
        });
        return res.json({ user });
    }
    catch (err) {
        if (err.name === 'ZodError')
            return res.status(400).json({ error: err.errors });
        return res.status(500).json({ error: 'Failed to update user' });
    }
});
exports.default = router;
