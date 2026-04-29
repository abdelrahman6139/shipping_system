import { DeliveryType } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { getCache, setCache, TTL } from '../utils/cache';

interface PriceInput {
  deliveryType: DeliveryType;
  zoneId: string;
}

export async function calculatePrice(input: PriceInput): Promise<number> {
  const cacheKey = `pricing:zone:${input.zoneId}`;
  let zone = getCache<any>(cacheKey);
  if (!zone) {
    zone = await prisma.zone.findUnique({
      where: { id: input.zoneId },
      include: { pricingRule: true },
    });
    setCache(cacheKey, zone, TTL.staticData);
  }

  if (!zone) throw new Error('المنطقة غير موجودة');
  if (!zone.pricingRule) throw new Error('لا توجد قاعدة تسعير لهذه المنطقة');

  const rule = zone.pricingRule;

  let price: number;
  if (input.deliveryType === 'EXPRESS') {
    price = rule.expressPrice;
  } else if (input.deliveryType === 'SAME_DAY') {
    price = rule.sameDayPrice;
  } else {
    price = rule.standardPrice;
  }

  return Math.round(price * 100) / 100;
}

export async function getDriverEarningAmount(
  orderPrice: number,
  driverId: string,
  zoneId?: string
): Promise<{ amount: number; commissionType: string; commissionValue: number }> {
  if (zoneId) {
    const cacheKey = `pricing:zone:${zoneId}`;
    let zone = getCache<any>(cacheKey);
    if (!zone) {
      zone = await prisma.zone.findUnique({
        where: { id: zoneId },
        include: { pricingRule: true },
      });
      setCache(cacheKey, zone, TTL.staticData);
    }
    if (zone?.pricingRule?.driverPayout != null) {
      return {
        amount:          Math.round(zone.pricingRule.driverPayout * 100) / 100,
        commissionType:  'ZONE_FIXED',
        commissionValue: zone.pricingRule.driverPayout,
      };
    }
  }

  const driver = await prisma.user.findUnique({ where: { id: driverId } });
  const type   = driver?.commissionType  ?? 'PERCENTAGE';
  const value  = driver?.commissionValue ?? 15;

  let amount: number;
  if (type === 'FIXED') {
    amount = value;
  } else {
    amount = orderPrice * (value / 100);
  }

  return {
    amount:          Math.round(amount * 100) / 100,
    commissionType:  type,
    commissionValue: value,
  };
}
