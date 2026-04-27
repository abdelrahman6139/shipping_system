"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const zod_1 = require("zod");
const jwt_1 = require("../utils/jwt");
const auth_1 = require("../middleware/auth");
const prisma_1 = require("../lib/prisma");
const router = (0, express_1.Router)();
const registerSchema = zod_1.z.object({
    name: zod_1.z.string().min(2),
    email: zod_1.z.string().email(),
    phone: zod_1.z.string().optional(),
    password: zod_1.z.string().min(6),
    role: zod_1.z.enum(['CLIENT', 'DRIVER']).optional().default('CLIENT'),
});
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string(),
});
// POST /api/auth/register
router.post('/register', async (req, res) => {
    try {
        const data = registerSchema.parse(req.body);
        const existing = await prisma_1.prisma.user.findUnique({ where: { email: data.email } });
        if (existing) {
            return res.status(409).json({ error: 'Email already in use' });
        }
        const hashedPassword = await bcryptjs_1.default.hash(data.password, 12);
        const user = await prisma_1.prisma.user.create({
            data: {
                name: data.name,
                email: data.email,
                phone: data.phone,
                password: hashedPassword,
                role: data.role,
            },
        });
        const payload = { userId: user.id, email: user.email, role: user.role };
        const accessToken = (0, jwt_1.generateAccessToken)(payload);
        const refreshToken = (0, jwt_1.generateRefreshToken)(payload);
        await prisma_1.prisma.refreshToken.create({
            data: {
                token: refreshToken,
                userId: user.id,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
        });
        res.cookie('refreshToken', refreshToken, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000, sameSite: 'lax' });
        return res.status(201).json({
            accessToken,
            user: { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone },
        });
    }
    catch (err) {
        if (err.name === 'ZodError')
            return res.status(400).json({ error: err.errors });
        return res.status(500).json({ error: 'Registration failed' });
    }
});
// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const data = loginSchema.parse(req.body);
        const user = await prisma_1.prisma.user.findUnique({ where: { email: data.email } });
        if (!user || !user.isActive) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const valid = await bcryptjs_1.default.compare(data.password, user.password);
        if (!valid)
            return res.status(401).json({ error: 'Invalid credentials' });
        const payload = { userId: user.id, email: user.email, role: user.role };
        const accessToken = (0, jwt_1.generateAccessToken)(payload);
        const refreshToken = (0, jwt_1.generateRefreshToken)(payload);
        await prisma_1.prisma.refreshToken.create({
            data: {
                token: refreshToken,
                userId: user.id,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
        });
        res.cookie('refreshToken', refreshToken, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000, sameSite: 'lax' });
        return res.json({
            accessToken,
            user: { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone },
        });
    }
    catch (err) {
        if (err.name === 'ZodError')
            return res.status(400).json({ error: err.errors });
        return res.status(500).json({ error: 'Login failed' });
    }
});
// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
    const token = req.cookies?.refreshToken;
    if (!token)
        return res.status(401).json({ error: 'Refresh token required' });
    try {
        const payload = (0, jwt_1.verifyRefreshToken)(token);
        const stored = await prisma_1.prisma.refreshToken.findUnique({ where: { token } });
        if (!stored || stored.expiresAt < new Date()) {
            return res.status(401).json({ error: 'Invalid refresh token' });
        }
        const user = await prisma_1.prisma.user.findUnique({ where: { id: payload.userId } });
        if (!user || !user.isActive)
            return res.status(401).json({ error: 'User not found' });
        const newPayload = { userId: user.id, email: user.email, role: user.role };
        const newAccessToken = (0, jwt_1.generateAccessToken)(newPayload);
        const newRefreshToken = (0, jwt_1.generateRefreshToken)(newPayload);
        await prisma_1.prisma.refreshToken.delete({ where: { token } });
        await prisma_1.prisma.refreshToken.create({
            data: {
                token: newRefreshToken,
                userId: user.id,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
        });
        res.cookie('refreshToken', newRefreshToken, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000, sameSite: 'lax' });
        return res.json({ accessToken: newAccessToken });
    }
    catch {
        return res.status(401).json({ error: 'Invalid refresh token' });
    }
});
// POST /api/auth/logout
router.post('/logout', auth_1.authenticate, async (req, res) => {
    const token = req.cookies?.refreshToken;
    if (token) {
        await prisma_1.prisma.refreshToken.deleteMany({ where: { token } }).catch(() => { });
    }
    res.clearCookie('refreshToken');
    return res.json({ message: 'Logged out' });
});
// GET /api/auth/me
router.get('/me', auth_1.authenticate, async (req, res) => {
    try {
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: req.user.userId },
            select: { id: true, name: true, email: true, role: true, phone: true, isActive: true, createdAt: true },
        });
        if (!user)
            return res.status(404).json({ error: 'User not found' });
        return res.json({ user });
    }
    catch {
        return res.status(500).json({ error: 'Failed to fetch user' });
    }
});
exports.default = router;
