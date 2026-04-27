"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const auth_1 = require("../middleware/auth");
const prisma_1 = require("../lib/prisma");
const router = (0, express_1.Router)();
const zoneSchema = zod_1.z.object({
    name: zod_1.z.string().min(2),
    description: zod_1.z.string().optional(),
    basePrice: zod_1.z.number().min(0),
});
// GET /api/zones
router.get('/', auth_1.authenticate, async (req, res) => {
    try {
        const zones = await prisma_1.prisma.zone.findMany({ include: { pricingRule: true }, orderBy: { name: 'asc' } });
        return res.json({ zones });
    }
    catch {
        return res.status(500).json({ error: 'Failed to fetch zones' });
    }
});
// POST /api/zones
router.post('/', auth_1.authenticate, (0, auth_1.requireRole)('ADMIN'), async (req, res) => {
    try {
        const data = zoneSchema.parse(req.body);
        const zone = await prisma_1.prisma.zone.create({ data, include: { pricingRule: true } });
        return res.status(201).json({ zone });
    }
    catch (err) {
        if (err.name === 'ZodError')
            return res.status(400).json({ error: err.errors });
        return res.status(500).json({ error: 'Failed to create zone' });
    }
});
// PUT /api/zones/:id
router.put('/:id', auth_1.authenticate, (0, auth_1.requireRole)('ADMIN'), async (req, res) => {
    try {
        const data = zoneSchema.partial().parse(req.body);
        const zone = await prisma_1.prisma.zone.update({ where: { id: req.params.id }, data, include: { pricingRule: true } });
        return res.json({ zone });
    }
    catch (err) {
        if (err.name === 'ZodError')
            return res.status(400).json({ error: err.errors });
        return res.status(500).json({ error: 'Failed to update zone' });
    }
});
// DELETE /api/zones/:id
router.delete('/:id', auth_1.authenticate, (0, auth_1.requireRole)('ADMIN'), async (req, res) => {
    try {
        await prisma_1.prisma.zone.delete({ where: { id: req.params.id } });
        return res.json({ message: 'Zone deleted' });
    }
    catch {
        return res.status(500).json({ error: 'Failed to delete zone' });
    }
});
exports.default = router;
