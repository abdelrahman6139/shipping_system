import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';

const router = Router();

const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(6),
  role: z.enum(['CLIENT', 'ADMIN', 'DRIVER']),
});

const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  isActive: z.boolean().optional(),
});

// GET /api/users
router.get('/', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const { role, isActive } = req.query;
    const where: any = {};
    if (role) where.role = role;
    if (isActive !== undefined) where.isActive = isActive === 'true';

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true, name: true, email: true, phone: true,
        role: true, isActive: true, createdAt: true,
        commissionType: true, commissionValue: true,
        _count: { select: { clientOrders: true, driverOrders: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ users });
  } catch {
    return res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// GET /api/users/drivers/available  (must be before /:id to avoid route shadowing)
router.get('/drivers/available', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const drivers = await prisma.user.findMany({
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
  } catch {
    return res.status(500).json({ error: 'Failed to fetch drivers' });
  }
});

// GET /api/users/:id
router.get('/:id', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
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
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json({ user });
  } catch {
    return res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// POST /api/users
router.post('/', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const data = createUserSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) return res.status(409).json({ error: 'Email already in use' });

    const hashedPassword = await bcrypt.hash(data.password, 12);
    const user = await prisma.user.create({
      data: { ...data, password: hashedPassword },
      select: { id: true, name: true, email: true, phone: true, role: true, isActive: true, createdAt: true },
    });
    return res.status(201).json({ user });
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    return res.status(500).json({ error: 'Failed to create user' });
  }
});

// PUT /api/users/:id
router.put('/:id', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const data = updateUserSchema.parse(req.body);
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data,
      select: { id: true, name: true, email: true, phone: true, role: true, isActive: true },
    });
    return res.json({ user });
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    return res.status(500).json({ error: 'Failed to update user' });
  }
});

// PATCH /api/users/:id/commission  — admin sets driver commission
router.patch('/:id/commission', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const { commissionType, commissionValue } = z.object({
      commissionType:  z.enum(['PERCENTAGE', 'FIXED']),
      commissionValue: z.number().min(0),
    }).parse(req.body);

    const driver = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!driver || driver.role !== 'DRIVER')
      return res.status(400).json({ error: 'User is not a driver' });

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data:  { commissionType, commissionValue },
      select: { id: true, name: true, commissionType: true, commissionValue: true },
    });
    return res.json({ user: updated });
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    return res.status(500).json({ error: 'Failed to update commission' });
  }
});

// GET /api/users/:id/earnings  — admin views a driver's full earnings breakdown
router.get('/:id/earnings', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const driver = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { id: true, name: true, commissionType: true, commissionValue: true },
    });
    if (!driver) return res.status(404).json({ error: 'Driver not found' });

    const earnings = await prisma.driverEarning.findMany({
      where: { driverId: req.params.id },
      include: {
        order: {
          select: { id: true, destination: true, createdAt: true, status: true },
        },
      },
      orderBy: { date: 'desc' },
    });

    const totals = earnings.reduce(
      (acc, e) => ({
        driverTotal:  acc.driverTotal  + e.amount,
        companyTotal: acc.companyTotal + e.companyProfit,
        orderTotal:   acc.orderTotal   + e.orderTotal,
      }),
      { driverTotal: 0, companyTotal: 0, orderTotal: 0 }
    );

    return res.json({ driver, earnings, totals });
  } catch {
    return res.status(500).json({ error: 'Failed to fetch earnings' });
  }
});

export default router;
