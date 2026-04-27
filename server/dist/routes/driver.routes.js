"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const prisma_1 = require("../lib/prisma");
const router = (0, express_1.Router)();
// GET /api/driver/earnings
router.get('/earnings', auth_1.authenticate, (0, auth_1.requireRole)('DRIVER'), async (req, res) => {
    try {
        const driverId = req.user.userId;
        const { period } = req.query;
        const now = new Date();
        let startDate;
        if (period === 'day') {
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        }
        else if (period === 'week') {
            startDate = new Date();
            startDate.setDate(startDate.getDate() - 7);
        }
        else if (period === 'month') {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        }
        const where = { driverId };
        if (startDate)
            where.date = { gte: startDate };
        const earnings = await prisma_1.prisma.driverEarning.findMany({
            where,
            include: {
                order: {
                    include: { client: { select: { name: true } }, zone: true },
                },
            },
            orderBy: { date: 'desc' },
        });
        const total = earnings.reduce((sum, e) => sum + e.amount, 0);
        // Group by day for chart
        const byDay = earnings.reduce((acc, e) => {
            const day = new Date(e.date).toLocaleDateString();
            acc[day] = (acc[day] || 0) + e.amount;
            return acc;
        }, {});
        return res.json({
            earnings,
            total: Math.round(total * 100) / 100,
            byDay: Object.entries(byDay).map(([date, amount]) => ({ date, amount })),
        });
    }
    catch {
        return res.status(500).json({ error: 'Failed to fetch earnings' });
    }
});
// GET /api/driver/stats
router.get('/stats', auth_1.authenticate, (0, auth_1.requireRole)('DRIVER'), async (req, res) => {
    try {
        const driverId = req.user.userId;
        const [totalDeliveries, pendingDeliveries, totalEarnings] = await Promise.all([
            prisma_1.prisma.order.count({ where: { driverId, status: 'DELIVERED' } }),
            prisma_1.prisma.order.count({ where: { driverId, status: { in: ['ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'] } } }),
            prisma_1.prisma.driverEarning.aggregate({ where: { driverId }, _sum: { amount: true } }),
        ]);
        return res.json({
            totalDeliveries,
            pendingDeliveries,
            totalEarnings: totalEarnings._sum.amount || 0,
        });
    }
    catch {
        return res.status(500).json({ error: 'Failed to fetch stats' });
    }
});
exports.default = router;
