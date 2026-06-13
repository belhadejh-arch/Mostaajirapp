import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { api } from '@/api/client';
import type { Product, Rental, RentalStatus, Dispute, DisputeParty, DisputeStatus } from '@/types';
import { CATEGORIES } from '@/constants/categories';

const calcCommission = (rentalPrice: number, days: number, commissionRate: number) => {
  const gross = rentalPrice * days;
  const commission = Math.round(gross * (commissionRate / 100));
  return { gross, commission, net: gross - commission };
};

interface DataContextType {
  products: Product[];
  rentals: Rental[];
  disputes: Dispute[];
  getTopRated: (limit?: number) => Product[];
  getMostRented: (limit?: number) => Product[];
  getNewArrivals: (limit?: number) => Product[];
  getNearby: (wilayaCode: number, limit?: number) => Product[];
  getProductById: (id: string) => Product | undefined;
  getCategoryName: (categoryId: string, lang: 'ar' | 'en' | 'fr') => string;
  addProduct: (data: Omit<Product, 'id' | 'totalRentals' | 'rating' | 'reviewCount' | 'ownerRating' | 'ownerReviewCount' | 'ownerTotalRentals' | 'createdAt'>) => Promise<void>;
  updateProduct: (productId: string, updates: Partial<Product>) => Promise<void>;
  toggleHideProduct: (productId: string) => Promise<void>;
  deleteProduct: (productId: string) => Promise<void>;
  createRental: (params: { productId: string; durationDays: number; renterId: string; renterName: string; renterPhone: string; renterAddress: string; renterWilaya: string; selfPickup: boolean; }) => Promise<string>;
  updateRentalStatus: (rentalId: string, status: RentalStatus) => Promise<void>;
  acceptRental: (rentalId: string) => Promise<void>;
  rejectRental: (rentalId: string) => Promise<void>;
  startDelivery: (rentalId: string) => Promise<void>;
  completeReturn: (rentalId: string) => Promise<void>;
  requestExtension: (rentalId: string, days: number) => Promise<void>;
  acceptExtension: (rentalId: string) => Promise<void>;
  rejectExtension: (rentalId: string) => Promise<void>;
  scanHandover: (token: string, lessorId: string) => Promise<{ success: boolean; message: string }>;
  scanReturn: (token: string, lessorId: string) => Promise<{ success: boolean; message: string }>;
  getOwnerStats: (ownerId: string) => { products: number; rentals: number; totalEarnings: number; monthlyEarnings: number; available: number; rented: number };
  getRenterStats: (renterId: string) => { totalOrders: number; totalRentals: number; totalExpenses: number; frozenDeposits: number };
  fileDispute: (params: { rentalId: string; filedBy: DisputeParty; userId: string; userName: string; userPhone: string; title: string; description: string; }) => Promise<string>;
  updateDisputeStatus: (disputeId: string, status: DisputeStatus, adminNotes?: string) => Promise<void>;
  getDisputesByRental: (rentalId: string) => Dispute[];
  rateOwner: (params: { ownerId: string; renterId: string; rentalId: string; rating: number; comment?: string }) => Promise<void>;
  refreshData: () => Promise<void>;
}

const DataContext = createContext<DataContextType | null>(null);

function rowToProduct(row: Record<string, unknown>): Product {
  return {
    id: row.id as string,
    title: (row.title as string) || '',
    description: (row.description as string) || '',
    images: Array.isArray(row.images) ? (row.images as string[]) : [],
    videoUri: row.video_uri as string | undefined,
    categoryId: (row.category_id as string) || '',
    subcategoryId: (row.subcategory_id as string) || '',
    wilayaCode: (row.wilaya_code as number) || 16,
    wilayaName: (row.wilaya_name as string) || '',
    purchasePrice: (row.purchase_price as number) || 0,
    purchaseYear: (row.purchase_year as number) || 2020,
    rentalPrice: (row.rental_price as number) || 0,
    deposit: (row.deposit as number) || 0,
    commissionRate: (row.commission_rate as number) || 10,
    deliveryAvailable: (row.delivery_available as boolean) || false,
    status: (row.status as Product['status']) || 'available',
    stockQuantity: (row.stock_quantity as number) || 1,
    availableQuantity: (row.available_quantity as number) || 1,
    isHidden: (row.is_hidden as boolean) || false,
    isFrozen: (row.is_frozen as boolean) || false,
    removalReason: row.removal_reason as string | undefined,
    reviewStatus: (row.review_status as Product['reviewStatus']) || 'pending',
    rejectionReason: row.rejection_reason as string | undefined,
    ownerId: (row.owner_id as string) || '',
    ownerName: (row.owner_name as string) || '',
    ownerAvatarUri: row.owner_avatar_uri as string | undefined,
    ownerPhone: row.owner_phone as string | undefined,
    ownerAddress: row.owner_address as string | undefined,
    ownerWilayaCode: (row.owner_wilaya_code as number) || undefined,
    ownerWilayaName: row.owner_wilaya_name as string | undefined,
    ownerRating: (row.owner_rating as number) || 0,
    ownerReviewCount: (row.owner_review_count as number) || 0,
    ownerTotalRentals: (row.owner_total_rentals as number) || 0,
    totalRentals: (row.total_rentals as number) || 0,
    rating: (row.rating as number) || 0,
    reviewCount: (row.review_count as number) || 0,
    createdAt: (row.created_at as string) || new Date().toISOString(),
  };
}

function rowToRental(row: Record<string, unknown>): Rental {
  return {
    id: row.id as string,
    productId: (row.product_id as string) || '',
    productTitle: (row.product_title as string) || '',
    productImage: row.product_image as string | undefined,
    ownerId: (row.owner_id as string) || '',
    ownerName: (row.owner_name as string) || '',
    renterId: (row.renter_id as string) || '',
    renterName: (row.renter_name as string) || '',
    renterPhone: (row.renter_phone as string) || '',
    renterAddress: (row.renter_address as string) || '',
    renterWilaya: (row.renter_wilaya as string) || '',
    selfPickup: (row.self_pickup as boolean) || false,
    startTime: row.start_time as string | undefined,
    endTime: row.end_time as string | undefined,
    durationDays: (row.duration_days as number) || 1,
    dailyRate: (row.daily_rate as number) || 0,
    deposit: (row.deposit as number) || 0,
    commissionAmount: (row.commission_amount as number) || 0,
    netEarnings: (row.net_earnings as number) || 0,
    totalAmount: (row.total_amount as number) || 0,
    escrowAmount: (row.escrow_amount as number) || 0,
    latePenalty: (row.late_penalty as number) || 0,
    status: (row.status as RentalStatus) || 'pending_owner',
    qrCodeDelivery: (row.qr_code_delivery as string) || '',
    qrCodeReturn: (row.qr_code_return as string) || '',
    handoverToken: (row.handover_token as string) || undefined,
    returnToken: (row.return_token as string) || undefined,
    extensionRequested: (row.extension_requested as boolean) || false,
    extensionDays: row.extension_days as number | undefined,
    createdAt: (row.created_at as string) || new Date().toISOString(),
  };
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [pData, rData] = await Promise.all([
        api.get<Record<string, unknown>[]>('/products'),
        api.get<Record<string, unknown>[]>('/rentals').catch(() => [] as Record<string, unknown>[]),
      ]);
      setProducts(pData.map(rowToProduct));
      setRentals(rData.map(rowToRental));
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    loadData();
    pollRef.current = setInterval(loadData, 30_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [loadData]);

  const getTopRated = useCallback((limit = 8) =>
    [...products].filter(p => p.reviewStatus === 'approved' && !p.isFrozen && !p.isHidden).sort((a, b) => b.rating - a.rating).slice(0, limit), [products]);

  const getMostRented = useCallback((limit = 8) =>
    [...products].filter(p => p.reviewStatus === 'approved' && !p.isFrozen && !p.isHidden).sort((a, b) => b.totalRentals - a.totalRentals).slice(0, limit), [products]);

  const getNewArrivals = useCallback((limit = 8) =>
    [...products].filter(p => p.reviewStatus === 'approved' && !p.isFrozen && !p.isHidden).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, limit), [products]);

  const getNearby = useCallback((wilayaCode: number, limit = 6) =>
    products.filter(p => p.reviewStatus === 'approved' && p.wilayaCode === wilayaCode && !p.isFrozen && !p.isHidden).slice(0, limit), [products]);

  const getProductById = useCallback((id: string) => products.find(p => p.id === id), [products]);

  const getCategoryName = useCallback((categoryId: string, lang: 'ar' | 'en' | 'fr') => {
    const cat = CATEGORIES.find(c => c.id === categoryId);
    return cat ? cat[lang] : categoryId;
  }, []);

  const addProduct = useCallback(async (data: Omit<Product, 'id' | 'totalRentals' | 'rating' | 'reviewCount' | 'ownerRating' | 'ownerReviewCount' | 'ownerTotalRentals' | 'createdAt'>) => {
    const row = await api.post<Record<string, unknown>>('/products', {
      owner_id: data.ownerId, owner_name: data.ownerName, owner_avatar_uri: data.ownerAvatarUri || null,
      owner_phone: data.ownerPhone || null, owner_address: data.ownerAddress || null,
      owner_wilaya_code: data.ownerWilayaCode || null, owner_wilaya_name: data.ownerWilayaName || null,
      title: data.title, description: data.description, images: data.images, video_uri: data.videoUri || null,
      category_id: data.categoryId, subcategory_id: data.subcategoryId, wilaya_code: data.wilayaCode,
      wilaya_name: data.wilayaName, purchase_price: data.purchasePrice, purchase_year: data.purchaseYear,
      rental_price: data.rentalPrice, deposit: data.deposit, commission_rate: data.commissionRate,
      delivery_available: data.deliveryAvailable, stock_quantity: data.stockQuantity ?? 1,
    });
    setProducts(prev => [rowToProduct(row), ...prev]);
  }, []);

  const updateProduct = useCallback(async (productId: string, updates: Partial<Product>) => {
    const body: Record<string, unknown> = {};
    if (updates.title !== undefined) body.title = updates.title;
    if (updates.description !== undefined) body.description = updates.description;
    if (updates.images !== undefined) body.images = updates.images;
    if (updates.deliveryAvailable !== undefined) body.delivery_available = updates.deliveryAvailable;
    if (updates.isHidden !== undefined) body.is_hidden = updates.isHidden;
    if (updates.isFrozen !== undefined) body.is_frozen = updates.isFrozen;
    if (updates.removalReason !== undefined) body.removal_reason = updates.removalReason;
    if (updates.reviewStatus !== undefined) body.review_status = updates.reviewStatus;
    if (updates.rejectionReason !== undefined) body.rejection_reason = updates.rejectionReason;
    if (updates.status !== undefined) body.status = updates.status;
    if (updates.availableQuantity !== undefined) body.available_quantity = updates.availableQuantity;
    if (Object.keys(body).length > 0) await api.put(`/products/${productId}`, body);
    setProducts(prev => prev.map(p => p.id === productId ? { ...p, ...updates } : p));
  }, []);

  const toggleHideProduct = useCallback(async (productId: string) => {
    const prod = products.find(p => p.id === productId);
    if (!prod) return;
    await api.put(`/products/${productId}`, { is_hidden: !prod.isHidden });
    setProducts(prev => prev.map(p => p.id === productId ? { ...p, isHidden: !p.isHidden } : p));
  }, [products]);

  const deleteProduct = useCallback(async (productId: string) => {
    await api.delete(`/products/${productId}`);
    setProducts(prev => prev.filter(p => p.id !== productId));
  }, []);

  const createRental = useCallback(async (params: { productId: string; durationDays: number; renterId: string; renterName: string; renterPhone: string; renterAddress: string; renterWilaya: string; selfPickup: boolean; }): Promise<string> => {
    const product = products.find(p => p.id === params.productId);
    if (!product) return '';
    const { gross, commission, net } = calcCommission(product.rentalPrice, params.durationDays, product.commissionRate);
    const totalAmount = gross + product.deposit;
    const rentalId = crypto.randomUUID();
    const handoverToken = crypto.randomUUID();
    const returnToken = crypto.randomUUID();
    try {
      const row = await api.post<Record<string, unknown>>('/rentals', {
        id: rentalId, product_id: product.id, product_title: product.title,
        product_image: product.images[0] || null,
        owner_id: product.ownerId, owner_name: product.ownerName,
        renter_id: params.renterId, renter_name: params.renterName,
        renter_phone: params.renterPhone, renter_address: params.renterAddress,
        renter_wilaya: params.renterWilaya, self_pickup: params.selfPickup,
        duration_days: params.durationDays, daily_rate: product.rentalPrice,
        deposit: product.deposit, commission_amount: commission, net_earnings: net,
        total_amount: totalAmount, handover_token: handoverToken, return_token: returnToken,
      });
      setRentals(prev => [rowToRental(row), ...prev]);
      setProducts(prev => prev.map(p => p.id === product.id
        ? { ...p, availableQuantity: Math.max(0, p.availableQuantity - 1), status: p.availableQuantity - 1 <= 0 ? 'rented' : 'available' }
        : p
      ));
      return rentalId;
    } catch { return ''; }
  }, [products]);

  const patchRental = useCallback(async (rentalId: string, body: Record<string, unknown>) => {
    const row = await api.put<Record<string, unknown>>(`/rentals/${rentalId}/status`, body);
    setRentals(prev => prev.map(r => r.id === rentalId ? rowToRental(row) : r));
  }, []);

  const updateRentalStatus = useCallback((rentalId: string, status: RentalStatus) => patchRental(rentalId, { status }), [patchRental]);
  const acceptRental = useCallback((rentalId: string) => patchRental(rentalId, { status: 'accepted' }), [patchRental]);
  const rejectRental = useCallback((rentalId: string) => patchRental(rentalId, { status: 'cancelled', escrow_amount: 0 }), [patchRental]);
  const startDelivery = useCallback((rentalId: string) => patchRental(rentalId, { status: 'active', start_time: new Date().toISOString() }), [patchRental]);

  const completeReturn = useCallback(async (rentalId: string) => {
    const rental = rentals.find(r => r.id === rentalId);
    if (!rental) return;
    let latePenalty = 0;
    if (rental.startTime) {
      const expectedEnd = new Date(rental.startTime).getTime() + rental.durationDays * 24 * 3600000;
      if (Date.now() > expectedEnd) latePenalty = Math.ceil((Date.now() - expectedEnd) / 3600000) * 150;
    }
    await patchRental(rentalId, { status: 'completed', end_time: new Date().toISOString(), late_penalty: latePenalty, escrow_amount: 0 });
    const prod = products.find(p => p.id === rental.productId);
    if (prod) {
      const newAvail = Math.min(prod.stockQuantity, prod.availableQuantity + 1);
      await api.put(`/products/${prod.id}`, { available_quantity: newAvail, status: newAvail > 0 ? 'available' : 'rented' });
      setProducts(prev => prev.map(p => p.id === prod.id ? { ...p, availableQuantity: newAvail, status: newAvail > 0 ? 'available' : 'rented' } : p));
    }
  }, [rentals, products, patchRental]);

  const requestExtension = useCallback((rentalId: string, days: number) =>
    patchRental(rentalId, { status: 'extend_requested', extension_requested: true, extension_days: days }), [patchRental]);

  const acceptExtension = useCallback(async (rentalId: string) => {
    const rental = rentals.find(r => r.id === rentalId);
    if (!rental) return;
    const addDays = rental.extensionDays || 0;
    const newDuration = rental.durationDays + addDays;
    const newTotal = rental.totalAmount + rental.dailyRate * addDays;
    await patchRental(rentalId, { status: 'active', duration_days: newDuration, total_amount: newTotal, extension_requested: false, extension_days: null });
  }, [rentals, patchRental]);

  const rejectExtension = useCallback((rentalId: string) =>
    patchRental(rentalId, { status: 'active', extension_requested: false }), [patchRental]);

  const scanHandover = useCallback(async (token: string, lessorId: string) => {
    try {
      const data = await api.post<{ success: boolean; message: string; rental?: Record<string, unknown> }>('/rentals/handover-scan', { token, lessorId });
      if (data.rental) setRentals(prev => prev.map(r => r.id === (data.rental as Record<string, unknown>).id ? rowToRental(data.rental as Record<string, unknown>) : r));
      return { success: data.success, message: data.message };
    } catch (e: unknown) {
      return { success: false, message: (e as Error).message };
    }
  }, []);

  const scanReturn = useCallback(async (token: string, lessorId: string) => {
    try {
      const data = await api.post<{ success: boolean; message: string; rental?: Record<string, unknown> }>('/rentals/return-scan', { token, lessorId });
      if (data.rental) setRentals(prev => prev.map(r => r.id === (data.rental as Record<string, unknown>).id ? rowToRental(data.rental as Record<string, unknown>) : r));
      return { success: data.success, message: data.message };
    } catch (e: unknown) {
      return { success: false, message: (e as Error).message };
    }
  }, []);

  const getOwnerStats = useCallback((ownerId: string) => {
    const ownerProducts = products.filter(p => p.ownerId === ownerId);
    const ownerRentals = rentals.filter(r => r.ownerId === ownerId && r.status === 'completed');
    const now = new Date(); const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    return {
      products: ownerProducts.length, rentals: ownerRentals.length,
      totalEarnings: ownerRentals.reduce((s, r) => s + r.netEarnings, 0),
      monthlyEarnings: ownerRentals.filter(r => r.endTime && new Date(r.endTime).getTime() > monthStart).reduce((s, r) => s + r.netEarnings, 0),
      available: ownerProducts.filter(p => p.status === 'available').length,
      rented: ownerProducts.filter(p => p.status === 'rented').length,
    };
  }, [products, rentals]);

  const getRenterStats = useCallback((renterId: string) => {
    const renterRentals = rentals.filter(r => r.renterId === renterId);
    const completed = renterRentals.filter(r => r.status === 'completed');
    const frozen = renterRentals.filter(r => ['pending_owner','accepted','pending_delivery','active'].includes(r.status)).reduce((s, r) => s + r.deposit, 0);
    return { totalOrders: renterRentals.length, totalRentals: completed.length, totalExpenses: completed.reduce((s, r) => s + r.totalAmount, 0), frozenDeposits: frozen };
  }, [rentals]);

  const fileDispute = useCallback(async (params: { rentalId: string; filedBy: DisputeParty; userId: string; userName: string; userPhone: string; title: string; description: string; }): Promise<string> => {
    const rental = rentals.find(r => r.id === params.rentalId);
    try {
      const row = await api.post<Record<string, unknown>>('/disputes', {
        rental_id: params.rentalId, product_title: rental?.productTitle || '',
        filed_by: params.filedBy, user_id: params.userId, user_name: params.userName,
        user_phone: params.userPhone, title: params.title, description: params.description,
      });
      setDisputes(prev => [{ id: row.id as string, rentalId: params.rentalId, productTitle: rental?.productTitle || '', filedBy: params.filedBy, userId: params.userId, userName: params.userName, userPhone: params.userPhone, title: params.title, description: params.description, status: 'open', createdAt: row.created_at as string }, ...prev]);
      return row.id as string;
    } catch { return ''; }
  }, [rentals]);

  const updateDisputeStatus = useCallback(async (disputeId: string, status: DisputeStatus, adminNotes?: string) => {
    await api.put(`/disputes/${disputeId}`, { status, admin_notes: adminNotes });
    setDisputes(prev => prev.map(d => d.id === disputeId ? { ...d, status, adminNotes, resolvedAt: ['resolved','rejected'].includes(status) ? new Date().toISOString() : d.resolvedAt } : d));
  }, []);

  const getDisputesByRental = useCallback((rentalId: string) => disputes.filter(d => d.rentalId === rentalId), [disputes]);

  const rateOwner = useCallback(async (params: { ownerId: string; renterId: string; rentalId: string; rating: number; comment?: string }) => {
    const profile = await api.post<Record<string, unknown>>('/ratings', params);
    if (profile) {
      setProducts(prev => prev.map(p => p.ownerId === params.ownerId
        ? { ...p, ownerRating: (profile.owner_rating as number) || 0, ownerReviewCount: (profile.owner_review_count as number) || 0 }
        : p
      ));
    }
  }, []);

  const refreshData = useCallback(() => loadData(), [loadData]);

  return (
    <DataContext.Provider value={{
      products, rentals, disputes,
      getTopRated, getMostRented, getNewArrivals, getNearby,
      getProductById, getCategoryName,
      addProduct, updateProduct, toggleHideProduct, deleteProduct,
      createRental, updateRentalStatus, acceptRental, rejectRental,
      startDelivery, completeReturn, requestExtension, acceptExtension, rejectExtension,
      scanHandover, scanReturn, getOwnerStats, getRenterStats,
      fileDispute, updateDisputeStatus, getDisputesByRental, rateOwner, refreshData,
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
