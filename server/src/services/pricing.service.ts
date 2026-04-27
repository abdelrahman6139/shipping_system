import { DeliveryType } from '@prisma/client';
import { prisma } from '../lib/prisma';

interface PriceInput {
  weight: number;
  length: number;
  width: number;
  height: number;
  deliveryType: DeliveryType;
  zoneId: string;
}

export async function calculatePrice(input: PriceInput): Promise<number> {
  const zone = await prisma.zone.findUnique({
    where: { id: input.zoneId },
    include: { pricingRule: true },
  });

  if (!zone) throw new Error('Zone not found');
  if (!zone.pricingRule) throw new Error('No pricing rule for this zone');

  const rule = zone.pricingRule;

  // Base price + weight charge
  let price = zone.basePrice + input.weight * rule.pricePerKg;

  // Volume calculation (cubic weight factor)
  const volume = input.length * input.width * input.height;
  const volumeWeight = volume / 5000; // standard DIM factor
  const chargeableWeight = Math.max(input.weight, volumeWeight);
  price = zone.basePrice + chargeableWeight * rule.pricePerKg;

  // Apply delivery type multiplier
  let multiplier = rule.standardMultiplier;
  if (input.deliveryType === 'EXPRESS') multiplier = rule.expressMultiplier;
  if (input.deliveryType === 'SAME_DAY') multiplier = rule.sameDayMultiplier;

  price *= multiplier;

  return Math.round(price * 100) / 100;
}

export async function getDriverEarningAmount(
  orderPrice: number,
  driverId: string,
  zoneId?: string
): Promise<{ amount: number; commissionType: string; commissionValue: number }> {
  // If zoneId provided, check if the zone has a fixed driver payout
  if (zoneId) {
    const zone = await prisma.zone.findUnique({
      where: { id: zoneId },
      include: { pricingRule: true },
    });
    if (zone?.pricingRule?.driverPayout != null) {
      return {
        amount:          Math.round(zone.pricingRule.driverPayout * 100) / 100,
        commissionType:  'ZONE_FIXED',
        commissionValue: zone.pricingRule.driverPayout,
      };
    }
  }

  // Fall back to driver's global commission
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
