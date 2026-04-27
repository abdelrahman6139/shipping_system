import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/auth';
import { prisma } from '../lib/prisma';

const router = Router();

const pricingRuleSchema = z.object({
  zoneId: z.string().uuid(),
  pricePerKg: z.number().min(0),
  standardMultiplier: z.number().min(0),
  expressMultiplier: z.number().min(0),
  sameDayMultiplier: z.number().min(0),
  driverPayout: z.number().min(0).nullable().optional(),
});

// GET /api/pricing-rules
router.get('/', authenticate, async (req, res) => {
  try {
    const rules = await prisma.pricingRule.findMany({ include: { zone: true }, orderBy: { createdAt: 'asc' } });
    return res.json({ rules });
  } catch {
    return res.status(500).json({ error: 'Failed to fetch pricing rules' });
  }
});

// POST /api/pricing-rules
router.post('/', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const data = pricingRuleSchema.parse(req.body);
    const rule = await prisma.pricingRule.upsert({
      where: { zoneId: data.zoneId },
      create: data,
      update: data,
      include: { zone: true },
    });
    return res.status(201).json({ rule });
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    return res.status(500).json({ error: 'Failed to create pricing rule' });
  }
});

// PUT /api/pricing-rules/:id
router.put('/:id', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const data = pricingRuleSchema.partial().omit({ zoneId: true }).parse(req.body);
    const rule = await prisma.pricingRule.update({
      where: { id: req.params.id },
      data,
      include: { zone: true },
    });
    return res.json({ rule });
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    return res.status(500).json({ error: 'Failed to update pricing rule' });
  }
});

export default router;
