import type { Category } from '@/types';

export const CATEGORIES: Category[] = [
  {
    id: 'electronics', icon: '📱', ar: 'الإلكترونيات', en: 'Electronics', fr: 'Électronique',
    subcategories: [
      { id: 'phones', ar: 'هواتف', en: 'Phones', fr: 'Téléphones' },
      { id: 'laptops', ar: 'لابتوب', en: 'Laptops', fr: 'Ordinateurs' },
      { id: 'cameras', ar: 'كاميرات', en: 'Cameras', fr: 'Caméras' },
      { id: 'tablets', ar: 'أجهزة لوحية', en: 'Tablets', fr: 'Tablettes' },
    ],
  },
  {
    id: 'tools', icon: '🔧', ar: 'أدوات', en: 'Tools', fr: 'Outils',
    subcategories: [
      { id: 'power_tools', ar: 'أدوات كهربائية', en: 'Power Tools', fr: 'Outils électriques' },
      { id: 'hand_tools', ar: 'أدوات يدوية', en: 'Hand Tools', fr: 'Outils manuels' },
      { id: 'measuring', ar: 'أدوات قياس', en: 'Measuring Tools', fr: 'Outils de mesure' },
    ],
  },
  {
    id: 'vehicles', icon: '🚗', ar: 'مركبات', en: 'Vehicles', fr: 'Véhicules',
    subcategories: [
      { id: 'cars', ar: 'سيارات', en: 'Cars', fr: 'Voitures' },
      { id: 'motos', ar: 'دراجات نارية', en: 'Motorcycles', fr: 'Motos' },
      { id: 'bicycles', ar: 'دراجات هوائية', en: 'Bicycles', fr: 'Vélos' },
    ],
  },
  {
    id: 'sports', icon: '⚽', ar: 'رياضة', en: 'Sports', fr: 'Sports',
    subcategories: [
      { id: 'football', ar: 'كرة القدم', en: 'Football', fr: 'Football' },
      { id: 'fitness', ar: 'لياقة', en: 'Fitness', fr: 'Fitness' },
      { id: 'outdoor', ar: 'رياضة خارجية', en: 'Outdoor', fr: 'Plein air' },
    ],
  },
  {
    id: 'home', icon: '🏠', ar: 'منزل', en: 'Home', fr: 'Maison',
    subcategories: [
      { id: 'furniture', ar: 'أثاث', en: 'Furniture', fr: 'Meubles' },
      { id: 'appliances', ar: 'أجهزة منزلية', en: 'Appliances', fr: 'Électroménager' },
      { id: 'decor', ar: 'ديكور', en: 'Decor', fr: 'Décoration' },
    ],
  },
  {
    id: 'events', icon: '🎉', ar: 'فعاليات', en: 'Events', fr: 'Événements',
    subcategories: [
      { id: 'tents', ar: 'خيام', en: 'Tents', fr: 'Tentes' },
      { id: 'sound', ar: 'صوتيات', en: 'Sound System', fr: 'Sonorisation' },
      { id: 'chairs', ar: 'كراسي وطاولات', en: 'Chairs & Tables', fr: 'Chaises & Tables' },
    ],
  },
  {
    id: 'clothing', icon: '👗', ar: 'ملابس', en: 'Clothing', fr: 'Vêtements',
    subcategories: [
      { id: 'formal', ar: 'رسمي', en: 'Formal', fr: 'Formel' },
      { id: 'traditional', ar: 'تقليدي', en: 'Traditional', fr: 'Traditionnel' },
      { id: 'costumes', ar: 'أزياء', en: 'Costumes', fr: 'Costumes' },
    ],
  },
  {
    id: 'books', icon: '📚', ar: 'كتب', en: 'Books', fr: 'Livres',
    subcategories: [
      { id: 'textbooks', ar: 'كتب مدرسية', en: 'Textbooks', fr: 'Manuels scolaires' },
      { id: 'novels', ar: 'روايات', en: 'Novels', fr: 'Romans' },
    ],
  },
];

export function calculateRentalPrice(purchasePrice: number): number {
  // الفئات الست حسب سعر الشراء (دج)
  if (purchasePrice >= 500 && purchasePrice <= 19999) return 800;
  if (purchasePrice >= 20000 && purchasePrice <= 49999) return 1100;
  if (purchasePrice >= 50000 && purchasePrice <= 99999) return 2000;
  if (purchasePrice >= 100000 && purchasePrice <= 299999) return 2000;
  if (purchasePrice >= 300000 && purchasePrice <= 499999) return 2500;
  if (purchasePrice >= 500000 && purchasePrice <= 1000000) return 3500;
  return 800;
}

export function calculateDeposit(purchasePrice: number): number {
  if (purchasePrice >= 500 && purchasePrice <= 19999) return 1000;
  if (purchasePrice >= 20000 && purchasePrice <= 49999) return 2000;
  if (purchasePrice >= 50000 && purchasePrice <= 99999) return 0;
  if (purchasePrice >= 100000 && purchasePrice <= 299999) return 4000;
  if (purchasePrice >= 300000 && purchasePrice <= 499999) return 5000;
  if (purchasePrice >= 500000 && purchasePrice <= 1000000) return 10000;
  return 1000;
}

export function calculateCommissionRate(purchasePrice: number): number {
  if (purchasePrice >= 500 && purchasePrice <= 19999) return 0.10;
  if (purchasePrice >= 20000 && purchasePrice <= 49999) return 0.10;
  if (purchasePrice >= 50000 && purchasePrice <= 99999) return 0.15;
  if (purchasePrice >= 100000 && purchasePrice <= 299999) return 0.20;
  if (purchasePrice >= 300000 && purchasePrice <= 499999) return 0.20;
  if (purchasePrice >= 500000 && purchasePrice <= 1000000) return 0.30;
  return 0.10;
}
