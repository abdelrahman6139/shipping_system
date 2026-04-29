import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { deleteCacheByPrefix, getCache, setCache, TTL } from '../utils/cache';

const router = Router();

const zoneSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  basePrice: z.number().min(0),
  parentId: z.string().uuid().optional().nullable(),
});

// GET /api/zones/tree  — hierarchical (admin use)
router.get('/tree', authenticate, async (req, res) => {
  try {
    const cached = getCache('zones:tree');
    if (cached) return res.json(cached);

    const zones = await prisma.zone.findMany({
      where: { parentId: null },
      include: {
        pricingRule: true,
        children: { include: { pricingRule: true }, orderBy: { name: 'asc' } },
      },
      orderBy: { name: 'asc' },
    });
    return res.json(setCache('zones:tree', { zones }, TTL.staticData));
  } catch {
    return res.status(500).json({ error: 'Failed to fetch zones tree' });
  }
});

// GET /api/zones  — flat list (order form use)
router.get('/', authenticate, async (req, res) => {
  try {
    const cached = getCache('zones:list');
    if (cached) return res.json(cached);

    const zones = await prisma.zone.findMany({ include: { pricingRule: true }, orderBy: { name: 'asc' } });
    return res.json(setCache('zones:list', { zones }, TTL.staticData));
  } catch {
    return res.status(500).json({ error: 'Failed to fetch zones' });
  }
});

// POST /api/zones
router.post('/', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const data = zoneSchema.parse(req.body);
    const zone = await prisma.zone.create({
      data: {
        name: data.name,
        description: data.description,
        basePrice: data.basePrice,
        ...(data.parentId ? { parentId: data.parentId } : {}),
      },
      include: { pricingRule: true },
    });
    deleteCacheByPrefix('zones:');
    deleteCacheByPrefix('pricing:');
    return res.status(201).json({ zone });
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    return res.status(500).json({ error: 'Failed to create zone' });
  }
});

// PUT /api/zones/:id
router.put('/:id', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const data = zoneSchema.partial().parse(req.body);
    const zone = await prisma.zone.update({ where: { id: req.params.id }, data, include: { pricingRule: true } });
    deleteCacheByPrefix('zones:');
    deleteCacheByPrefix('pricing:');
    return res.json({ zone });
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    return res.status(500).json({ error: 'Failed to update zone' });
  }
});

// DELETE /api/zones/:id
router.delete('/:id', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    await prisma.zone.delete({ where: { id: req.params.id } });
    deleteCacheByPrefix('zones:');
    deleteCacheByPrefix('pricing:');
    return res.json({ message: 'Zone deleted' });
  } catch {
    return res.status(500).json({ error: 'Failed to delete zone' });
  }
});

export default router;
