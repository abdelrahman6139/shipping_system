import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { deleteCacheByPrefix } from '../utils/cache';

const router = Router();

const egyptianPhone = z
  .string()
  .regex(/^(\+20|0020|0)?1[0125]\d{8}$/, 'رقم الهاتف غير صحيح، يجب أن يكون رقم مصري صحيح')
  .optional();

const createUserSchema = z.object({
  name:     z.string().min(2),
  email:    z.string().email(),
  phone:    egyptianPhone,
  password: z.string().min(6),
  role:     z.enum(['CLIENT', 'ADMIN', 'DRIVER']),
});

const updateUserSchema = z.object({
  name:     z.string().min(2).optional(),
  email:    z.string().email().optional(),
  phone:    egyptianPhone,
  isActive: z.boolean().optional(),
});

// GET /api/users — للأدمن فقط، بدون بيانات العمولة في القائمة العامة
router.get('/', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const { role, isActive, search } = req.query;
    const page  = Math.max(parseInt((req.query.page  as string) || '1',  10) || 1, 1);
    const limit = Math.min(Math.max(parseInt((req.query.limit as string) || '20', 10) || 20, 1), 100);
    const skip  = (page - 1) * limit;

    const where: any = {};
    if (role)                   where.role     = role;
    if (isActive !== undefined) where.isActive  = isActive === 'true';
    if (search && typeof search === 'string' && search.trim()) {
      const q = search.trim();
      where.OR = [
        { name:  { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, users] = await prisma.$transaction([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        select: {
          id: true, name: true, email: true, phone: true,
          role: true, isActive: true, createdAt: true,
          _count: { select: { clientOrders: true, driverOrders: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const totalPages = Math.max(Math.ceil(total / limit), 1);
    return res.json({
      users,
      pagination: { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
    });
  } catch {
    return res.status(500).json({ error: 'فشل في جلب المستخدمين' });
  }
});

// GET /api/users/drivers/available
router.get('/drivers/available', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const drivers = await prisma.user.findMany({
      where: { role: 'DRIVER', isActive: true },
      select: {
        id: true, name: true, email: true, phone: true,
        _count: {
          select: {
            driverOrders: { where: { status: { in: ['ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'] } } },
          },
        },
      },
    });
    return res.json({ drivers });
  } catch {
    return res.status(500).json({ error: 'فشل في جلب السائقين المتاحين' });
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
    if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });
    return res.json({ user });
  } catch {
    return res.status(500).json({ error: 'فشل في جلب بيانات المستخدم' });
  }
});

// POST /api/users
router.post('/', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const data     = createUserSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) return res.status(409).json({ error: 'البريد الإلكتروني مستخدم بالفعل' });

    const hashedPassword = await bcrypt.hash(data.password, 12);
    const user = await prisma.user.create({
      data:   { ...data, password: hashedPassword },
      select: { id: true, name: true, email: true, phone: true, role: true, isActive: true, createdAt: true },
    });
    deleteCacheByPrefix('dashboard:');
    return res.status(201).json({ user });
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    return res.status(500).json({ error: 'فشل في إنشاء المستخدم' });
  }
});

// PUT /api/users/:id
router.put('/:id', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const data = updateUserSchema.parse(req.body);
    const user = await prisma.user.update({
      where:  { id: req.params.id },
      data,
      select: { id: true, name: true, email: true, phone: true, role: true, isActive: true },
    });
    deleteCacheByPrefix('dashboard:');
    return res.json({ user });
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    return res.status(500).json({ error: 'فشل في تحديث المستخدم' });
  }
});

// PATCH /api/users/:id/commission — أدمن فقط يضبط عمولة السائق
router.patch('/:id/commission', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const { commissionType, commissionValue } = z.object({
      commissionType:  z.enum(['PERCENTAGE', 'FIXED']),
      commissionValue: z.number().min(0),
    }).parse(req.body);

    const driver = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!driver || driver.role !== 'DRIVER')
      return res.status(400).json({ error: 'المستخدم ليس سائقاً' });

    const updated = await prisma.user.update({
      where:  { id: req.params.id },
      data:   { commissionType, commissionValue },
      select: { id: true, name: true, commissionType: true, commissionValue: true },
    });
    deleteCacheByPrefix('analytics:');
    deleteCacheByPrefix('dashboard:');
    return res.json({ user: updated });
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    return res.status(500).json({ error: 'فشل في تحديث العمولة' });
  }
});

// GET /api/users/:id/earnings — أدمن يشوف أرباح سائق
router.get('/:id/earnings', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const driver = await prisma.user.findUnique({
      where:  { id: req.params.id },
      select: { id: true, name: true, commissionType: true, commissionValue: true },
    });
    if (!driver) return res.status(404).json({ error: 'السائق غير موجود' });

    const earnings = await prisma.driverEarning.findMany({
      where:   { driverId: req.params.id },
      include: {
        order: { select: { id: true, shipmentNumber: true, destination: true, createdAt: true, status: true, collectionStatus: true } },
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
    return res.status(500).json({ error: 'فشل في جلب الأرباح' });
  }
});

export default router;
