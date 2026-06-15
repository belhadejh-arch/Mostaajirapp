import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { api, setToken, clearToken, getToken } from '@/api/client';
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

function rowToUser(p: Record<string, unknown>): User {
  return {
    id: p.id as string,
    name: (p.name as string) || '',
    email: (p.email as string) || '',
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
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadMe = useCallback(async () => {
    try {
      const data = await api.get<Record<string, unknown>>('/auth/me');
      setUser(rowToUser(data));
    } catch {
      clearToken();
      setUser(null);
    }
  }, []);

  useEffect(() => {
    if (getToken()) {
      loadMe().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [loadMe]);

  // Poll profile every 30s to pick up verification status / balance changes
  useEffect(() => {
    if (!user?.id) { if (pollRef.current) clearInterval(pollRef.current); return; }
    pollRef.current = setInterval(loadMe, 30_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [user?.id, loadMe]);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    try {
      const { token, user: userData } = await api.post<{ token: string; user: Record<string, unknown> }>(
        '/auth/login', { email: email.trim().toLowerCase(), password }
      );
      setToken(token);
      setUser(rowToUser(userData));
      return true;
    } catch (err: unknown) {
      const msg = (err as Error).message || 'فشل تسجيل الدخول';
      alert('❌ خطأ في تسجيل الدخول: ' + msg);
      return false;
    }
  }, []);

  const register = useCallback(async (data: Partial<User> & { password: string }): Promise<boolean> => {
    try {
      const { token, user: userData } = await api.post<{ token: string; user: Record<string, unknown> }>(
        '/auth/register', {
          email: (data.email || '').toLowerCase().trim(),
          password: data.password,
          name: data.name || '',
          phone: data.phone || '',
          wilayaCode: data.wilayaCode || 16,
          wilayaName: data.wilayaName || 'الجزائر',
        }
      );
      setToken(token);
      setUser(rowToUser(userData));
      return true;
    } catch (err: unknown) {
      const msg = (err as Error).message || 'فشل إنشاء الحساب';
      alert('❌ خطأ في التسجيل: ' + msg);
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  const updateUser = useCallback(async (data: Partial<User>) => {
    if (!user) return;
    setUser(prev => prev ? { ...prev, ...data } : prev);
    const body: Record<string, unknown> = {};
    if (data.name !== undefined) body.name = data.name;
    if (data.phone !== undefined) body.phone = data.phone;
    if (data.wilayaCode !== undefined) body.wilaya_code = data.wilayaCode;
    if (data.wilayaName !== undefined) body.wilaya_name = data.wilayaName;
    if (data.verificationStatus !== undefined) body.verification_status = data.verificationStatus;
    if (data.avatarUri !== undefined) body.avatar_uri = data.avatarUri;
    if (data.walletBalance !== undefined) body.wallet_balance = data.walletBalance;
    if (data.earningsBalance !== undefined) body.earnings_balance = data.earningsBalance;
    if (data.kycRejectionReason !== undefined) body.kyc_rejection_reason = data.kycRejectionReason;
    if (Object.keys(body).length > 0) {
      try { await api.put('/auth/profile', body); } catch { /* silent */ }
    }
  }, [user]);

  const changePassword = useCallback(async (oldPassword: string, newPassword: string): Promise<boolean> => {
    try {
      await api.put('/auth/password', { oldPassword, newPassword });
      return true;
    } catch {
      return false;
    }
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
