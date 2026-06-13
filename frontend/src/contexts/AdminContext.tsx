import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { supabase } from '@/db/supabase';
import type { User, WithdrawalRequest, AdminSettings, Dispute, DisputeStatus, KycRequest } from '@/types';

export interface AdminUser extends User { createdAt: string; isActive: boolean; email: string; }

const DEFAULT_LOGO = 'https://miaoda-conversation-file.s3cdn.medo.dev/user-c8wxjlfz0sn4/app-c8wxvvf3rb41/20260611/IMG_0277.jpeg';

const DEFAULT_SETTINGS: AdminSettings = {
  logoUrl: DEFAULT_LOGO,
  commissionRates: { under20k: 10, under50k: 10, under100k: 15, under300k: 20, under500k: 20, above500k: 30 },
  dailyPrices: { under20k: 800, under50k: 1100, under100k: 1500, under300k: 2000, under500k: 2500, above500k: 3500 },
  deposits: { under50k: 0, under200k: 1000, above200k: 4000 },
  latePenaltyPerHour: 150,
  minWithdrawal: 1000,
  topUpAmounts: [2000, 4000, 6000, 8000, 10000, 14000, 18000, 20000, 25000, 30000, 50000, 60000, 80000, 100000, 150000, 200000, 500000],
};

// تحويل صف profiles إلى AdminUser
function rowToAdminUser(row: Record<string, unknown>, email = ''): AdminUser {
  return {
    id: row.id as string,
    name: (row.name as string) || '',
    email: (row.email as string) || email,
    phone: (row.phone as string) || '',
    address: row.address as string | undefined,
    wilayaCode: (row.wilaya_code as number) || 16,
    wilayaName: (row.wilaya_name as string) || 'الجزائر',
    verificationStatus: (row.verification_status as AdminUser['verificationStatus']) || 'none',
    accountStatus: (row.account_status as AdminUser['accountStatus']) || 'active',
    walletBalance: (row.wallet_balance as number) || 0,
    earningsBalance: (row.earnings_balance as number) || 0,
    frozenBalance: (row.frozen_balance as number) || 0,
    totalRentals: (row.total_rentals as number) || 0,
    rating: (row.rating as number) || 0,
    reviewCount: (row.review_count as number) || 0,
    isAdmin: (row.is_admin as boolean) || false,
    avatarUri: row.avatar_uri as string | undefined,
    kycRejectionReason: row.kyc_rejection_reason as string | undefined,
    createdAt: (row.created_at as string) || new Date().toISOString(),
    isActive: (row.account_status as string) === 'active',
  };
}

// تحويل صف kyc_requests
function rowToKycRequest(row: Record<string, unknown>): KycRequest {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    userName: (row.user_name as string) || '',
    userEmail: (row.user_email as string) || '',
    userPhone: (row.user_phone as string) || '',
    idFrontUri: (row.id_front_uri as string) || '',
    idBackUri: (row.id_back_uri as string) || '',
    selfieUri: (row.selfie_uri as string) || '',
    status: (row.status as KycRequest['status']) || 'pending',
    rejectionReason: row.rejection_reason as string | undefined,
    createdAt: (row.created_at as string) || new Date().toISOString(),
    reviewedAt: row.reviewed_at as string | undefined,
  };
}

// تحويل صف withdrawal_requests
function rowToWithdrawal(row: Record<string, unknown>): WithdrawalRequest {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    userName: (row.user_name as string) || '',
    phone: (row.phone as string) || '',
    ccpNumber: (row.ccp_number as string) || '',
    amount: (row.amount as number) || 0,
    status: (row.status as WithdrawalRequest['status']) || 'pending',
    createdAt: (row.created_at as string) || new Date().toISOString(),
  };
}

// تحويل صف disputes
function rowToDispute(row: Record<string, unknown>): Dispute {
  return {
    id: row.id as string,
    rentalId: (row.rental_id as string) || '',
    productTitle: (row.product_title as string) || '',
    filedBy: (row.filed_by as Dispute['filedBy']) || 'renter',
    userId: (row.user_id as string) || '',
    userName: (row.user_name as string) || '',
    userPhone: (row.user_phone as string) || '',
    otherPartyId: row.other_party_id as string | undefined,
    otherPartyName: row.other_party_name as string | undefined,
    otherPartyPhone: row.other_party_phone as string | undefined,
    title: (row.title as string) || '',
    description: (row.description as string) || '',
    status: (row.status as Dispute['status']) || 'open',
    adminNotes: row.admin_notes as string | undefined,
    createdAt: (row.created_at as string) || new Date().toISOString(),
    resolvedAt: row.resolved_at as string | undefined,
  };
}

interface AdminContextType {
  users: AdminUser[];
  withdrawals: WithdrawalRequest[];
  disputes: Dispute[];
  kycRequests: KycRequest[];
  settings: AdminSettings;
  loading: boolean;
  approveKYC: (userId: string) => void;
  rejectKYC: (userId: string, reason: string) => void;
  processWithdrawal: (id: string) => void;
  rejectWithdrawal: (id: string) => void;
  resolveDispute: (id: string, adminNotes?: string) => void;
  rejectDispute: (id: string, adminNotes?: string) => void;
  reviewDispute: (id: string) => void;
  updateSettings: (s: Partial<AdminSettings>) => void;
  updateLogoUrl: (url: string) => void;
  deactivateUser: (userId: string) => void;
  activateUser: (userId: string) => void;
  banUser: (userId: string) => void;
  freezeUser: (userId: string) => void;
  unfreezeUser: (userId: string) => void;
  unbanUser: (userId: string) => void;
  searchUserByPhone: (phone: string) => AdminUser[];
  pendingKYC: AdminUser[];
  clearTestAccounts: () => Promise<void>;
  totalStats: {
    users: number; products: number; operations: number; earnings: number; commissions: number;
    disputes: number; pendingKYC: number; approvedKYC: number; rejectedKYC: number;
    pendingWithdrawals: number; activeRentals: number; openDisputes: number; underReviewDisputes: number;
  };
}

const AdminContext = createContext<AdminContextType | null>(null);


// ── AdminProvider ──
export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [kycRequests, setKycRequests] = useState<KycRequest[]>([]);
  const [settings, setSettings] = useState<AdminSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  // ── جلب البيانات الأولية من Supabase ──
  useEffect(() => {
    async function loadAll() {
      const [
        { data: profilesData },
        { data: kycData },
        { data: wrData },
        { data: disputesData },
      ] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('kyc_requests').select('*').order('created_at', { ascending: false }),
        supabase.from('withdrawal_requests').select('*').order('created_at', { ascending: false }),
        supabase.from('disputes').select('*').order('created_at', { ascending: false }),
      ]);
      if (profilesData) setUsers(profilesData.map(r => rowToAdminUser(r)));
      if (kycData) setKycRequests(kycData.map(rowToKycRequest));
      if (wrData) setWithdrawals(wrData.map(rowToWithdrawal));
      if (disputesData) setDisputes(disputesData.map(rowToDispute));
      setLoading(false);
    }
    loadAll();
  }, []);

  // ── Supabase Realtime: مستخدمون جدد وتحديثات ──
  useEffect(() => {
    const channel = supabase.channel('admin-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, payload => {
        const row = payload.new as Record<string, unknown>;
        if (!row?.id) return;
        const adminUser = rowToAdminUser(row);
        setUsers(prev => {
          const idx = prev.findIndex(u => u.id === adminUser.id);
          if (idx >= 0) {
            const next = [...prev]; next[idx] = adminUser; return next;
          }
          return [adminUser, ...prev];
        });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kyc_requests' }, payload => {
        const row = payload.new as Record<string, unknown>;
        if (!row?.id) return;
        const req = rowToKycRequest(row);
        setKycRequests(prev => {
          const idx = prev.findIndex(k => k.id === req.id);
          if (idx >= 0) { const next = [...prev]; next[idx] = req; return next; }
          return [req, ...prev];
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // ── KYC ──
  const approveKYC = useCallback(async (userId: string) => {
    await supabase.from('profiles').update({ verification_status: 'verified' }).eq('id', userId);
    await supabase.from('kyc_requests').update({ status: 'approved', reviewed_at: new Date().toISOString() }).eq('user_id', userId).eq('status', 'pending');
  }, []);

  const rejectKYC = useCallback(async (userId: string, reason: string) => {
    await supabase.from('profiles').update({ verification_status: 'rejected', kyc_rejection_reason: reason }).eq('id', userId);
    await supabase.from('kyc_requests').update({ status: 'rejected', rejection_reason: reason, reviewed_at: new Date().toISOString() }).eq('user_id', userId).eq('status', 'pending');
  }, []);

  const processWithdrawal = useCallback(async (id: string) => {
    await supabase.from('withdrawal_requests').update({ status: 'processed' }).eq('id', id);
    setWithdrawals(prev => prev.map(w => w.id === id ? { ...w, status: 'processed' } : w));
  }, []);

  const rejectWithdrawal = useCallback(async (id: string) => {
    await supabase.from('withdrawal_requests').update({ status: 'rejected' }).eq('id', id);
    setWithdrawals(prev => prev.map(w => w.id === id ? { ...w, status: 'rejected' } : w));
  }, []);

  const updateSettings = useCallback((s: Partial<AdminSettings>) =>
    setSettings(prev => ({ ...prev, ...s })), []);

  const updateLogoUrl = useCallback((url: string) =>
    setSettings(prev => ({ ...prev, logoUrl: url })), []);

  const updateAccountStatus = async (userId: string, status: string, isActive: boolean) => {
    await supabase.from('profiles').update({ account_status: status }).eq('id', userId);
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, accountStatus: status as AdminUser['accountStatus'], isActive } : u));
  };

  const deactivateUser = useCallback((userId: string) => updateAccountStatus(userId, 'frozen', false), []);
  const activateUser   = useCallback((userId: string) => updateAccountStatus(userId, 'active', true), []);
  const banUser        = useCallback((userId: string) => updateAccountStatus(userId, 'banned', false), []);
  const freezeUser     = useCallback((userId: string) => updateAccountStatus(userId, 'frozen', false), []);
  const unfreezeUser   = useCallback((userId: string) => updateAccountStatus(userId, 'active', true), []);
  const unbanUser      = useCallback((userId: string) => updateAccountStatus(userId, 'active', true), []);

  const searchUserByPhone = useCallback((phone: string) =>
    users.filter(u => u.phone.replace(/\s/g, '').includes(phone.replace(/\s/g, ''))), [users]);

  // ── تنظيف الحسابات التجريبية (غير المشطة منذ 30 يوماً وبدون إيجارات) ──
  const clearTestAccounts = useCallback(async () => {
    const cutoff = new Date(Date.now() - 86400000 * 30).toISOString();
    await supabase.from('profiles')
      .delete()
      .eq('is_admin', false)
      .eq('total_rentals', 0)
      .lt('created_at', cutoff);
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (data) setUsers(data.map(r => rowToAdminUser(r)));
  }, []);

  const resolveDispute = useCallback(async (id: string, adminNotes?: string) => {
    await supabase.from('disputes').update({ status: 'resolved', admin_notes: adminNotes, resolved_at: new Date().toISOString() }).eq('id', id);
    setDisputes(prev => prev.map(d => d.id === id ? { ...d, status: 'resolved' as DisputeStatus, adminNotes, resolvedAt: new Date().toISOString() } : d));
  }, []);

  const rejectDispute = useCallback(async (id: string, adminNotes?: string) => {
    await supabase.from('disputes').update({ status: 'rejected', admin_notes: adminNotes, resolved_at: new Date().toISOString() }).eq('id', id);
    setDisputes(prev => prev.map(d => d.id === id ? { ...d, status: 'rejected' as DisputeStatus, adminNotes, resolvedAt: new Date().toISOString() } : d));
  }, []);

  const reviewDispute = useCallback(async (id: string) => {
    await supabase.from('disputes').update({ status: 'under_review' }).eq('id', id);
    setDisputes(prev => prev.map(d => d.id === id ? { ...d, status: 'under_review' as DisputeStatus } : d));
  }, []);

  const pendingKYC = users.filter(u => u.verificationStatus === 'pending');

  const totalStats = {
    users: users.filter(u => !u.isAdmin).length,
    products: 0, // يُحسب من DataContext
    operations: 0,
    earnings: 0,
    commissions: 0,
    disputes: disputes.length,
    pendingKYC: pendingKYC.length,
    approvedKYC: kycRequests.filter(k => k.status === 'approved').length,
    rejectedKYC: kycRequests.filter(k => k.status === 'rejected').length,
    pendingWithdrawals: withdrawals.filter(w => w.status === 'pending').length,
    activeRentals: 0,
    openDisputes: disputes.filter(d => d.status === 'open').length,
    underReviewDisputes: disputes.filter(d => d.status === 'under_review').length,
  };

  return (
    <AdminContext.Provider value={{
      users, withdrawals, disputes, kycRequests, settings, loading,
      approveKYC, rejectKYC, processWithdrawal, rejectWithdrawal,
      resolveDispute, rejectDispute, reviewDispute,
      updateSettings, updateLogoUrl, deactivateUser, activateUser,
      banUser, freezeUser, unfreezeUser, unbanUser, searchUserByPhone,
      clearTestAccounts,
      pendingKYC, totalStats,
    }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin must be used within AdminProvider');
  return ctx;
}

