import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { deleteCacheByPrefix, getCache, setCache, TTL } from '../utils/cache';

const router = Router();

const pricingRuleSchema = z.object({
  zoneId: z.string().uuid(),
  standardPrice: z.number().min(0).optional(),
  expressPrice: z.number().min(0).optional(),
  sameDayPrice: z.number().min(0).optional(),
  pricePerKg: z.number().min(0).optional(),
  standardMultiplier: z.number().min(0).optional(),
  expressMultiplier: z.number().min(0).optional(),
  sameDayMultiplier: z.number().min(0).optional(),
  driverPayout: z.number().min(0).nullable().optional(),
});

function normalizePricingRule(data: z.infer<typeof pricingRuleSchema>) {
  const base = data.pricePerKg;
  const standardPrice = data.standardPrice ?? (base != null ? base * (data.standardMultiplier ?? 1) : undefined);
  const expressPrice = data.expressPrice ?? (base != null ? base * (data.expressMultiplier ?? 1.5) : undefined);
  const sameDayPrice = data.sameDayPrice ?? (base != null ? base * (data.sameDayMultiplier ?? 2) : undefined);

  if (standardPrice == null || expressPrice == null || sameDayPrice == null) {
    throw new Error('Missing pricing values');
  }

  return {
    zoneId: data.zoneId,
    standardPrice: Math.round(standardPrice * 100) / 100,
    expressPrice: Math.round(expressPrice * 100) / 100,
    sameDayPrice: Math.round(sameDayPrice * 100) / 100,
    driverPayout: data.driverPayout ?? null,
  };
}

// GET /api/pricing-rules
router.get('/', authenticate, async (req, res) => {
  try {
    const cached = getCache('pricing:rules');
    if (cached) return res.json(cached);

    const rules = await prisma.pricingRule.findMany({ include: { zone: true }, orderBy: { createdAt: 'asc' } });
    return res.json(setCache('pricing:rules', { rules }, TTL.staticData));
  } catch {
    return res.status(500).json({ error: 'Failed to fetch pricing rules' });
  }
});

// POST /api/pricing-rules
router.post('/', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const data = normalizePricingRule(pricingRuleSchema.parse(req.body));
    const rule = await prisma.pricingRule.upsert({
      where: { zoneId: data.zoneId },
      create: data,
      update: data,
      include: { zone: true },
    });
    deleteCacheByPrefix('pricing:');
    deleteCacheByPrefix('zones:');
    return res.status(201).json({ rule });
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    return res.status(500).json({ error: 'Failed to create pricing rule' });
  }
});

// PUT /api/pricing-rules/:id
router.put('/:id', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const current = await prisma.pricingRule.findUnique({ where: { id: req.params.id } });
    if (!current) return res.status(404).json({ error: 'Pricing rule not found' });
    const parsed = pricingRuleSchema.partial().omit({ zoneId: true }).parse(req.body);
    const data = normalizePricingRule({
      zoneId: current.zoneId,
      standardPrice: parsed.standardPrice ?? current.standardPrice,
      expressPrice: parsed.expressPrice ?? current.expressPrice,
      sameDayPrice: parsed.sameDayPrice ?? current.sameDayPrice,
      pricePerKg: parsed.pricePerKg,
      standardMultiplier: parsed.standardMultiplier,
      expressMultiplier: parsed.expressMultiplier,
      sameDayMultiplier: parsed.sameDayMultiplier,
      driverPayout: parsed.driverPayout ?? current.driverPayout,
    });
    const rule = await prisma.pricingRule.update({
      where: { id: req.params.id },
      data: {
        standardPrice: data.standardPrice,
        expressPrice: data.expressPrice,
        sameDayPrice: data.sameDayPrice,
        driverPayout: data.driverPayout,
      },
      include: { zone: true },
    });
    deleteCacheByPrefix('pricing:');
    deleteCacheByPrefix('zones:');
    return res.json({ rule });
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    return res.status(500).json({ error: 'Failed to update pricing rule' });
  }
});

export default router;
