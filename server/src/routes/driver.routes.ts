import { Router } from 'express';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';

const router = Router();

// GET /api/driver/earnings
router.get('/earnings', authenticate, requireRole('DRIVER'), async (req: AuthRequest, res) => {
  try {
    const driverId = req.user!.userId;
    const period = typeof req.query.period === 'string' ? req.query.period : undefined;

    const now = new Date();
    let startDate: Date | undefined;

    if (period === 'day') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (period === 'week') {
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
    } else if (period === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const where: any = { driverId };
    if (startDate) where.date = { gte: startDate };

    const earnings = await prisma.driverEarning.findMany({
      where,
      include: {
        order: {
          include: { client: { select: { name: true } }, zone: true },
        },
      },
      orderBy: { date: 'desc' },
    });

    const totalDriverEarning  = earnings.reduce((sum, e) => sum + e.amount, 0);
    const totalOrderValue     = earnings.reduce((sum, e) => sum + (e.orderTotal || 0), 0);
    const totalCompanyProfit  = earnings.reduce((sum, e) => sum + (e.companyProfit || 0), 0);
    const deliveriesCount     = earnings.length;
    const averageEarning      = deliveriesCount > 0 ? totalDriverEarning / deliveriesCount : 0;

    // Group by day for chart using stable YYYY-MM-DD keys.
    const byDayMap = earnings.reduce((acc: Record<string, { driverEarning: number; orderTotal: number }>, e) => {
      const day = new Date(e.date).toISOString().slice(0, 10);
      if (!acc[day]) acc[day] = { driverEarning: 0, orderTotal: 0 };
      acc[day].driverEarning += e.amount;
      acc[day].orderTotal    += e.orderTotal || 0;
      return acc;
    }, {});

    const byDay = Object.entries(byDayMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, driverEarning: v.driverEarning, orderTotal: v.orderTotal }));

    const bestDay = byDay.reduce<{ date: string; driverEarning: number } | null>((best, item) => {
      if (!best || item.driverEarning > best.driverEarning) return item;
      return best;
    }, null);

    return res.json({
      earnings,
      total: Math.round(totalDriverEarning * 100) / 100,
      byDay,
      summary: {
        deliveriesCount,
        totalOrderValue:    Math.round(totalOrderValue    * 100) / 100,
        totalDriverEarning: Math.round(totalDriverEarning * 100) / 100,
        totalCompanyProfit: Math.round(totalCompanyProfit * 100) / 100,
        averageEarning:     Math.round(averageEarning     * 100) / 100,
        bestDay,
      },
    });
  } catch {
    return res.status(500).json({ error: 'Failed to fetch earnings' });
  }
});

// GET /api/driver/stats
router.get('/stats', authenticate, requireRole('DRIVER'), async (req: AuthRequest, res) => {
  try {
    const driverId = req.user!.userId;

    const [totalDeliveries, pendingDeliveries, totalEarnings] = await Promise.all([
      prisma.order.count({ where: { driverId, status: { in: ['DELIVERED', 'COLLECTED'] } } }),
      prisma.order.count({ where: { driverId, status: { in: ['ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'] } } }),
      prisma.driverEarning.aggregate({ where: { driverId }, _sum: { amount: true } }),
    ]);

    return res.json({
      totalDeliveries,
      pendingDeliveries,
      totalEarnings: totalEarnings._sum.amount || 0,
    });
  } catch {
    return res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;
