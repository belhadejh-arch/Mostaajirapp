import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { api } from '@/api/client';
import type { User, WithdrawalRequest, AdminSettings, Dispute, DisputeStatus, KycRequest } from '@/types';
import { useAuth } from './AuthContext';

export interface AdminUser extends User { createdAt: string; isActive: boolean; email: string; }

const DEFAULT_LOGO = 'https://miaoda-conversation-file.s3cdn.medo.dev/user-c8wxjlfz0sn4/app-c8wxvvf3rb41/20260611/IMG_0277.jpeg';

const DEFAULT_SETTINGS: AdminSettings = {
  logoUrl: DEFAULT_LOGO,
  commissionRates: { under20k:10, under50k:10, under100k:15, under300k:20, under500k:20, above500k:30 },
  dailyPrices: { under20k:800, under50k:1100, under100k:1500, under300k:2000, under500k:2500, above500k:3500 },
  deposits: { under50k:0, under200k:1000, above200k:4000 },
  latePenaltyPerHour: 150,
  minWithdrawal: 1000,
  topUpAmounts: [2000,4000,6000,8000,10000,14000,18000,20000,25000,30000,50000,60000,80000,100000,150000,200000,500000],
};

function rowToAdminUser(row: Record<string, unknown>, email = ''): AdminUser {
  return {
    id: row.id as string, name: (row.name as string) || '', email: (row.email as string) || email,
    phone: (row.phone as string) || '', address: row.address as string | undefined,
    wilayaCode: (row.wilaya_code as number) || 16, wilayaName: (row.wilaya_name as string) || 'الجزائر',
    verificationStatus: (row.verification_status as AdminUser['verificationStatus']) || 'none',
    accountStatus: (row.account_status as AdminUser['accountStatus']) || 'active',
    walletBalance: (row.wallet_balance as number) || 0, earningsBalance: (row.earnings_balance as number) || 0,
    frozenBalance: (row.frozen_balance as number) || 0, totalRentals: (row.total_rentals as number) || 0,
    rating: (row.rating as number) || 0, reviewCount: (row.review_count as number) || 0,
    isAdmin: (row.is_admin as boolean) || false, avatarUri: row.avatar_uri as string | undefined,
    kycRejectionReason: row.kyc_rejection_reason as string | undefined,
    createdAt: (row.created_at as string) || new Date().toISOString(),
    isActive: (row.account_status as string) === 'active',
  };
}

function rowToKycRequest(row: Record<string, unknown>): KycRequest {
  return {
    id: row.id as string, userId: row.user_id as string,
    userName: (row.user_name as string) || '', userEmail: (row.user_email as string) || '',
    userPhone: (row.user_phone as string) || '', idFrontUri: (row.id_front_uri as string) || '',
    idBackUri: (row.id_back_uri as string) || '', selfieUri: (row.selfie_uri as string) || '',
    status: (row.status as KycRequest['status']) || 'pending',
    rejectionReason: row.rejection_reason as string | undefined,
    createdAt: (row.created_at as string) || new Date().toISOString(),
    reviewedAt: row.reviewed_at as string | undefined,
  };
}

function rowToWithdrawal(row: Record<string, unknown>): WithdrawalRequest {
  return {
    id: row.id as string, userId: row.user_id as string, userName: (row.user_name as string) || '',
    phone: (row.phone as string) || '', ccpNumber: (row.ccp_number as string) || '',
    amount: (row.amount as number) || 0, status: (row.status as WithdrawalRequest['status']) || 'pending',
    createdAt: (row.created_at as string) || new Date().toISOString(),
  };
}

function rowToDispute(row: Record<string, unknown>): Dispute {
  return {
    id: row.id as string, rentalId: (row.rental_id as string) || '',
    productTitle: (row.product_title as string) || '', filedBy: (row.filed_by as Dispute['filedBy']) || 'renter',
    userId: (row.user_id as string) || '', userName: (row.user_name as string) || '',
    userPhone: (row.user_phone as string) || '', otherPartyId: row.other_party_id as string | undefined,
    otherPartyName: row.other_party_name as string | undefined, otherPartyPhone: row.other_party_phone as string | undefined,
    title: (row.title as string) || '', description: (row.description as string) || '',
    status: (row.status as Dispute['status']) || 'open', adminNotes: row.admin_notes as string | undefined,
    createdAt: (row.created_at as string) || new Date().toISOString(), resolvedAt: row.resolved_at as string | undefined,
  };
}

interface AdminContextType {
  users: AdminUser[]; withdrawals: WithdrawalRequest[]; disputes: Dispute[];
  kycRequests: KycRequest[]; settings: AdminSettings; loading: boolean;
  approveKYC: (userId: string) => void; rejectKYC: (userId: string, reason: string) => void;
  processWithdrawal: (id: string) => void; rejectWithdrawal: (id: string) => void;
  resolveDispute: (id: string, adminNotes?: string) => void; rejectDispute: (id: string, adminNotes?: string) => void;
  reviewDispute: (id: string) => void; updateSettings: (s: Partial<AdminSettings>) => void;
  updateLogoUrl: (url: string) => void; deactivateUser: (userId: string) => void;
  activateUser: (userId: string) => void; banUser: (userId: string) => void;
  freezeUser: (userId: string) => void; unfreezeUser: (userId: string) => void; unbanUser: (userId: string) => void;
  searchUserByPhone: (phone: string) => AdminUser[]; pendingKYC: AdminUser[];
  clearTestAccounts: () => Promise<void>;
  totalStats: { users: number; products: number; operations: number; earnings: number; commissions: number; disputes: number; pendingKYC: number; approvedKYC: number; rejectedKYC: number; pendingWithdrawals: number; activeRentals: number; openDisputes: number; underReviewDisputes: number; };
}

const AdminContext = createContext<AdminContextType | null>(null);

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [kycRequests, setKycRequests] = useState<KycRequest[]>([]);
  const [settings, setSettings] = useState<AdminSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAll() {
      try {
        const [usersData, kycData, wrData, disputesData, settingsData] = await Promise.all([
          api.get<Record<string, unknown>[]>('/admin/users').catch(() => []),
          api.get<Record<string, unknown>[]>('/admin/kyc').catch(() => []),
          api.get<Record<string, unknown>[]>('/admin/withdrawals').catch(() => []),
          api.get<Record<string, unknown>[]>('/disputes').catch(() => []),
          api.get<AdminSettings>('/admin/settings').catch(() => DEFAULT_SETTINGS),
        ]);
        setUsers(usersData.map(r => rowToAdminUser(r)));
        setKycRequests(kycData.map(rowToKycRequest));
        setWithdrawals(wrData.map(rowToWithdrawal));
        setDisputes(disputesData.map(rowToDispute));
        setSettings({ ...DEFAULT_SETTINGS, ...settingsData });
      } catch { /* silent */ } finally { setLoading(false); }
    }
    if (user?.isAdmin) loadAll(); else setLoading(false);
  }, [user?.isAdmin]);

  const approveKYC = useCallback(async (userId: string) => {
    await api.put(`/admin/kyc/${userId}/approve`);
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, verificationStatus: 'verified' } : u));
    setKycRequests(prev => prev.map(k => k.userId === userId ? { ...k, status: 'approved' } : k));
  }, []);

  const rejectKYC = useCallback(async (userId: string, reason: string) => {
    await api.put(`/admin/kyc/${userId}/reject`, { reason });
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, verificationStatus: 'rejected', kycRejectionReason: reason } : u));
    setKycRequests(prev => prev.map(k => k.userId === userId ? { ...k, status: 'rejected', rejectionReason: reason } : k));
  }, []);

  const processWithdrawal = useCallback(async (id: string) => {
    await api.put(`/admin/withdrawals/${id}/process`);
    setWithdrawals(prev => prev.map(w => w.id === id ? { ...w, status: 'processed' } : w));
  }, []);

  const rejectWithdrawal = useCallback(async (id: string) => {
    await api.put(`/admin/withdrawals/${id}/reject`);
    setWithdrawals(prev => prev.map(w => w.id === id ? { ...w, status: 'rejected' } : w));
  }, []);

  const updateSettings = useCallback(async (s: Partial<AdminSettings>) => {
    const next = { ...settings, ...s };
    setSettings(next);
    try { await api.put('/admin/settings', next); } catch { /* silent */ }
  }, [settings]);

  const updateLogoUrl = useCallback((url: string) => updateSettings({ logoUrl: url }), [updateSettings]);

  const updateAccountStatus = async (userId: string, status: string, isActive: boolean) => {
    await api.put(`/admin/users/${userId}/status`, { account_status: status });
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, accountStatus: status as AdminUser['accountStatus'], isActive } : u));
  };

  const deactivateUser = useCallback((id: string) => updateAccountStatus(id, 'frozen', false), []);
  const activateUser   = useCallback((id: string) => updateAccountStatus(id, 'active', true), []);
  const banUser        = useCallback((id: string) => updateAccountStatus(id, 'banned', false), []);
  const freezeUser     = useCallback((id: string) => updateAccountStatus(id, 'frozen', false), []);
  const unfreezeUser   = useCallback((id: string) => updateAccountStatus(id, 'active', true), []);
  const unbanUser      = useCallback((id: string) => updateAccountStatus(id, 'active', true), []);

  const searchUserByPhone = useCallback((phone: string) =>
    users.filter(u => u.phone.replace(/\s/g,'').includes(phone.replace(/\s/g,''))), [users]);

  const clearTestAccounts = useCallback(async () => {
    await api.delete('/admin/users/test');
    const data = await api.get<Record<string, unknown>[]>('/admin/users');
    setUsers(data.map(r => rowToAdminUser(r)));
  }, []);

  const resolveDispute = useCallback(async (id: string, adminNotes?: string) => {
    await api.put(`/disputes/${id}`, { status: 'resolved', admin_notes: adminNotes });
    setDisputes(prev => prev.map(d => d.id === id ? { ...d, status: 'resolved' as DisputeStatus, adminNotes, resolvedAt: new Date().toISOString() } : d));
  }, []);

  const rejectDispute = useCallback(async (id: string, adminNotes?: string) => {
    await api.put(`/disputes/${id}`, { status: 'rejected', admin_notes: adminNotes });
    setDisputes(prev => prev.map(d => d.id === id ? { ...d, status: 'rejected' as DisputeStatus, adminNotes, resolvedAt: new Date().toISOString() } : d));
  }, []);

  const reviewDispute = useCallback(async (id: string) => {
    await api.put(`/disputes/${id}`, { status: 'under_review' });
    setDisputes(prev => prev.map(d => d.id === id ? { ...d, status: 'under_review' as DisputeStatus } : d));
  }, []);

  const pendingKYC = users.filter(u => u.verificationStatus === 'pending');
  const totalStats = {
    users: users.filter(u => !u.isAdmin).length, products: 0, operations: 0, earnings: 0, commissions: 0,
    disputes: disputes.length, pendingKYC: pendingKYC.length,
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
      clearTestAccounts, pendingKYC, totalStats,
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
