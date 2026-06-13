import type React from 'react';

export interface Option {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string }>;
  withCount?: boolean;
}

export type Language = 'ar' | 'en' | 'fr';
export type VerificationStatus = 'none' | 'pending' | 'verified' | 'rejected';
export type ProductStatus = 'available' | 'rented';
export type ProductReviewStatus = 'pending' | 'approved' | 'rejected';
export type AccountStatus = 'active' | 'banned' | 'frozen';
export type RentalStatus = 'pending_owner' | 'accepted' | 'pending_delivery' | 'active' | 'completed' | 'cancelled' | 'extend_requested';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  address?: string;
  wilayaCode: number;
  wilayaName: string;
  verificationStatus: VerificationStatus;
  accountStatus?: AccountStatus;   // active | banned | frozen
  walletBalance: number;
  earningsBalance: number;
  frozenBalance: number;
  totalRentals: number;
  rating: number;
  reviewCount: number;
  isAdmin?: boolean;
  avatarUri?: string;
  idFrontUri?: string;
  idBackUri?: string;
  selfieUri?: string;
  kycRejectionReason?: string;   // سبب رفض التوثيق (يظهر للمستخدم)
}

export interface Product {
  id: string;
  title: string;
  description: string;
  images: string[];
  videoUri?: string;
  categoryId: string;
  subcategoryId: string;
  wilayaCode: number;
  wilayaName: string;
  purchasePrice: number;     // مخفي عن الزوار والمستأجرين
  purchaseYear: number;
  rentalPrice: number;
  deposit: number;
  commissionRate: number;    // مخفي عن العامة
  deliveryAvailable: boolean;
  status: ProductStatus;
  stockQuantity: number;     // إجمالي الكمية
  availableQuantity: number; // الكمية المتاحة
  isHidden?: boolean;        // إخفاء مؤقت من العرض العام
  isFrozen?: boolean;         // تجميد من الأدمن
  removalReason?: string;    // رسالة سبب الحذف من الأدمن
  reviewStatus: ProductReviewStatus; // حالة مراجعة المنتج (pending / approved / rejected)
  rejectionReason?: string;   // سبب رفض المنتج من الأدمن
  ownerId: string;
  ownerName: string;
  ownerAvatarUri?: string;
  ownerPhone?: string;     // مخفي عن الزوار — يظهر عند التأجير
  ownerAddress?: string;   // مخفي عن الزوار — يظهر عند التأجير
  ownerWilayaCode?: number;
  ownerWilayaName?: string;
  ownerRating: number;
  ownerReviewCount: number;
  ownerTotalRentals: number;
  totalRentals: number;
  rating: number;
  reviewCount: number;
  createdAt: string;
}

export interface Rental {
  id: string;
  productId: string;
  productTitle: string;
  productImage?: string;
  ownerId: string;
  ownerName: string;
  renterId: string;
  renterName: string;
  renterPhone: string;
  renterAddress: string;
  renterWilaya: string;
  selfPickup: boolean;
  startTime?: string;
  endTime?: string;
  durationDays: number;
  dailyRate: number;
  deposit: number;
  commissionAmount: number;
  netEarnings: number;
  totalAmount: number;
  escrowAmount: number;
  latePenalty: number;
  status: RentalStatus;
  qrCodeDelivery: string;
  qrCodeReturn: string;
  handoverToken?: string;
  returnToken?: string;
  createdAt: string;
  extensionRequested?: boolean;
  extensionDays?: number;
  alert48hSent?: boolean;    // تنبيه 48 ساعة أُرسل
}

export interface WithdrawalRequest {
  id: string;
  userId: string;
  userName: string;
  phone: string;
  ccpNumber: string;
  amount: number;
  status: 'pending' | 'processed' | 'rejected';
  createdAt: string;
}

export interface AdminSettings {
  logoUrl: string;
  commissionRates: { under20k: number; under50k: number; under100k: number; under300k: number; under500k: number; above500k: number };
  dailyPrices: { under20k: number; under50k: number; under100k: number; under300k: number; under500k: number; above500k: number };
  deposits: { under50k: number; under200k: number; above200k: number };
  latePenaltyPerHour: number;
  minWithdrawal: number;
  topUpAmounts: number[];
}

export type DisputeStatus = 'open' | 'under_review' | 'resolved' | 'rejected';
export type DisputeParty = 'owner' | 'renter';

export interface Dispute {
  id: string;
  rentalId: string;
  productTitle: string;
  filedBy: DisputeParty;
  // الطرف الذي قدّم النزاع
  userId: string;
  userName: string;
  userPhone: string;
  userAvatarUri?: string;
  // بيانات الطرف الآخر (للإدارة)
  otherPartyId?: string;
  otherPartyName?: string;
  otherPartyPhone?: string;
  otherPartyAvatarUri?: string;
  title: string;
  description: string;
  status: DisputeStatus;
  adminNotes?: string;
  createdAt: string;
  resolvedAt?: string;
}

export type KycStatus = 'pending' | 'approved' | 'rejected';

export interface KycRequest {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  userAvatarUri?: string;
  idFrontUri: string;
  idBackUri: string;
  selfieUri: string;
  status: KycStatus;
  rejectionReason?: string;
  createdAt: string;
  reviewedAt?: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: 'general' | 'rental' | 'kyc' | 'product' | 'admin' | 'reminder';
  read: boolean;
  createdAt: string;
}

export interface Category {
  id: string;
  icon: string;
  ar: string;
  en: string;
  fr: string;
  subcategories: { id: string; ar: string; en: string; fr: string }[];
}
