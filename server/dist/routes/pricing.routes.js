"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const auth_1 = require("../middleware/auth");
const prisma_1 = require("../lib/prisma");
const router = (0, express_1.Router)();
const pricingRuleSchema = zod_1.z.object({
    zoneId: zod_1.z.string().uuid(),
    pricePerKg: zod_1.z.number().min(0),
    standardMultiplier: zod_1.z.number().min(0),
    expressMultiplier: zod_1.z.number().min(0),
    sameDayMultiplier: zod_1.z.number().min(0),
});
// GET /api/pricing-rules
router.get('/', auth_1.authenticate, async (req, res) => {
    try {
        const rules = await prisma_1.prisma.pricingRule.findMany({ include: { zone: true }, orderBy: { createdAt: 'asc' } });
        return res.json({ rules });
    }
    catch {
        return res.status(500).json({ error: 'Failed to fetch pricing rules' });
    }
});
// POST /api/pricing-rules
router.post('/', auth_1.authenticate, (0, auth_1.requireRole)('ADMIN'), async (req, res) => {
    try {
        const data = pricingRuleSchema.parse(req.body);
        const rule = await prisma_1.prisma.pricingRule.upsert({
            where: { zoneId: data.zoneId },
            create: data,
            update: data,
            include: { zone: true },
        });
        return res.status(201).json({ rule });
    }
    catch (err) {
        if (err.name === 'ZodError')
            return res.status(400).json({ error: err.errors });
        return res.status(500).json({ error: 'Failed to create pricing rule' });
    }
});
// PUT /api/pricing-rules/:id
router.put('/:id', auth_1.authenticate, (0, auth_1.requireRole)('ADMIN'), async (req, res) => {
    try {
        const data = pricingRuleSchema.partial().omit({ zoneId: true }).parse(req.body);
        const rule = await prisma_1.prisma.pricingRule.update({
            where: { id: req.params.id },
            data,
            include: { zone: true },
        });
        return res.json({ rule });
    }
    catch (err) {
        if (err.name === 'ZodError')
            return res.status(400).json({ error: err.errors });
        return res.status(500).json({ error: 'Failed to update pricing rule' });
    }
});
exports.default = router;
