"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const prisma_1 = require("../lib/prisma");
const router = (0, express_1.Router)();
// GET /api/analytics/dashboard
router.get('/dashboard', auth_1.authenticate, (0, auth_1.requireRole)('ADMIN'), async (req, res) => {
    try {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekStart = new Date(todayStart);
        weekStart.setDate(weekStart.getDate() - 7);
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const [totalOrders, pendingOrders, deliveredOrders, cancelledOrders, revenueToday, revenueWeek, revenueMonth, totalClients, totalDrivers, activeDrivers,] = await Promise.all([
            prisma_1.prisma.order.count(),
            prisma_1.prisma.order.count({ where: { status: 'PENDING' } }),
            prisma_1.prisma.order.count({ where: { status: 'DELIVERED' } }),
            prisma_1.prisma.order.count({ where: { status: 'CANCELLED' } }),
            prisma_1.prisma.order.aggregate({ where: { createdAt: { gte: todayStart }, status: { not: 'CANCELLED' } }, _sum: { totalPrice: true } }),
            prisma_1.prisma.order.aggregate({ where: { createdAt: { gte: weekStart }, status: { not: 'CANCELLED' } }, _sum: { totalPrice: true } }),
            prisma_1.prisma.order.aggregate({ where: { createdAt: { gte: monthStart }, status: { not: 'CANCELLED' } }, _sum: { totalPrice: true } }),
            prisma_1.prisma.user.count({ where: { role: 'CLIENT', isActive: true } }),
            prisma_1.prisma.user.count({ where: { role: 'DRIVER' } }),
            prisma_1.prisma.user.count({ where: { role: 'DRIVER', isActive: true } }),
        ]);
        return res.json({
            totalOrders,
            pendingOrders,
            deliveredOrders,
            cancelledOrders,
            revenueToday: revenueToday._sum.totalPrice || 0,
            revenueWeek: revenueWeek._sum.totalPrice || 0,
            revenueMonth: revenueMonth._sum.totalPrice || 0,
            totalClients,
            totalDrivers,
            activeDrivers,
        });
    }
    catch {
        return res.status(500).json({ error: 'Failed to fetch dashboard stats' });
    }
});
// GET /api/analytics/charts
router.get('/charts', auth_1.authenticate, (0, auth_1.requireRole)('ADMIN'), async (req, res) => {
    try {
        // Revenue over last 30 days
        const days = 30;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const revenueByDay = await prisma_1.prisma.$queryRaw `
      SELECT 
        DATE("createdAt") as day,
        SUM("totalPrice") as revenue
      FROM orders
      WHERE "createdAt" >= ${startDate} AND status != 'CANCELLED'
      GROUP BY DATE("createdAt")
      ORDER BY day ASC
    `;
        // Orders by status
        const ordersByStatus = await prisma_1.prisma.order.groupBy({
            by: ['status'],
            _count: { status: true },
        });
        // Top drivers by deliveries
        const topDrivers = await prisma_1.prisma.user.findMany({
            where: { role: 'DRIVER' },
            select: {
                id: true, name: true,
                driverOrders: { where: { status: 'DELIVERED' }, select: { id: true, totalPrice: true } },
                driverEarnings: { select: { amount: true } },
            },
            take: 10,
        });
        const topDriversFormatted = topDrivers
            .map(d => ({
            id: d.id,
            name: d.name,
            deliveries: d.driverOrders.length,
            earnings: d.driverEarnings.reduce((sum, e) => sum + e.amount, 0),
        }))
            .sort((a, b) => b.deliveries - a.deliveries)
            .slice(0, 5);
        // Orders by delivery type
        const ordersByType = await prisma_1.prisma.order.groupBy({
            by: ['deliveryType'],
            _count: { deliveryType: true },
        });
        return res.json({
            revenueByDay,
            ordersByStatus: ordersByStatus.map(s => ({ status: s.status, count: s._count.status })),
            topDrivers: topDriversFormatted,
            ordersByType: ordersByType.map(t => ({ type: t.deliveryType, count: t._count.deliveryType })),
        });
    }
    catch (err) {
        return res.status(500).json({ error: err.message || 'Failed to fetch chart data' });
    }
});
exports.default = router;
