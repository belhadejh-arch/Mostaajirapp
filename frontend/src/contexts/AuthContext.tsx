import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { supabase } from '@/db/supabase';
import type { User } from '@/types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  register: (data: Partial<User> & { password: string }) => Promise<boolean>;
  logout: () => void;
  updateUser: (data: Partial<User>) => void;
  changePassword: (oldPassword: string, newPassword: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// تحويل بيانات Supabase إلى نموذج User الداخلي
function profileToUser(p: Record<string, unknown>, email: string): User {
  return {
    id: p.id as string,
    name: (p.name as string) || '',
    email,
    phone: (p.phone as string) || '',
    wilayaCode: (p.wilaya_code as number) || 16,
    wilayaName: (p.wilaya_name as string) || 'الجزائر',
    verificationStatus: (p.verification_status as User['verificationStatus']) || 'none',
    accountStatus: (p.account_status as User['accountStatus']) || 'active',
    walletBalance: (p.wallet_balance as number) || 0,
    earningsBalance: (p.earnings_balance as number) || 0,
    frozenBalance: (p.frozen_balance as number) || 0,
    totalRentals: (p.total_rentals as number) || 0,
    rating: (p.rating as number) || 0,
    reviewCount: (p.review_count as number) || 0,
    isAdmin: (p.is_admin as boolean) || false,
    avatarUri: p.avatar_uri as string | undefined,
    kycRejectionReason: p.kyc_rejection_reason as string | undefined,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // استرجاع الجلسة عند تحميل التطبيق
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        await loadProfile(session.user.id, session.user.email ?? '');
      }
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') { setUser(null); return; }
      if (session?.user) await loadProfile(session.user.id, session.user.email ?? '');
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── Realtime: تحديث بيانات المستخدم فورياً (حالة التوثيق، سبب الرفض) ──
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase.channel(`profile-${user.id}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'profiles',
        filter: `id=eq.${user.id}`,
      }, payload => {
        const row = payload.new as Record<string, unknown>;
        if (!row) return;
        setUser(prev => prev ? {
          ...prev,
          verificationStatus: (row.verification_status as User['verificationStatus']) ?? prev.verificationStatus,
          kycRejectionReason: (row.kyc_rejection_reason as string | undefined) ?? prev.kycRejectionReason,
          accountStatus: (row.account_status as User['accountStatus']) ?? prev.accountStatus,
          walletBalance: (row.wallet_balance as number) ?? prev.walletBalance,
          earningsBalance: (row.earnings_balance as number) ?? prev.earningsBalance,
        } : prev);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  const loadProfile = async (userId: string, email: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (data) setUser(profileToUser(data, email));
  };

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error || !data.user) return false;
    await loadProfile(data.user.id, data.user.email ?? '');
    return true;
  }, []);

  const register = useCallback(async (data: Partial<User> & { password: string }): Promise<boolean> => {
    const email = (data.email || '').toLowerCase().trim();
    const { data: authData, error } = await supabase.auth.signUp({
      email,
      password: data.password,
      options: {
        data: {
          name: data.name || '',
          phone: data.phone || '',
          wilaya_code: data.wilayaCode || 16,
          wilaya_name: data.wilayaName || 'الجزائر',
        },
      },
    });
    if (error || !authData.user) return false;
    // الـ trigger ينشئ الـ profile تلقائياً — نستريح لحظة ثم نقرأه
    await new Promise(r => setTimeout(r, 800));
    await loadProfile(authData.user.id, email);
    return true;
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  const updateUser = useCallback(async (data: Partial<User>) => {
    if (!user) return;
    const updates: Record<string, unknown> = {};
    if (data.name !== undefined) updates.name = data.name;
    if (data.phone !== undefined) updates.phone = data.phone;
    if (data.wilayaCode !== undefined) updates.wilaya_code = data.wilayaCode;
    if (data.wilayaName !== undefined) updates.wilaya_name = data.wilayaName;
    if (data.verificationStatus !== undefined) updates.verification_status = data.verificationStatus;
    if (data.avatarUri !== undefined) updates.avatar_uri = data.avatarUri;
    if (data.walletBalance !== undefined) updates.wallet_balance = data.walletBalance;
    if (data.earningsBalance !== undefined) updates.earnings_balance = data.earningsBalance;
    if (data.kycRejectionReason !== undefined) updates.kyc_rejection_reason = data.kycRejectionReason;
    if (Object.keys(updates).length > 0) {
      await supabase.from('profiles').update(updates).eq('id', user.id);
    }
    setUser(prev => prev ? { ...prev, ...data } : prev);
  }, [user]);

  const changePassword = useCallback(async (_old: string, newPass: string): Promise<boolean> => {
    const { error } = await supabase.auth.updateUser({ password: newPass });
    return !error;
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateUser, changePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
