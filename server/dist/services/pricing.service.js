"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculatePrice = calculatePrice;
exports.getDriverEarningAmount = getDriverEarningAmount;
const prisma_1 = require("../lib/prisma");
async function calculatePrice(input) {
    const zone = await prisma_1.prisma.zone.findUnique({
        where: { id: input.zoneId },
        include: { pricingRule: true },
    });
    if (!zone)
        throw new Error('Zone not found');
    if (!zone.pricingRule)
        throw new Error('No pricing rule for this zone');
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
    if (input.deliveryType === 'EXPRESS')
        multiplier = rule.expressMultiplier;
    if (input.deliveryType === 'SAME_DAY')
        multiplier = rule.sameDayMultiplier;
    price *= multiplier;
    return Math.round(price * 100) / 100;
}
async function getDriverEarningAmount(orderPrice) {
    // Driver earns 15% commission
    return Math.round(orderPrice * 0.15 * 100) / 100;
}
