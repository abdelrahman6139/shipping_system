import { Response, Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from '../utils/jwt';
import { authenticate } from '../middleware/auth';
import { prisma } from '../lib/prisma';

const router = Router();

const ACCESS_TOKEN_MS = 24 * 60 * 60 * 1000; // 24 hours
const REFRESH_TOKEN_MS = 30 * 24 * 60 * 60 * 1000; // 30 يوم

function setAccessTokenCookie(res: Response, accessToken: string) {
  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    maxAge:   ACCESS_TOKEN_MS,
    sameSite: 'lax',
  });
}

function setRefreshTokenCookie(res: Response, refreshToken: string) {
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    maxAge:   REFRESH_TOKEN_MS,
    sameSite: 'lax',
  });
}

// التحقق من رقم الهاتف المصري
const egyptianPhone = z
  .string()
  .regex(/^(\+20|0020|0)?1[0125]\d{8}$/, 'رقم الهاتف غير صحيح، يجب أن يكون رقم مصري صحيح')
  .optional();

const registerSchema = z.object({
  name:     z.string().min(2),
  email:    z.string().email(),
  phone:    egyptianPhone,
  password: z.string().min(6),
  role:     z.enum(['CLIENT', 'DRIVER']).optional().default('CLIENT'),
});

const loginSchema = z.object({
  email:    z.string().email(),
  password: z.string(),
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const data     = registerSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) return res.status(409).json({ error: 'البريد الإلكتروني مستخدم بالفعل' });

    const hashedPassword = await bcrypt.hash(data.password, 12);
    const user = await prisma.user.create({
      data: {
        name:     data.name,
        email:    data.email,
        phone:    data.phone,
        password: hashedPassword,
        role:     data.role,
      },
    });

    const payload      = { userId: user.id, email: user.email, role: user.role };
    const accessToken  = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    await prisma.refreshToken.create({
      data: { token: refreshToken, userId: user.id, expiresAt: new Date(Date.now() + REFRESH_TOKEN_MS) },
    });

    setAccessTokenCookie(res, accessToken);
    setRefreshTokenCookie(res, refreshToken);

    return res.status(201).json({
      accessToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone },
    });
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    return res.status(500).json({ error: 'فشل في إنشاء الحساب' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const data = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user || !user.isActive) return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });

    const valid = await bcrypt.compare(data.password, user.password);
    if (!valid) return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });

    const payload      = { userId: user.id, email: user.email, role: user.role };
    const accessToken  = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    await prisma.refreshToken.create({
      data: { token: refreshToken, userId: user.id, expiresAt: new Date(Date.now() + REFRESH_TOKEN_MS) },
    });

    setAccessTokenCookie(res, accessToken);
    setRefreshTokenCookie(res, refreshToken);

    return res.json({
      accessToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone },
    });
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    return res.status(500).json({ error: 'فشل في تسجيل الدخول' });
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
  const token = req.cookies?.refreshToken;
  if (!token) return res.status(401).json({ error: 'الرجاء تسجيل الدخول مجدداً' });

  try {
    const payload = verifyRefreshToken(token);
    const stored  = await prisma.refreshToken.findUnique({ where: { token } });
    if (!stored || stored.expiresAt < new Date()) {
      return res.status(401).json({ error: 'انتهت صلاحية الجلسة' });
    }

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user || !user.isActive) return res.status(401).json({ error: 'المستخدم غير موجود' });

    const newPayload      = { userId: user.id, email: user.email, role: user.role };
    const newAccessToken  = generateAccessToken(newPayload);
    const newRefreshToken = generateRefreshToken(newPayload);

    await prisma.refreshToken.delete({ where: { token } });
    await prisma.refreshToken.create({
      data: { token: newRefreshToken, userId: user.id, expiresAt: new Date(Date.now() + REFRESH_TOKEN_MS) },
    });

    setAccessTokenCookie(res, newAccessToken);
    setRefreshTokenCookie(res, newRefreshToken);

    return res.json({ accessToken: newAccessToken });
  } catch {
    return res.status(401).json({ error: 'انتهت صلاحية الجلسة' });
  }
});

// POST /api/auth/logout
router.post('/logout', authenticate, async (req, res) => {
  const token = req.cookies?.refreshToken;
  if (token) {
    await prisma.refreshToken.deleteMany({ where: { token } }).catch(() => {});
  }
  res.clearCookie('refreshToken');
  res.clearCookie('accessToken');
  return res.json({ message: 'تم تسجيل الخروج بنجاح' });
});

// GET /api/auth/me
router.get('/me', authenticate, async (req: any, res) => {
  try {
    const user = await prisma.user.findUnique({
      where:  { id: req.user.userId },
      select: { id: true, name: true, email: true, role: true, phone: true, isActive: true, createdAt: true },
    });
    if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });
    return res.json({ user });
  } catch {
    return res.status(500).json({ error: 'فشل في جلب بيانات المستخدم' });
  }
});

export default router;
