/**
 * MOSTAJIR — Pricing Engine
 * Calculates rental fees, platform share, deposit, and owner payout
 * based on product purchase price category.
 */

/*
 * Deposit is paid ONLY by the RENTER and frozen in their frozen_balance.
 * It is returned to the renter after successful rental completion:
 *   - Renter can manually request withdrawal within 48h
 *   - Auto-released to renter's wallet_balance after 48h if not withdrawn
 */
const PRICE_TIERS = [
  { min: 500,    max: 19999,  rate24h: 800,  deposit: 1500,  commission: 0.10 },
  { min: 20000,  max: 49999,  rate24h: 1100, deposit: 2000,  commission: 0.10 },
  { min: 50000,  max: 99999,  rate24h: 2000, deposit: 3500,  commission: 0.15 },
  { min: 100000, max: 299999, rate24h: 2000, deposit: 4000,  commission: 0.20 },
  { min: 300000, max: 499999, rate24h: 2500, deposit: 5000,  commission: 0.20 },
  { min: 500000, max: 1000000,rate24h: 3500, deposit: 10000, commission: 0.30 },
];

/**
 * Get the pricing tier for a given product purchase price.
 */
function getTier(productPrice) {
  return PRICE_TIERS.find(t => productPrice >= t.min && productPrice <= t.max)
    || PRICE_TIERS[PRICE_TIERS.length - 1];
}

/**
 * Calculate rental details for a given product price and hours selected.
 * Hours must be multiples of 24 (1 day = 24h, ..., 30 days = 720h).
 *
 * @param {number} productPrice  - purchase price of the product
 * @param {number} hoursSelected - duration in hours (24, 48, ..., 720)
 * @returns {{
 *   durationHours: number,
 *   durationDays: number,
 *   totalRentalFee: number,
 *   depositAmount: number,
 *   platformFee: number,
 *   ownerShare: number,
 *   totalCharge: number,
 *   rate24h: number,
 *   commissionRate: number
 * }}
 */
function calculateRentalDetails(productPrice, hoursSelected) {
  const tier = getTier(productPrice);
  const days = hoursSelected / 24;
  const totalRentalFee = parseFloat((days * tier.rate24h).toFixed(2));
  const platformFee = parseFloat((totalRentalFee * tier.commission).toFixed(2));
  const ownerShare = parseFloat((totalRentalFee - platformFee).toFixed(2));
  const depositAmount = tier.deposit;
  const totalCharge = parseFloat((totalRentalFee + depositAmount).toFixed(2));

  return {
    durationHours: hoursSelected,
    durationDays: days,
    totalRentalFee,
    depositAmount,
    platformFee,
    ownerShare,
    totalCharge,
    rate24h: tier.rate24h,
    commissionRate: tier.commission,
  };
}

/**
 * Generate available hour options (24h increments, up to 720h / 30 days).
 */
function getHourOptions() {
  const options = [];
  for (let d = 1; d <= 30; d++) {
    options.push({ hours: d * 24, days: d, label: `${d} يوم (${d * 24} ساعة)` });
  }
  return options;
}

module.exports = { calculateRentalDetails, getTier, getHourOptions, PRICE_TIERS };
