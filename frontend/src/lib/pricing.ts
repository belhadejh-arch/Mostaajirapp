// نظام التسعير الآلي حسب فئات سعر الشراء
// All prices in DZD

export interface PricingTier {
  dailyRate: number;
  commissionRate: number;
  deposit: number;
  label: string;
}

export function calculatePricing(purchasePrice: number): PricingTier {
  if (purchasePrice >= 500 && purchasePrice <= 19_999) {
    return { dailyRate: 800, commissionRate: 10, deposit: 1_000, label: 'الفئة الأولى' };
  }
  if (purchasePrice >= 20_000 && purchasePrice <= 49_999) {
    return { dailyRate: 1_100, commissionRate: 10, deposit: 2_000, label: 'الفئة الثانية' };
  }
  if (purchasePrice >= 50_000 && purchasePrice <= 99_999) {
    return { dailyRate: 2_000, commissionRate: 15, deposit: 0, label: 'الفئة الثالثة' };
  }
  if (purchasePrice >= 100_000 && purchasePrice <= 299_999) {
    return { dailyRate: 2_000, commissionRate: 20, deposit: 4_000, label: 'الفئة الرابعة' };
  }
  if (purchasePrice >= 300_000 && purchasePrice <= 499_999) {
    return { dailyRate: 2_500, commissionRate: 20, deposit: 5_000, label: 'الفئة الخامسة' };
  }
  if (purchasePrice >= 500_000 && purchasePrice <= 1_000_000) {
    return { dailyRate: 3_500, commissionRate: 30, deposit: 10_000, label: 'الفئة السادسة' };
  }
  // Default fallback
  return { dailyRate: 800, commissionRate: 10, deposit: 1_000, label: 'افتراضي' };
}

/** جميع الفئات لعرضها للمستخدم */
export const PRICING_TIERS = [
  { min: 500, max: 19_999, dailyRate: 800, commissionRate: 10, deposit: 1_000, label: 'الفئة الأولى' },
  { min: 20_000, max: 49_999, dailyRate: 1_100, commissionRate: 10, deposit: 2_000, label: 'الفئة الثانية' },
  { min: 50_000, max: 99_999, dailyRate: 2_000, commissionRate: 15, deposit: 0, label: 'الفئة الثالثة' },
  { min: 100_000, max: 299_999, dailyRate: 2_000, commissionRate: 20, deposit: 4_000, label: 'الفئة الرابعة' },
  { min: 300_000, max: 499_999, dailyRate: 2_500, commissionRate: 20, deposit: 5_000, label: 'الفئة الخامسة' },
  { min: 500_000, max: 1_000_000, dailyRate: 3_500, commissionRate: 30, deposit: 10_000, label: 'الفئة السادسة' },
];
