import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { supabase } from '@/db/supabase';
import type { Product, Rental, RentalStatus, Dispute, DisputeParty, DisputeStatus } from '@/types';
import { CATEGORIES, calculateRentalPrice, calculateDeposit, calculateCommissionRate } from '@/constants/categories';

// دالة حساب العمولة والصافي
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
  createRental: (params: {
    productId: string; durationDays: number;
    renterId: string; renterName: string; renterPhone: string;
    renterAddress: string; renterWilaya: string; selfPickup: boolean;
  }) => Promise<string>;
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
  fileDispute: (params: {
    rentalId: string; filedBy: DisputeParty; userId: string;
    userName: string; userPhone: string; title: string; description: string;
  }) => Promise<string>;
  updateDisputeStatus: (disputeId: string, status: DisputeStatus, adminNotes?: string) => Promise<void>;
  getDisputesByRental: (rentalId: string) => Dispute[];
  rateOwner: (params: { ownerId: string; renterId: string; rentalId: string; rating: number; comment?: string }) => Promise<void>;
}

const DataContext = createContext<DataContextType | null>(null);

// تحويل صف products من Supabase إلى Product
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

// تحويل صف rentals
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

  // ── جلب البيانات الأولية ──
  useEffect(() => {
    async function loadData() {
      const [{ data: pData }, { data: rData }] = await Promise.all([
        supabase.from('products').select('*').order('created_at', { ascending: false }),
        supabase.from('rentals').select('*').order('created_at', { ascending: false }),
      ]);
      if (pData) setProducts(pData.map(rowToProduct));
      if (rData) setRentals(rData.map(rowToRental));
    }
    loadData();
  }, []);

  // ── Realtime: منتجات ──
  useEffect(() => {
    const channel = supabase.channel('data-products')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, payload => {
        if (payload.eventType === 'DELETE') {
          setProducts(prev => prev.filter(p => p.id !== (payload.old as Record<string, unknown>).id));
          return;
        }
        const row = payload.new as Record<string, unknown>;
        if (!row?.id) return;
        const prod = rowToProduct(row);
        setProducts(prev => {
          const idx = prev.findIndex(p => p.id === prod.id);
          if (idx >= 0) { const n = [...prev]; n[idx] = prod; return n; }
          return [prod, ...prev];
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);


  const getTopRated = useCallback((limit = 8) =>
    [...products].filter(p => p.reviewStatus === 'approved' && !p.isFrozen && !p.isHidden).sort((a, b) => b.rating - a.rating).slice(0, limit), [products]);

  const getMostRented = useCallback((limit = 8) =>
    [...products].filter(p => p.reviewStatus === 'approved' && !p.isFrozen && !p.isHidden).sort((a, b) => b.totalRentals - a.totalRentals).slice(0, limit), [products]);

  const getNewArrivals = useCallback((limit = 8) =>
    [...products].filter(p => p.reviewStatus === 'approved' && !p.isFrozen && !p.isHidden).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, limit), [products]);

  const getNearby = useCallback((wilayaCode: number, limit = 6) =>
    products.filter(p => p.reviewStatus === 'approved' && p.wilayaCode === wilayaCode && !p.isFrozen && !p.isHidden).slice(0, limit), [products]);

  const getProductById = useCallback((id: string) =>
    products.find(p => p.id === id), [products]);

  const getCategoryName = useCallback((categoryId: string, lang: 'ar' | 'en' | 'fr') => {
    const cat = CATEGORIES.find(c => c.id === categoryId);
    return cat ? cat[lang] : categoryId;
  }, []);

  const addProduct = useCallback(async (
    data: Omit<Product, 'id' | 'totalRentals' | 'rating' | 'reviewCount' | 'ownerRating' | 'ownerReviewCount' | 'ownerTotalRentals' | 'createdAt'>
  ) => {
    await supabase.from('products').insert({
      owner_id: data.ownerId,
      owner_name: data.ownerName,
      owner_avatar_uri: data.ownerAvatarUri || null,
      owner_phone: data.ownerPhone || null,
      owner_address: data.ownerAddress || null,
      owner_wilaya_code: data.ownerWilayaCode || null,
      owner_wilaya_name: data.ownerWilayaName || null,
      title: data.title,
      description: data.description,
      images: data.images,
      video_uri: data.videoUri || null,
      category_id: data.categoryId,
      subcategory_id: data.subcategoryId,
      wilaya_code: data.wilayaCode,
      wilaya_name: data.wilayaName,
      purchase_price: data.purchasePrice,
      purchase_year: data.purchaseYear,
      rental_price: data.rentalPrice,
      deposit: data.deposit,
      commission_rate: data.commissionRate,
      delivery_available: data.deliveryAvailable,
      stock_quantity: data.stockQuantity ?? 1,
      available_quantity: data.stockQuantity ?? 1,
      review_status: 'pending',
    });
    // Realtime يُحدّث الحالة تلقائياً
  }, []);

  const updateProduct = useCallback(async (productId: string, updates: Partial<Product>) => {
    const dbUpdates: Record<string, unknown> = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.images !== undefined) dbUpdates.images = updates.images;
    if (updates.deliveryAvailable !== undefined) dbUpdates.delivery_available = updates.deliveryAvailable;
    if (updates.isHidden !== undefined) dbUpdates.is_hidden = updates.isHidden;
    if (updates.isFrozen !== undefined) dbUpdates.is_frozen = updates.isFrozen;
    if (updates.removalReason !== undefined) dbUpdates.removal_reason = updates.removalReason;
    if (updates.reviewStatus !== undefined) dbUpdates.review_status = updates.reviewStatus;
    if (updates.rejectionReason !== undefined) dbUpdates.rejection_reason = updates.rejectionReason;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.availableQuantity !== undefined) dbUpdates.available_quantity = updates.availableQuantity;
    if (Object.keys(dbUpdates).length > 0) {
      await supabase.from('products').update(dbUpdates).eq('id', productId);
    }
    setProducts(prev => prev.map(p => p.id === productId ? { ...p, ...updates } : p));
  }, []);

  const toggleHideProduct = useCallback(async (productId: string) => {
    const prod = products.find(p => p.id === productId);
    if (!prod) return;
    await supabase.from('products').update({ is_hidden: !prod.isHidden }).eq('id', productId);
    setProducts(prev => prev.map(p => p.id === productId ? { ...p, isHidden: !p.isHidden } : p));
  }, [products]);

  const deleteProduct = useCallback(async (productId: string) => {
    await supabase.from('products').delete().eq('id', productId);
    setProducts(prev => prev.filter(p => p.id !== productId));
  }, []);

  const createRental = useCallback(async (params: {
    productId: string; durationDays: number;
    renterId: string; renterName: string; renterPhone: string;
    renterAddress: string; renterWilaya: string; selfPickup: boolean;
  }): Promise<string> => {
    const product = products.find(p => p.id === params.productId);
    if (!product) return '';
    const { gross, commission, net } = calcCommission(product.rentalPrice, params.durationDays, product.commissionRate);
    const totalAmount = gross + product.deposit;
    const rentalId = crypto.randomUUID();
    const handoverToken = crypto.randomUUID();
    const returnToken = crypto.randomUUID();
    const { error } = await supabase.from('rentals').insert({
      id: rentalId,
      product_id: product.id, product_title: product.title,
      product_image: product.images[0] || null,
      owner_id: product.ownerId, owner_name: product.ownerName,
      renter_id: params.renterId, renter_name: params.renterName,
      renter_phone: params.renterPhone, renter_address: params.renterAddress,
      renter_wilaya: params.renterWilaya, self_pickup: params.selfPickup,
      duration_days: params.durationDays,
      daily_rate: product.rentalPrice, deposit: product.deposit,
      commission_amount: commission, net_earnings: net,
      total_amount: totalAmount, escrow_amount: totalAmount,
      qr_code_delivery: handoverToken,
      qr_code_return: returnToken,
      handover_token: handoverToken,
      return_token: returnToken,
    });
    if (error) return '';
    const newAvail = Math.max(0, product.availableQuantity - 1);
    await supabase.from('products').update({ available_quantity: newAvail, status: newAvail === 0 ? 'rented' : 'available' }).eq('id', product.id);
    const { data: rData } = await supabase.from('rentals').select('*').eq('id', rentalId).maybeSingle();
    if (rData) setRentals(prev => [rowToRental(rData), ...prev]);
    return rentalId;
  }, [products]);

  const updateRentalStatus = useCallback(async (rentalId: string, status: RentalStatus) => {
    await supabase.from('rentals').update({ status }).eq('id', rentalId);
    setRentals(prev => prev.map(r => r.id === rentalId ? { ...r, status } : r));
  }, []);

  const acceptRental = useCallback(async (rentalId: string) => {
    await supabase.from('rentals').update({ status: 'accepted' }).eq('id', rentalId);
    setRentals(prev => prev.map(r => r.id === rentalId ? { ...r, status: 'accepted' } : r));
  }, []);

  const rejectRental = useCallback(async (rentalId: string) => {
    await supabase.from('rentals').update({ status: 'cancelled', escrow_amount: 0 }).eq('id', rentalId);
    setRentals(prev => prev.map(r => r.id === rentalId ? { ...r, status: 'cancelled', escrowAmount: 0 } : r));
  }, []);

  const startDelivery = useCallback(async (rentalId: string) => {
    const now = new Date().toISOString();
    await supabase.from('rentals').update({ status: 'active', start_time: now }).eq('id', rentalId);
    setRentals(prev => prev.map(r => r.id === rentalId ? { ...r, status: 'active', startTime: now } : r));
  }, []);

  const completeReturn = useCallback(async (rentalId: string) => {
    const rental = rentals.find(r => r.id === rentalId);
    if (!rental) return;
    let latePenalty = 0;
    if (rental.startTime) {
      const expectedEnd = new Date(rental.startTime).getTime() + rental.durationDays * 24 * 3600000;
      const now = Date.now();
      if (now > expectedEnd) latePenalty = Math.ceil((now - expectedEnd) / 3600000) * 150;
    }
    const endTime = new Date().toISOString();
    await supabase.from('rentals').update({ status: 'completed', end_time: endTime, late_penalty: latePenalty, escrow_amount: 0 }).eq('id', rentalId);
    setRentals(prev => prev.map(r => r.id === rentalId ? { ...r, status: 'completed', endTime, latePenalty, escrowAmount: 0 } : r));
    const prod = products.find(p => p.id === rental.productId);
    if (prod) {
      const newAvail = Math.min(prod.stockQuantity, prod.availableQuantity + 1);
      await supabase.from('products').update({ available_quantity: newAvail, status: newAvail > 0 ? 'available' : 'rented' }).eq('id', prod.id);
    }
  }, [rentals, products]);

  const requestExtension = useCallback(async (rentalId: string, days: number) => {
    await supabase.from('rentals').update({ status: 'extend_requested', extension_requested: true, extension_days: days }).eq('id', rentalId);
    setRentals(prev => prev.map(r => r.id === rentalId ? { ...r, status: 'extend_requested', extensionRequested: true, extensionDays: days } : r));
  }, []);

  const acceptExtension = useCallback(async (rentalId: string) => {
    const rental = rentals.find(r => r.id === rentalId);
    if (!rental) return;
    const addDays = rental.extensionDays || 0;
    const extraCost = rental.dailyRate * addDays;
    const newDuration = rental.durationDays + addDays;
    const newTotal = rental.totalAmount + extraCost;
    await supabase.from('rentals').update({ status: 'active', duration_days: newDuration, total_amount: newTotal, extension_requested: false, extension_days: null }).eq('id', rentalId);
    setRentals(prev => prev.map(r => r.id === rentalId ? { ...r, status: 'active', durationDays: newDuration, totalAmount: newTotal, extensionRequested: false, extensionDays: undefined } : r));
  }, [rentals]);

  const scanHandover = useCallback(async (token: string, lessorId: string) => {
    const { data, error } = await supabase.functions.invoke('rental-handover-scan', {
      body: { token, lessorId },
    });
    if (error) return { success: false, message: error.message };
    // تحديث المحلي
    const { data: rData } = await supabase.from('rentals').select('*').eq('handover_token', token).maybeSingle();
    if (rData) {
      setRentals(prev => prev.map(r => r.id === rData.id ? rowToRental(rData) : r));
    }
    return { success: data?.success, message: data?.message || data?.error };
  }, []);

  const scanReturn = useCallback(async (token: string, lessorId: string) => {
    const { data, error } = await supabase.functions.invoke('rental-return-scan', {
      body: { token, lessorId },
    });
    if (error) return { success: false, message: error.message };
    const { data: rData } = await supabase.from('rentals').select('*').eq('return_token', token).maybeSingle();
    if (rData) {
      setRentals(prev => prev.map(r => r.id === rData.id ? rowToRental(rData) : r));
    }
    return { success: data?.success, message: data?.message || data?.error };
  }, []);

  const rejectExtension = useCallback(async (rentalId: string) => {
    await supabase.from('rentals').update({ status: 'active', extension_requested: false }).eq('id', rentalId);
    setRentals(prev => prev.map(r => r.id === rentalId ? { ...r, status: 'active', extensionRequested: false } : r));
  }, []);

  const getOwnerStats = useCallback((ownerId: string) => {
    const ownerProducts = products.filter(p => p.ownerId === ownerId);
    const ownerRentals = rentals.filter(r => r.ownerId === ownerId && r.status === 'completed');
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const monthlyEarnings = ownerRentals
      .filter(r => r.endTime && new Date(r.endTime).getTime() > monthStart)
      .reduce((sum, r) => sum + r.netEarnings, 0);
    return {
      products: ownerProducts.length,
      rentals: ownerRentals.length,
      totalEarnings: ownerRentals.reduce((sum, r) => sum + r.netEarnings, 0),
      monthlyEarnings,
      available: ownerProducts.filter(p => p.status === 'available').length,
      rented: ownerProducts.filter(p => p.status === 'rented').length,
    };
  }, [products, rentals]);

  const getRenterStats = useCallback((renterId: string) => {
    const renterRentals = rentals.filter(r => r.renterId === renterId);
    const completed = renterRentals.filter(r => r.status === 'completed');
    const frozen = renterRentals
      .filter(r => ['pending_owner', 'accepted', 'pending_delivery', 'active'].includes(r.status))
      .reduce((sum, r) => sum + r.deposit, 0);
    return {
      totalOrders: renterRentals.length,
      totalRentals: completed.length,
      totalExpenses: completed.reduce((sum, r) => sum + r.totalAmount, 0),
      frozenDeposits: frozen,
    };
  }, [rentals]);

  const fileDispute = useCallback(async (params: {
    rentalId: string; filedBy: DisputeParty; userId: string;
    userName: string; userPhone: string; title: string; description: string;
  }): Promise<string> => {
    const rental = rentals.find(r => r.id === params.rentalId);
    const { data, error } = await supabase.from('disputes').insert({
      rental_id: params.rentalId,
      product_title: rental?.productTitle || '',
      filed_by: params.filedBy,
      user_id: params.userId,
      user_name: params.userName,
      user_phone: params.userPhone,
      title: params.title,
      description: params.description,
    }).select().maybeSingle();
    if (error || !data) return '';
    setDisputes(prev => [{
      id: data.id, rentalId: params.rentalId,
      productTitle: rental?.productTitle || '',
      filedBy: params.filedBy, userId: params.userId,
      userName: params.userName, userPhone: params.userPhone,
      title: params.title, description: params.description,
      status: 'open', createdAt: data.created_at,
    }, ...prev]);
    return data.id as string;
  }, [rentals]);

  const updateDisputeStatus = useCallback(async (disputeId: string, status: DisputeStatus, adminNotes?: string) => {
    await supabase.from('disputes').update({
      status, admin_notes: adminNotes || null,
      resolved_at: (status === 'resolved' || status === 'rejected') ? new Date().toISOString() : null,
    }).eq('id', disputeId);
    setDisputes(prev => prev.map(d => d.id === disputeId
      ? { ...d, status, adminNotes, resolvedAt: (status === 'resolved' || status === 'rejected') ? new Date().toISOString() : d.resolvedAt }
      : d
    ));
  }, []);

  const getDisputesByRental = useCallback((rentalId: string) =>
    disputes.filter(d => d.rentalId === rentalId), [disputes]);

  const rateOwner = useCallback(async (params: {
    ownerId: string; renterId: string; rentalId: string; rating: number; comment?: string;
  }) => {
    await supabase.from('owner_ratings').upsert({
      owner_id: params.ownerId,
      renter_id: params.renterId,
      rental_id: params.rentalId,
      rating: params.rating,
      comment: params.comment || null,
    }, { onConflict: 'rental_id,renter_id' });
    // تحديث تقييم المنتجات المرتبطة بهذا المؤجر محلياً
    const { data: profile } = await supabase
      .from('profiles').select('owner_rating,owner_review_count').eq('id', params.ownerId).maybeSingle();
    if (profile) {
      setProducts(prev => prev.map(p =>
        p.ownerId === params.ownerId
          ? { ...p, ownerRating: profile.owner_rating || 0, ownerReviewCount: profile.owner_review_count || 0 }
          : p
      ));
    }
  }, []);

  return (
    <DataContext.Provider value={{
      products, rentals, disputes,
      getTopRated, getMostRented, getNewArrivals, getNearby,
      getProductById, getCategoryName,
      addProduct, updateProduct, toggleHideProduct, deleteProduct,
      createRental, updateRentalStatus, acceptRental, rejectRental,
      startDelivery, completeReturn, requestExtension, acceptExtension, rejectExtension,
      scanHandover, scanReturn,
      getOwnerStats, getRenterStats,
      fileDispute, updateDisputeStatus, getDisputesByRental,
      rateOwner,
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
