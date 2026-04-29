import { Router } from 'express';
import { z } from 'zod';
import { DeliveryType } from '@prisma/client';
import { authenticate, requireRole } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { deleteCacheByPrefix, getCache, setCache, TTL } from '../utils/cache';
import { calculatePrice } from '../services/pricing.service';

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

function roundMoney(value: number) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function normalizeAddons(addons: Array<{ name: string; amount: number }>) {
  return addons
    .map((addon) => ({ name: addon.name.trim(), amount: roundMoney(addon.amount) }))
    .filter((addon) => addon.name.length > 0 && addon.amount > 0);
}

async function validateZoneSelection(zoneId: string, parentZoneId?: string | null) {
  if (!parentZoneId) return;
  const zone = await prisma.zone.findUnique({ where: { id: zoneId }, select: { id: true, parentId: true } });
  const parent = await prisma.zone.findUnique({
    where: { id: parentZoneId },
    select: { id: true, parentId: true, children: { select: { id: true }, take: 1 } },
  });
  if (!zone || !parent || parent.parentId) throw new Error('المنطقة غير صحيحة');
  if (zone.id === parent.id && parent.children.length > 0) throw new Error('اختر الحي / المنطقة التابعة للمحافظة');
  if (zone.id !== parent.id && zone.parentId !== parent.id) throw new Error('الحي / المنطقة لا يتبع المحافظة المحددة');
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

// POST /api/pricing-rules/estimate
router.post('/estimate', authenticate, async (req, res) => {
  try {
    const parsed = z.object({
      deliveryType: z.enum(['STANDARD', 'EXPRESS', 'SAME_DAY']),
      zoneId: z.string().uuid(),
      parentZoneId: z.string().uuid().optional(),
      itemPrice: z.coerce.number().min(0).optional().default(0),
      addons: z.array(z.object({
        name: z.string().trim().min(1).max(80),
        amount: z.coerce.number().min(0).max(100000),
      })).optional().default([]),
    }).parse(req.body);
    await validateZoneSelection(parsed.zoneId, parsed.parentZoneId);
    const deliveryFee = await calculatePrice({ deliveryType: parsed.deliveryType as DeliveryType, zoneId: parsed.zoneId });
    const normalizedAddons = normalizeAddons(parsed.addons);
    const addonsTotal = roundMoney(normalizedAddons.reduce((sum, addon) => sum + addon.amount, 0));
    const itemPrice = roundMoney(parsed.itemPrice);
    const grandTotal = roundMoney(itemPrice + deliveryFee + addonsTotal);
    return res.json({ itemPrice, deliveryFee, addons: normalizedAddons, addonsTotal, grandTotal, price: grandTotal });
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    return res.status(400).json({ error: err.message || 'Failed to estimate price' });
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
