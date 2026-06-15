import React, { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, ShieldCheck, Package, ArrowUpCircle, Settings, CheckCircle, XCircle, ImageIcon, Upload, TrendingUp, Eye, AlertTriangle, FileText, MessageSquare, Search, Ban, Snowflake, UserCheck, PhoneCall, Trash2, HardDrive, Bell, Radio, Clock, UserPlus, Download, BookOpen, DollarSign, Filter, ScrollText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AppLayout } from '@/components/layouts/AppLayout';
import { useAdmin } from '@/contexts/AdminContext';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { api } from '@/api/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { AdminUser } from '@/contexts/AdminContext';
import type { Dispute } from '@/types';
import { TermsContent } from '@/components/common/TermsOfUse';

/* ── بطاقة إحصاء ── */
function StatCard({ label, value, icon: Icon, accent }: { label: string; value: string | number; icon: React.ElementType; accent?: boolean }) {
  return (
    <Card className="h-full">
      <CardContent className="pt-4 flex items-start gap-3">
        <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0', accent ? 'bg-primary/10' : 'bg-muted')}>
          <Icon size={18} className={accent ? 'text-primary' : 'text-muted-foreground'} />
        </div>
        <div className="min-w-0">
          <p className={cn('text-2xl font-bold', accent ? 'text-primary' : 'text-foreground')}>{value}</p>
          <p className="text-xs text-muted-foreground mt-0.5 text-balance">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

/* ── شارة حالة الحساب ── */
function AccountStatusBadge({ status }: { status?: string }) {
  if (status === 'banned') return <Badge className="bg-destructive/10 text-destructive border-destructive/30 text-xs gap-1"><Ban size={9} />محظور</Badge>;
  if (status === 'frozen') return <Badge className="bg-blue-500/10 text-blue-700 border-blue-300 text-xs gap-1"><Snowflake size={9} />مجمّد</Badge>;
  return <Badge className="bg-green-500/10 text-green-700 border-green-300 text-xs gap-1"><UserCheck size={9} />نشط</Badge>;
}

export default function AdminPage() {
  const { t, isRTL } = useLanguage();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const {
    users, withdrawals, disputes, kycRequests, settings,
    approveKYC, rejectKYC, processWithdrawal, rejectWithdrawal,
    resolveDispute, rejectDispute, reviewDispute,
    updateLogoUrl, pendingKYC, totalStats,
    banUser, freezeUser, unfreezeUser, unbanUser, searchUserByPhone,
    clearTestAccounts,
  } = useAdmin();
  const { products, deleteProduct, updateProduct } = useData();

  const [tab, setTab] = useState('dashboard');
  const [logoDialogOpen, setLogoDialogOpen] = useState(false);
  const [newLogoUrl, setNewLogoUrl] = useState(settings.logoUrl);
  const [kycViewUser, setKycViewUser] = useState<AdminUser | null>(null);
  const [userRentals, setUserRentals] = useState<Record<string, unknown>[]>([]);
  const [userRentalsLoading, setUserRentalsLoading] = useState(false);
  const [disputeDetail, setDisputeDetail] = useState<Dispute | null>(null);
  const [disputeNotes, setDisputeNotes] = useState('');
  const [phoneSearch, setPhoneSearch] = useState('');
  const [userDetail, setUserDetail] = useState<AdminUser | null>(null);
  const [kycRejectReason, setKycRejectReason] = useState('');
  const [kycRejectUserId, setKycRejectUserId] = useState<string | null>(null);
  const [productDeleteId, setProductDeleteId] = useState<string | null>(null);
  const [productDeleteReason, setProductDeleteReason] = useState('');
  const [productReviewId, setProductReviewId] = useState<string | null>(null);
  const [productReviewReason, setProductReviewReason] = useState('');
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastBody, setBroadcastBody] = useState('');
  const [broadcastType, setBroadcastType] = useState<'general' | 'admin' | 'reminder'>('general');
  const [blacklistSearch, setBlacklistSearch] = useState('');
  const [cleanupConfirmOpen, setCleanupConfirmOpen] = useState(false);
  const [cleanupType, setCleanupType] = useState<'accounts' | 'products' | null>(null);
  const logoFileRef = useRef<HTMLInputElement>(null);

  // ── Audit Log state ──
  const [ledgerEntries, setLedgerEntries] = useState<Record<string, unknown>[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState('');
  const [financialSummary, setFinancialSummary] = useState<Record<string, unknown> | null>(null);

  // ── جلب إيجارات المستخدم عند فتح ملفه ──
  React.useEffect(() => {
    if (!userDetail) { setUserRentals([]); return; }
    setUserRentalsLoading(true);
    api.get<Record<string, unknown>[]>(`/api/admin/users/${userDetail.id}/rentals`)
      .then(data => setUserRentals(data))
      .catch(() => setUserRentals([]))
      .finally(() => setUserRentalsLoading(false));
  }, [userDetail?.id]);

  // ── جلب سجل المعاملات عند فتح تبويب التدقيق ──
  useEffect(() => {
    if (tab !== 'audit') return;
    setLedgerLoading(true);
    const url = ledgerTypeFilter
      ? `/api/ledger/admin/all?type=${ledgerTypeFilter}&limit=100`
      : `/api/ledger/admin/all?limit=100`;
    Promise.all([
      api.get<Record<string, unknown>[]>(url),
      api.get<Record<string, unknown>>('/api/ledger/admin/summary'),
    ])
      .then(([entries, summary]) => { setLedgerEntries(entries); setFinancialSummary(summary); })
      .catch(() => {})
      .finally(() => setLedgerLoading(false));
  }, [tab, ledgerTypeFilter]);

  // ── نظام التحديثات اللحظية والنشاط الأخير ──
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const [activities, setActivities] = useState<{ id: string; type: 'user' | 'kyc'; message: string; time: string }[]>([]);
  const [showActivities, setShowActivities] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // إضافة نشاط جديد
  const addActivity = React.useCallback((type: 'user' | 'kyc', message: string) => {
    const id = `${Date.now()}-${Math.random()}`;
    setActivities(prev => [{ id, type, message, time: new Date().toISOString() }, ...prev].slice(0, 20));
    setUnreadCount(c => c + 1);
    toast.info(message, { duration: 4000 });
  }, []);

  // محاكاة التحديثات اللحظية
  React.useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdate(Date.now());
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // محاكاة استقبال بيانات جديدة كل 15 ثانية
  React.useEffect(() => {
    const interval = setInterval(() => {
      const rand = Math.random();
      if (rand < 0.3) {
        addActivity('user', `${t('newRegistration')}: مستخدم جديد في النظام`);
      } else if (rand < 0.6) {
        addActivity('kyc', `${t('newVerificationRequest')}: طلب توثيق جديد`);
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [addActivity, t]);

  // تنسيق وقت النشاط
  const formatTimeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    if (mins < 1) return t('justNow');
    if (mins < 60) return `${mins} ${t('minutesAgo')}`;
    return `${hours} ${t('hoursAgo')}`;
  };

  if (!user?.isAdmin) return (
    <AppLayout>
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-muted-foreground">غير مصرح لك بالوصول</p>
        <Button onClick={() => navigate('/')}>{t('home')}</Button>
      </div>
    </AppLayout>
  );

  const fmt = (n: number) => n.toLocaleString('ar-DZ');

  /* ── تغيير الشعار ── */
  const handleLogoFile = (files: FileList | null) => {
    if (!files?.[0]) return;
    const reader = new FileReader();
    reader.onload = e => setNewLogoUrl(e.target?.result as string);
    reader.readAsDataURL(files[0]);
  };

  const saveLogo = () => {
    if (!newLogoUrl.trim()) return;
    updateLogoUrl(newLogoUrl);
    setLogoDialogOpen(false);
    toast.success('تم تحديث الشعار بنجاح');
  };

  /* ── الحالة ── */
  const statusBadge = (s: string) => {
    if (s === 'verified') return <Badge className="bg-green-500/10 text-green-700 border-green-300 text-xs">{t('verificationApproved')}</Badge>;
    if (s === 'pending') return <Badge className="bg-yellow-500/10 text-yellow-700 border-yellow-300 text-xs">{t('verificationPending')}</Badge>;
    if (s === 'rejected') return <Badge className="bg-destructive/10 text-destructive border-destructive/30 text-xs">{t('verificationRejected')}</Badge>;
    return <Badge variant="outline" className="text-xs">{t('notVerified')}</Badge>;
  };

  const withdrawBadge = (s: string) => {
    if (s === 'processed') return <Badge className="bg-green-500/10 text-green-700 border-green-300 text-xs">مُعالج</Badge>;
    if (s === 'rejected') return <Badge className="bg-destructive/10 text-destructive border-destructive/30 text-xs">مرفوض</Badge>;
    return <Badge className="bg-yellow-500/10 text-yellow-700 border-yellow-300 text-xs">{t('pending')}</Badge>;
  };

  const disputeStatusBadge = (s: string) => {
    if (s === 'open') return <Badge className="bg-amber-500/10 text-amber-700 border-amber-300 text-xs">مفتوح</Badge>;
    if (s === 'under_review') return <Badge className="bg-blue-500/10 text-blue-700 border-blue-300 text-xs">قيد المراجعة</Badge>;
    if (s === 'resolved') return <Badge className="bg-green-500/10 text-green-700 border-green-300 text-xs">تم الحل</Badge>;
    return <Badge className="bg-destructive/10 text-destructive border-destructive/30 text-xs">مرفوض</Badge>;
  };

  /* ── نتائج بحث المستخدمين ── */
  const filteredUsers = phoneSearch.trim().length >= 3
    ? searchUserByPhone(phoneSearch)
    : users;

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-5" dir={isRTL ? 'rtl' : 'ltr'}>
        {/* ── الشريط العلوي مع مؤشر الاتصال المباشر والإشعارات ── */}
        <div className={cn('flex items-center justify-between', isRTL ? 'flex-row-reverse' : '')}>
          <div>
            <h1 className="text-2xl font-bold text-balance">{t('dashboard')}</h1>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
              </span>
              <p className="text-xs text-green-600 font-medium">{t('liveConnection')}</p>
            </div>
          </div>
          <div className={cn('flex items-center gap-2', isRTL ? 'flex-row-reverse' : '')}>
            {/* زر الإشعارات */}
            <Button
              size="sm" variant="outline"
              className="relative gap-1.5"
              onClick={() => { setShowActivities(!showActivities); setUnreadCount(0); }}
            >
              <Bell size={14} />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-destructive text-[10px] text-white flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </Button>
            <img src={settings.logoUrl} alt="logo" className="w-10 h-10 rounded-xl object-contain border border-border" />
            <Button size="sm" variant="outline" onClick={() => setLogoDialogOpen(true)} className="gap-1.5">
              <ImageIcon size={14} /> {t('logoManagement')}
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5 text-primary border-primary/30" onClick={() => setBroadcastOpen(true)}>
              <Radio size={14} /> إرسال إشعار عام
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { logout(); navigate('/login'); }} className="gap-1.5 text-muted-foreground">
              <Settings size={14} />
            </Button>
          </div>
        </div>

        {/* ── لوحة الإشعارات والنشاط الأخير ── */}
        {showActivities && (
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-2">
              <div className={cn('flex items-center justify-between', isRTL ? 'flex-row-reverse' : '')}>
                <CardTitle className="text-base flex items-center gap-2">
                  <Radio size={16} className="text-green-500" />
                  {t('recentActivity')}
                </CardTitle>
                <Button size="sm" variant="ghost" onClick={() => setUnreadCount(0)}>
                  {t('markAllRead')}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {activities.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">{t('noRecentActivity')}</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {activities.map(a => (
                    <div key={a.id} className={cn('flex items-center gap-3 p-2.5 rounded-lg bg-background border border-border', isRTL ? 'flex-row-reverse' : '')}>
                      <div className="shrink-0">
                        {a.type === 'user' ? (
                          <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                            <UserPlus size={14} className="text-blue-600" />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center">
                            <ShieldCheck size={14} className="text-amber-600" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{a.message}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 text-xs text-muted-foreground">
                        <Clock size={11} />
                        {formatTimeAgo(a.time)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="dashboard" className="gap-1.5"><LayoutDashboard size={14} />{t('dashboard')}</TabsTrigger>
            <TabsTrigger value="users" className="gap-1.5 relative">
              <Users size={14} />{t('users')}
              {totalStats.users > 0 && <Badge className="text-xs px-1 py-0 h-4 min-w-[16px]">{totalStats.users}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="blacklist" className="gap-1.5 relative">
              <Ban size={14} />القائمة السوداء
              {users.filter(u => u.accountStatus === 'banned').length > 0 && (
                <Badge className="bg-destructive text-white text-xs px-1 py-0 h-4 min-w-[16px]">{users.filter(u => u.accountStatus === 'banned').length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="kyc" className="gap-1.5 relative">
              <ShieldCheck size={14} />{t('kyc')}
              {totalStats.pendingKYC > 0 && (
                <>
                  <Badge className="bg-amber-500 text-white text-xs px-1 py-0 h-4 min-w-[16px]">{totalStats.pendingKYC}</Badge>
                  <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                </>
              )}
            </TabsTrigger>
            <TabsTrigger value="withdrawals" className="gap-1.5">
              <ArrowUpCircle size={14} />{t('withdrawals')}
              {totalStats.pendingWithdrawals > 0 && <Badge className="bg-amber-500 text-white text-xs px-1 py-0 h-4 min-w-[16px]">{totalStats.pendingWithdrawals}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="disputes" className="gap-1.5">
              <AlertTriangle size={14} />{t('disputes')}
              {totalStats.openDisputes > 0 && <Badge className="bg-amber-500 text-white text-xs px-1 py-0 h-4 min-w-[16px]">{totalStats.openDisputes}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="products" className="gap-1.5">
              <Package size={14} />{t('products')}
              {totalStats.products > 0 && <Badge className="text-xs px-1 py-0 h-4 min-w-[16px]">{totalStats.products}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="review" className="gap-1.5 relative">
              <Eye size={14} />مراجعة المنتجات
              {products.filter(p => p.reviewStatus === 'pending').length > 0 && (
                <Badge className="bg-amber-500 text-white text-xs px-1 py-0 h-4 min-w-[16px]">{products.filter(p => p.reviewStatus === 'pending').length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="cleanup" className="gap-1.5">
              <Trash2 size={14} />{t('dataCleanup')}
            </TabsTrigger>
            <TabsTrigger value="audit" className="gap-1.5">
              <BookOpen size={14} />سجل التدقيق
            </TabsTrigger>
            <TabsTrigger value="reports" className="gap-1.5">
              <FileText size={14} />تقارير PDF
            </TabsTrigger>
            <TabsTrigger value="terms" className="gap-1.5">
              <ScrollText size={14} />سياسة الاستخدام
            </TabsTrigger>
          </TabsList>

          {/* ── لوحة التحكم ── */}
          <TabsContent value="dashboard">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label={t('totalUsers')} value={totalStats.users} icon={Users} />
              <StatCard label={t('totalProducts')} value={totalStats.products} icon={Package} />
              <StatCard label={t('totalOperations')} value={totalStats.operations} icon={TrendingUp} />
              <StatCard label={t('activeRentals')} value={totalStats.activeRentals} icon={Package} accent />
              <StatCard label={t('totalEarnings')} value={fmt(totalStats.earnings) + ' دج'} icon={TrendingUp} accent />
              <StatCard label={t('totalCommissions')} value={fmt(totalStats.commissions) + ' دج'} icon={TrendingUp} />
              <StatCard label={t('totalVerifications')} value={`${totalStats.approvedKYC} / ${totalStats.approvedKYC + totalStats.pendingKYC + totalStats.rejectedKYC}`} icon={ShieldCheck} />
              <StatCard label={t('totalDisputes')} value={totalStats.disputes} icon={XCircle} />
            </div>
            {/* طلبات KYC المعلقة */}
            {totalStats.pendingKYC > 0 && (
              <Card className="mt-4">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ShieldCheck size={16} className="text-amber-500" />
                    {t('pendingKYC')} ({totalStats.pendingKYC})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {pendingKYC.slice(0, 3).map(u => (
                      <div key={u.id} className={cn('flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/50', isRTL ? 'flex-row-reverse' : '')}>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{u.name}</p>
                          <p className="text-xs text-muted-foreground truncate" dir="ltr">{u.phone}</p>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <Button size="sm" className="h-7 px-2 gap-1 text-xs" onClick={() => { approveKYC(u.id); toast.success('تم قبول التوثيق'); }}>
                            <CheckCircle size={11} /> {t('approve')}
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 px-2 gap-1 text-xs text-destructive border-destructive/30" onClick={() => { setKycRejectUserId(u.id); setKycRejectReason(''); }}>
                            <XCircle size={11} /> {t('reject')}
                          </Button>
                        </div>
                      </div>
                    ))}
                    {totalStats.pendingKYC > 3 && (
                      <Button variant="ghost" size="sm" className="w-full" onClick={() => setTab('kyc')}>
                        عرض الكل ({totalStats.pendingKYC})
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ── آخر التسجيلات ── */}
            <Card className="mt-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <UserPlus size={16} className="text-blue-500" />
                  {t('newRegistration')} — {t('users')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {users.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5).map(u => (
                    <div key={u.id} className={cn('flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/50', isRTL ? 'flex-row-reverse' : '')}>
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <Users size={12} className="text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{u.name}</p>
                          <p className="text-xs text-muted-foreground truncate" dir="ltr">{u.phone} — {u.wilayaName}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {statusBadge(u.verificationStatus)}
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setUserDetail(u)}>
                          <Eye size={12} />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── المستخدمون + البحث بالهاتف + حظر/تجميد ── */}
          <TabsContent value="users">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t('users')}</CardTitle>
                {/* شريط البحث برقم الهاتف */}
                <div className={cn('flex items-center gap-2 mt-2', isRTL ? 'flex-row-reverse' : '')}>
                  <div className="relative flex-1">
                    <Search size={14} className={cn('absolute top-1/2 -translate-y-1/2 text-muted-foreground', isRTL ? 'right-3' : 'left-3')} />
                    <Input
                      value={phoneSearch}
                      onChange={e => setPhoneSearch(e.target.value)}
                      placeholder="البحث برقم الهاتف..."
                      className={cn('px-3 h-9', isRTL ? 'pr-8' : 'pl-8')}
                      dir="ltr"
                    />
                  </div>
                  {phoneSearch && (
                    <Button size="sm" variant="ghost" onClick={() => setPhoneSearch('')} className="h-9 px-2 text-muted-foreground">
                      <XCircle size={14} />
                    </Button>
                  )}
                </div>
                {phoneSearch.trim().length >= 3 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {filteredUsers.length === 0 ? 'لم يُعثر على مستخدم' : `${filteredUsers.length} نتيجة`}
                  </p>
                )}
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="whitespace-nowrap">{t('name')}</TableHead>
                        <TableHead className="whitespace-nowrap">{t('phone')}</TableHead>
                        <TableHead className="whitespace-nowrap">{t('wilaya')}</TableHead>
                        <TableHead className="whitespace-nowrap">التوثيق</TableHead>
                        <TableHead className="whitespace-nowrap">الحساب</TableHead>
                        <TableHead className="whitespace-nowrap">الإجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map(u => (
                        <TableRow key={u.id}>
                          <TableCell className="whitespace-nowrap">
                            <button
                              className="text-start hover:underline font-medium"
                              onClick={() => setUserDetail(u)}
                            >
                              {u.name}
                            </button>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-muted-foreground text-sm" dir="ltr">
                            <span className={cn('flex items-center gap-1', isRTL ? 'flex-row-reverse' : '')}>
                              <PhoneCall size={11} /> {u.phone}
                            </span>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">{u.wilayaName}</TableCell>
                          <TableCell className="whitespace-nowrap">{statusBadge(u.verificationStatus)}</TableCell>
                          <TableCell className="whitespace-nowrap">
                            <AccountStatusBadge status={u.accountStatus} />
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <div className="flex gap-1">
                              {u.accountStatus === 'active' ? (
                                <>
                                  <Button
                                    size="sm" variant="outline"
                                    className="h-7 px-2 text-xs gap-1 text-destructive border-destructive/30 hover:bg-destructive/5"
                                    onClick={() => { banUser(u.id); toast.error(`تم حظر حساب ${u.name}`); }}
                                  >
                                    <Ban size={10} /> حظر
                                  </Button>
                                  <Button
                                    size="sm" variant="outline"
                                    className="h-7 px-2 text-xs gap-1 text-blue-600 border-blue-300 hover:bg-blue-500/5"
                                    onClick={() => { freezeUser(u.id); toast.info(`تم تجميد حساب ${u.name}`); }}
                                  >
                                    <Snowflake size={10} /> تجميد
                                  </Button>
                                </>
                              ) : u.accountStatus === 'banned' ? (
                                <Button
                                  size="sm" variant="outline"
                                  className="h-7 px-2 text-xs gap-1 text-green-600 border-green-300"
                                  onClick={() => { unbanUser(u.id); toast.success(`تم رفع الحظر عن ${u.name}`); }}
                                >
                                  <UserCheck size={10} /> رفع الحظر
                                </Button>
                              ) : (
                                <Button
                                  size="sm" variant="outline"
                                  className="h-7 px-2 text-xs gap-1 text-green-600 border-green-300"
                                  onClick={() => { unfreezeUser(u.id); toast.success(`تم رفع التجميد عن ${u.name}`); }}
                                >
                                  <UserCheck size={10} /> رفع التجميد
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── القائمة السوداء ── */}
          <TabsContent value="blacklist">
            <Card>
              <CardHeader className="pb-2">
                <div className={cn('flex items-center justify-between gap-2', isRTL ? 'flex-row-reverse' : '')}>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Ban size={16} className="text-destructive" /> المستخدمون المحظورون
                  </CardTitle>
                  <div className="relative w-full max-w-xs">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="بحث بالاسم أو الهاتف..."
                      className="pl-9 text-sm h-8"
                      value={blacklistSearch}
                      onChange={e => setBlacklistSearch(e.target.value)}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>المستخدم</TableHead>
                        <TableHead>الهاتف</TableHead>
                        <TableHead>الولاية</TableHead>
                        <TableHead>الحالة</TableHead>
                        <TableHead>الإجراء</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users
                        .filter(u => u.accountStatus === 'banned')
                        .filter(u => !blacklistSearch || u.name.includes(blacklistSearch) || u.phone.includes(blacklistSearch))
                        .map(u => (
                          <TableRow key={u.id}>
                            <TableCell className="whitespace-nowrap">
                              <div className={cn('flex items-center gap-2', isRTL ? 'flex-row-reverse' : '')}>
                                <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
                                  {u.avatarUri ? <img src={u.avatarUri} alt="" className="w-full h-full object-cover" /> : <UserCheck size={12} />}
                                </div>
                                <span className="font-medium text-sm">{u.name}</span>
                              </div>
                            </TableCell>
                            <TableCell className="whitespace-nowrap" dir="ltr">{u.phone}</TableCell>
                            <TableCell className="whitespace-nowrap">{u.wilayaName}</TableCell>
                            <TableCell className="whitespace-nowrap"><AccountStatusBadge status="banned" /></TableCell>
                            <TableCell className="whitespace-nowrap">
                              <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1 text-green-600 border-green-300"
                                onClick={() => { unbanUser(u.id); toast.success(`تم رفع الحظر عن ${u.name}`); }}>
                                <UserCheck size={10} /> رفع الحظر
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      {users.filter(u => u.accountStatus === 'banned').length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                            <Ban size={24} className="mx-auto mb-2 opacity-40" />
                            لا يوجد مستخدمون محظورون
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── KYC ── */}
          <TabsContent value="kyc">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{t('verificationRequests')}</CardTitle>
              </CardHeader>
              <CardContent>
                {kycRequests.filter(k => k.status === 'pending').length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <ShieldCheck size={32} className="mx-auto mb-2 opacity-40" />
                    <p className="text-sm">لا توجد طلبات توثيق معلقة</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {kycRequests.filter(k => k.status === 'pending').map(k => (
                      <div key={k.id} className="border border-border rounded-lg p-4 space-y-3">
                        <div className={cn('flex items-start justify-between gap-2', isRTL ? 'flex-row-reverse' : '')}>
                          <div>
                            <p className="font-semibold">{k.userName}</p>
                            <p className="text-sm text-muted-foreground" dir="ltr">{k.userEmail}</p>
                            <p className="text-sm text-muted-foreground" dir="ltr">{k.userPhone}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(k.createdAt).toLocaleDateString('ar-DZ')}
                            </p>
                          </div>
                          {statusBadge('pending')}
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {[k.idFrontUri, k.idBackUri, k.selfieUri].map((uri, idx) => (
                            <div key={idx} className="aspect-[4/3] rounded-lg border border-border overflow-hidden bg-muted relative">
                              {uri && uri !== 'camera_capture' ? (
                                <img
                                  src={uri}
                                  alt={idx === 0 ? 'Front' : idx === 1 ? 'Back' : 'Selfie'}
                                  className="w-full h-full object-cover"
                                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground p-1 text-center">
                                  {idx === 0 ? t('idFront') : idx === 1 ? t('idBack') : t('selfie')}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                        <div className={cn('flex gap-2', isRTL ? 'flex-row-reverse' : '')}>
                          <Button size="sm" className="flex-1 gap-1.5" onClick={() => { approveKYC(k.userId); toast.success(`${t('kycApproved')} — ${k.userName}`); }}>
                            <CheckCircle size={13} /> {t('approveKyc')}
                          </Button>
                          <Button size="sm" variant="outline" className="flex-1 gap-1.5 text-destructive border-destructive/30" onClick={() => { setKycRejectUserId(k.userId); setKycRejectReason(''); }}>
                            <XCircle size={13} /> {t('rejectKyc')}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <Separator className="my-4" />
                <p className="text-sm font-medium text-muted-foreground mb-3">{t('verificationStatus')}</p>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="whitespace-nowrap">{t('name')}</TableHead>
                        <TableHead className="whitespace-nowrap">{t('phone')}</TableHead>
                        <TableHead className="whitespace-nowrap">{t('verificationStatus')}</TableHead>
                        <TableHead className="whitespace-nowrap">{t('rejectionReason')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {kycRequests.map(k => (
                        <TableRow key={k.id}>
                          <TableCell className="whitespace-nowrap">
                            <div>
                              <p className="font-medium">{k.userName}</p>
                              <p className="text-xs text-muted-foreground" dir="ltr">{k.userEmail}</p>
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm" dir="ltr">{k.userPhone}</TableCell>
                          <TableCell className="whitespace-nowrap">{statusBadge(k.status === 'approved' ? 'verified' : k.status === 'rejected' ? 'rejected' : 'pending')}</TableCell>
                          <TableCell className="whitespace-nowrap text-xs text-muted-foreground max-w-[200px] truncate">
                            {k.rejectionReason || '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── طلبات السحب ── */}
          <TabsContent value="withdrawals">
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="whitespace-nowrap">{t('name')}</TableHead>
                        <TableHead className="whitespace-nowrap">{t('phone')}</TableHead>
                        <TableHead className="whitespace-nowrap">{t('ccpNumber')}</TableHead>
                        <TableHead className="whitespace-nowrap">{t('selectAmount')}</TableHead>
                        <TableHead className="whitespace-nowrap">الحالة</TableHead>
                        <TableHead className="whitespace-nowrap">الإجراء</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {withdrawals.map(w => (
                        <TableRow key={w.id}>
                          <TableCell className="whitespace-nowrap font-medium">{w.userName}</TableCell>
                          <TableCell className="whitespace-nowrap" dir="ltr">{w.phone}</TableCell>
                          <TableCell className="whitespace-nowrap font-mono text-xs" dir="ltr">{w.ccpNumber}</TableCell>
                          <TableCell className="whitespace-nowrap font-bold text-primary">{fmt(w.amount)} {t('dz')}</TableCell>
                          <TableCell className="whitespace-nowrap">{withdrawBadge(w.status)}</TableCell>
                          <TableCell className="whitespace-nowrap">
                            {w.status === 'pending' && (
                              <div className="flex gap-1">
                                <Button size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => { processWithdrawal(w.id); toast.success('تمت معالجة السحب'); }}>
                                  <CheckCircle size={10} /> {t('process')}
                                </Button>
                                <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1 text-destructive" onClick={() => { rejectWithdrawal(w.id); toast.info('تم رفض السحب'); }}>
                                  <XCircle size={10} /> {t('reject')}
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── النزاعات ── */}
          <TabsContent value="disputes">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle size={16} className="text-amber-500" />
                  {t('disputes')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {disputes.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <MessageSquare size={32} className="mx-auto mb-2 opacity-40" />
                    <p className="text-sm">لا توجد نزاعات مسجّلة</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {disputes.map(d => (
                      <div key={d.id} className="border border-border rounded-lg p-4 space-y-3">
                        <div className={cn('flex items-start justify-between gap-2', isRTL ? 'flex-row-reverse' : '')}>
                          <div className="min-w-0">
                            <p className="font-semibold text-sm">{d.title}</p>
                            <p className="text-xs text-muted-foreground">{d.productTitle}</p>
                          </div>
                          {disputeStatusBadge(d.status)}
                        </div>
                        {/* معلومات الطرفين جنبًا إلى جنب */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className={cn('rounded-lg p-2.5 border text-xs space-y-0.5', d.filedBy === 'renter' ? 'bg-amber-500/5 border-amber-300/40' : 'bg-muted/50 border-border')}>
                            <p className="font-semibold text-xs text-muted-foreground mb-1">
                              {d.filedBy === 'renter' ? '🟡 المستأجر (مقدّم النزاع)' : '⚪ المؤجّر'}
                            </p>
                            <p className="font-medium truncate">{d.userName}</p>
                            <p className="text-muted-foreground" dir="ltr">{d.userPhone}</p>
                          </div>
                          <div className={cn('rounded-lg p-2.5 border text-xs space-y-0.5', d.filedBy === 'owner' ? 'bg-amber-500/5 border-amber-300/40' : 'bg-muted/50 border-border')}>
                            <p className="font-semibold text-xs text-muted-foreground mb-1">
                              {d.filedBy === 'owner' ? '🟡 المؤجّر (مقدّم النزاع)' : '⚪ المستأجر'}
                            </p>
                            <p className="font-medium truncate">{d.otherPartyName || '—'}</p>
                            <p className="text-muted-foreground" dir="ltr">{d.otherPartyPhone || '—'}</p>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground bg-muted/50 rounded p-2 text-pretty">{d.description}</p>
                        <Button
                          size="sm" variant="outline" className="w-full gap-1.5"
                          onClick={() => { setDisputeDetail(d); setDisputeNotes(d.adminNotes || ''); }}
                        >
                          <FileText size={13} /> التفاصيل والتدخل
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── المنتجات (إدارة الأدمن) ── */}
          <TabsContent value="products">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Package size={16} />
                  {t('allProducts')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="whitespace-nowrap">{t('title')}</TableHead>
                        <TableHead className="whitespace-nowrap">{t('owner')}</TableHead>
                        <TableHead className="whitespace-nowrap">{t('purchasePrice')}</TableHead>
                        <TableHead className="whitespace-nowrap">{t('stockQuantity')}</TableHead>
                        <TableHead className="whitespace-nowrap">{t('status')}</TableHead>
                        <TableHead className="whitespace-nowrap">{t('delete')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {products.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            {t('noResults')}
                          </TableCell>
                        </TableRow>
                      ) : (
                        products.map(p => (
                          <TableRow key={p.id}>
                            <TableCell className="whitespace-nowrap font-medium text-sm">{p.title}</TableCell>
                            <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{p.ownerName}</TableCell>
                            <TableCell className="whitespace-nowrap text-sm">{fmt(p.purchasePrice)} {t('dz')}</TableCell>
                            <TableCell className="whitespace-nowrap text-sm">{p.availableQuantity} / {p.stockQuantity}</TableCell>
                            <TableCell className="whitespace-nowrap">
                              {p.isFrozen ? (
                                <Badge className="bg-blue-500/10 text-blue-700 border-blue-300 text-xs">مجمّد</Badge>
                              ) : p.availableQuantity > 0 ? (
                                <Badge className="bg-green-500/10 text-green-700 border-green-300 text-xs">{t('available')}</Badge>
                              ) : (
                                <Badge className="bg-destructive/10 text-destructive border-destructive/30 text-xs">{t('rented')}</Badge>
                              )}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              <div className="flex gap-1">
                                <Button
                                  size="sm" variant="outline"
                                  className="h-7 px-2 text-xs gap-1 text-destructive border-destructive/30"
                                  onClick={() => { setProductDeleteId(p.id); setProductDeleteReason(''); }}
                                >
                                  <Trash2 size={10} /> {t('delete')}
                                </Button>
                                <Button
                                  size="sm" variant="outline"
                                  className="h-7 px-2 text-xs gap-1 text-blue-600 border-blue-300"
                                  onClick={() => {
                                    updateProduct(p.id, { isFrozen: !p.isFrozen });
                                    toast.success(p.isFrozen ? 'تم رفع التجميد' : 'تم تجميد المنتج');
                                  }}
                                >
                                  <Snowflake size={10} /> {p.isFrozen ? 'رفع التجميد' : 'تجميد'}
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── مراجعة المنتجات ── */}
          <TabsContent value="review">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Eye size={16} />
                  مراجعة المنتجات المقدمة
                </CardTitle>
              </CardHeader>
              <CardContent>
                {products.filter(p => p.reviewStatus === 'pending').length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package size={28} className="mx-auto mb-2 opacity-40" />
                    <p className="text-sm">لا توجد منتجات قيد المراجعة</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {products.filter(p => p.reviewStatus === 'pending').map(p => (
                      <Card key={p.id} className="overflow-hidden">
                        <CardContent className="p-3 space-y-3">
                          <div className="flex items-start gap-3">
                            {p.images[0] && (
                              <img src={p.images[0]} alt={p.title} className="w-20 h-20 rounded-lg object-cover shrink-0 border border-border" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm">{p.title}</p>
                              <p className="text-xs text-muted-foreground">{p.ownerName}</p>
                              <p className="text-xs text-muted-foreground">{p.wilayaName}</p>
                              <p className="text-xs font-medium mt-1">{fmt(p.rentalPrice)} دج/يوم — وديعة: {fmt(p.deposit)} دج</p>
                            </div>
                          </div>
                          {/* معرض الصور الكامل */}
                          {p.images.length > 1 && (
                            <div className="flex gap-2 overflow-x-auto pb-1">
                              {p.images.map((img, idx) => (
                                <img key={idx} src={img} alt={`صورة ${idx + 1}`} className="w-16 h-16 rounded-md object-cover shrink-0 border border-border" />
                              ))}
                            </div>
                          )}
                          {/* فيديو المنتج */}
                          {p.videoUri && (
                            <div className="rounded-lg overflow-hidden border border-border bg-black">
                              <video
                                src={p.videoUri}
                                controls
                                className="w-full max-h-48 object-contain"
                              />
                            </div>
                          )}
                          {/* وصف المنتج */}
                          {p.description && (
                            <p className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2 text-pretty">{p.description}</p>
                          )}
                          <div className="flex gap-2">
                            <Button size="sm" className="flex-1 gap-1"
                              onClick={() => { updateProduct(p.id, { reviewStatus: 'approved' }); toast.success(`تم قبول المنتج: ${p.title}`); }}>
                              <CheckCircle size={13} /> قبول ونشر
                            </Button>
                            <Button size="sm" variant="outline" className="flex-1 gap-1 text-destructive border-destructive/30"
                              onClick={() => { setProductReviewId(p.id); setProductReviewReason(''); }}>
                              <XCircle size={13} /> رفض
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── تنظيف البيانات ── */}
          <TabsContent value="cleanup">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <HardDrive size={16} />
                  {t('dataCleanup')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className={cn('flex items-start gap-3 p-4 rounded-lg border border-amber-400/30 bg-amber-500/8', isRTL ? 'flex-row-reverse' : '')}>
                  <AlertTriangle size={18} className="shrink-0 text-amber-600 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{t('cleanupConfirm')}</p>
                    <p className="text-xs text-muted-foreground mt-1 text-pretty">
                      هذا الإجراء نهائي ولا يمكن التراجع عنه. يُستخدم قبل الإطلاق الفعلي للمنصة.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="pt-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <Users size={18} className="text-muted-foreground" />
                        <p className="font-semibold">{t('clearTestAccounts')}</p>
                      </div>
                      <p className="text-xs text-muted-foreground text-pretty">
                        حذف جميع الحسابات التجريبية (الحسابات التي تحتوي على test أو demo في البريد).
                      </p>
                      <Button
                        variant="outline" className="w-full gap-1.5 text-destructive border-destructive/30"
                        onClick={() => { setCleanupType('accounts'); setCleanupConfirmOpen(true); }}
                      >
                        <Trash2 size={13} /> {t('clearTestAccounts')}
                      </Button>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <Package size={18} className="text-muted-foreground" />
                        <p className="font-semibold">{t('clearOldProducts')}</p>
                      </div>
                      <p className="text-xs text-muted-foreground text-pretty">
                        حذف جميع المنتجات القديمة الموجودة في قاعدة البيانات نهائياً.
                      </p>
                      <Button
                        variant="outline" className="w-full gap-1.5 text-destructive border-destructive/30"
                        onClick={() => { setCleanupType('products'); setCleanupConfirmOpen(true); }}
                      >
                        <Trash2 size={13} /> {t('clearOldProducts')}
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── سجل التدقيق المالي ── */}
          <TabsContent value="audit">
            <div className="space-y-4">
              {/* KPIs */}
              {financialSummary && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <StatCard label="أرباح المنصة (عمولات)" value={fmt(financialSummary.platformEarnings as number) + ' دج'} icon={DollarSign} accent />
                  <StatCard label="حجم الإيجارات الكلي" value={fmt(financialSummary.totalRentalVolume as number) + ' دج'} icon={TrendingUp} />
                  <StatCard label="إجمالي الغرامات" value={fmt(financialSummary.totalPenalties as number) + ' دج'} icon={AlertTriangle} />
                  <StatCard label="ضمانات مجمدة" value={fmt(financialSummary.totalFrozenDeposits as number) + ' دج'} icon={HardDrive} />
                  <StatCard label="إيجارات نشطة" value={String(financialSummary.activeRentals)} icon={Package} />
                </div>
              )}

              {/* Filter */}
              <div className={cn('flex items-center gap-2', isRTL ? 'flex-row-reverse' : '')}>
                <Filter size={14} className="text-muted-foreground" />
                <Select value={ledgerTypeFilter} onValueChange={setLedgerTypeFilter}>
                  <SelectTrigger className="w-[200px] h-8 text-xs">
                    <SelectValue placeholder="تصفية حسب النوع" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">الكل</SelectItem>
                    <SelectItem value="rental_payment">دفع إيجار</SelectItem>
                    <SelectItem value="deposit_freeze">تجميد ضمان</SelectItem>
                    <SelectItem value="deposit_release">إفراج ضمان</SelectItem>
                    <SelectItem value="payout_owner">دخل المؤجر</SelectItem>
                    <SelectItem value="late_penalty">غرامة تأخير</SelectItem>
                    <SelectItem value="platform_fee">عمولة منصة</SelectItem>
                    <SelectItem value="deposit_topup">إيداع رصيد</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => setLedgerTypeFilter('')}>
                  <XCircle size={12} /> إعادة تعيين
                </Button>
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BookOpen size={16} className="text-primary" />
                    سجل المعاملات المالية
                    <Badge variant="outline" className="text-xs">{ledgerEntries.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {ledgerLoading ? (
                    <p className="text-sm text-muted-foreground text-center py-8">جارٍ تحميل السجل...</p>
                  ) : ledgerEntries.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">لا توجد معاملات</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">التاريخ</TableHead>
                            <TableHead className="text-xs">المستخدم</TableHead>
                            <TableHead className="text-xs">النوع</TableHead>
                            <TableHead className="text-xs">المنتج</TableHead>
                            <TableHead className="text-xs text-left">المبلغ</TableHead>
                            <TableHead className="text-xs text-left">الرصيد بعد</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {ledgerEntries.slice(0, 100).map((e, i) => {
                            const isDebit = ['rental_payment','deposit_freeze','late_penalty','platform_fee','dispute_deduction'].includes(e.type as string);
                            const TYPE_LABELS: Record<string, string> = {
                              deposit_topup: 'إيداع',
                              rental_payment: 'دفع إيجار',
                              deposit_freeze: 'تجميد ضمان',
                              deposit_unfreeze: 'فك تجميد',
                              payout_owner: 'دخل مؤجر',
                              late_penalty: 'غرامة تأخير',
                              platform_fee: 'عمولة منصة',
                              dispute_deduction: 'خصم نزاع',
                              deposit_release: 'إفراج ضمان',
                            };
                            return (
                              <TableRow key={i}>
                                <TableCell className="text-xs text-muted-foreground">
                                  {new Date(e.created_at as string).toLocaleString('ar-DZ', { dateStyle: 'short', timeStyle: 'short' })}
                                </TableCell>
                                <TableCell className="text-xs">
                                  <p className="font-medium">{e.user_name as string || '—'}</p>
                                  <p className="text-muted-foreground text-[10px]" dir="ltr">{e.user_phone as string || ''}</p>
                                </TableCell>
                                <TableCell className="text-xs">
                                  <Badge
                                    className={cn('text-xs', isDebit
                                      ? 'bg-destructive/10 text-destructive border-destructive/30'
                                      : 'bg-green-500/10 text-green-700 border-green-300')}
                                  >
                                    {TYPE_LABELS[e.type as string] || e.type as string}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">
                                  {e.product_title as string || '—'}
                                </TableCell>
                                <TableCell className={cn('text-xs font-semibold text-left', isDebit ? 'text-destructive' : 'text-green-600')}>
                                  {isDebit ? '-' : '+'}{fmt(e.amount as number)} دج
                                </TableCell>
                                <TableCell className="text-xs text-left text-muted-foreground">
                                  {fmt(e.balance_after as number)} دج
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── تقارير PDF ── */}
          <TabsContent value="reports">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-5 space-y-3">
                    <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                      <FileText size={22} className="text-blue-600" />
                    </div>
                    <h3 className="font-semibold">تقرير حركة المحافظ</h3>
                    <p className="text-xs text-muted-foreground text-pretty">
                      جميع المعاملات المالية مُجمَّعة حسب المستخدم: إيداعات، إيجارات، ضمانات، مدفوعات.
                    </p>
                    <a href="/api/pdf/wallet-ledger" target="_blank" rel="noopener noreferrer">
                      <Button className="w-full gap-2 mt-1">
                        <Download size={14} /> تحميل PDF
                      </Button>
                    </a>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-5 space-y-3">
                    <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                      <TrendingUp size={22} className="text-green-600" />
                    </div>
                    <h3 className="font-semibold">تقرير العمليات التشغيلية</h3>
                    <p className="text-xs text-muted-foreground text-pretty">
                      جميع عمليات الإيجار بتفاصيلها: المؤجرون، المستأجرون، المدة، الرسوم، الحالة.
                    </p>
                    <a href="/api/pdf/operations" target="_blank" rel="noopener noreferrer">
                      <Button className="w-full gap-2 mt-1" variant="outline">
                        <Download size={14} /> تحميل PDF
                      </Button>
                    </a>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-5 space-y-3">
                    <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                      <DollarSign size={22} className="text-amber-600" />
                    </div>
                    <h3 className="font-semibold">التقرير المالي العام</h3>
                    <p className="text-xs text-muted-foreground text-pretty">
                      ملخص مالي شامل: أرباح المنصة، الحجم الإجمالي، الأداء الشهري، توزيع العمليات.
                    </p>
                    <a href="/api/pdf/financial-summary" target="_blank" rel="noopener noreferrer">
                      <Button className="w-full gap-2 mt-1" variant="outline">
                        <Download size={14} /> تحميل PDF
                      </Button>
                    </a>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-amber-400/30 bg-amber-500/5">
                <CardContent className="pt-4">
                  <p className="text-xs text-amber-700 flex items-start gap-2">
                    <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                    التقارير سرية ومخصصة للإدارة فقط. تُولَّد في الوقت الفعلي من قاعدة البيانات وتعكس أحدث البيانات.
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── سياسة الاستخدام ── */}
          <TabsContent value="terms">
            <Card>
              <CardContent className="pt-5">
                <TermsContent />
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      </div>

      {/* ── نافذة تفاصيل المستخدم الكاملة ── */}
      <Dialog open={!!userDetail} onOpenChange={() => setUserDetail(null)}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-xl max-h-[90vh] overflow-y-auto" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Users size={14} className="text-primary" />
              </div>
              ملف المستخدم — {userDetail?.name}
            </DialogTitle>
          </DialogHeader>
          {userDetail && (
            <div className="space-y-4">
              {/* المعلومات الأساسية */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-xs text-muted-foreground">الاسم</p><p className="font-medium">{userDetail.name}</p></div>
                <div><p className="text-xs text-muted-foreground">الهاتف</p><p className="font-medium" dir="ltr">{userDetail.phone}</p></div>
                <div><p className="text-xs text-muted-foreground">الولاية</p><p>{userDetail.wilayaName}</p></div>
                <div><p className="text-xs text-muted-foreground">التوثيق</p>{statusBadge(userDetail.verificationStatus)}</div>
                <div><p className="text-xs text-muted-foreground">حالة الحساب</p><AccountStatusBadge status={userDetail.accountStatus} /></div>
                <div><p className="text-xs text-muted-foreground">تاريخ التسجيل</p><p className="text-xs">{new Date(userDetail.createdAt).toLocaleDateString('ar-DZ')}</p></div>
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground mb-1">قبول شروط الاستخدام</p>
                  {userDetail.termsAcceptedAt ? (
                    <div className="flex items-center gap-2">
                      <Badge className="gap-1 bg-green-500/10 text-green-700 border-green-300 text-xs" variant="outline">
                        <CheckCircle size={11} /> مقبولة
                      </Badge>
                      <span className="text-xs text-muted-foreground" dir="ltr">
                        {new Date(userDetail.termsAcceptedAt).toLocaleString('ar-DZ', { dateStyle: 'medium', timeStyle: 'short' })}
                      </span>
                    </div>
                  ) : (
                    <Badge className="gap-1 bg-amber-500/10 text-amber-700 border-amber-300 text-xs" variant="outline">
                      <AlertTriangle size={11} /> لم يقبل بعد
                    </Badge>
                  )}
                </div>
                <div><p className="text-xs text-muted-foreground">الرصيد</p><p className="font-medium">{fmt(userDetail.walletBalance)} دج</p></div>
                <div><p className="text-xs text-muted-foreground">الأرباح</p><p className="font-medium">{fmt(userDetail.earningsBalance)} دج</p></div>
                <div><p className="text-xs text-muted-foreground">إجمالي الإيجارات</p><p>{userDetail.totalRentals}</p></div>
                {userDetail.email && <div className="col-span-2"><p className="text-xs text-muted-foreground">البريد</p><p className="text-sm" dir="ltr">{userDetail.email}</p></div>}
              </div>

              {/* وثائق KYC */}
              {(() => {
                const kyc = kycRequests.find(k => k.userId === userDetail.id);
                if (!kyc) return null;
                return (
                  <>
                    <Separator />
                    <div>
                      <p className="text-sm font-semibold flex items-center gap-1.5 mb-3">
                        <ShieldCheck size={14} className="text-primary" /> وثائق التوثيق
                        <Badge className={cn('text-xs', kyc.status === 'approved' ? 'bg-green-500/10 text-green-700 border-green-300' : kyc.status === 'rejected' ? 'bg-destructive/10 text-destructive border-destructive/30' : 'bg-amber-500/10 text-amber-700 border-amber-300')}>
                          {kyc.status === 'approved' ? 'مقبول' : kyc.status === 'rejected' ? 'مرفوض' : 'قيد المراجعة'}
                        </Badge>
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {[{ label: 'وجه الهوية', uri: kyc.idFrontUri }, { label: 'خلف الهوية', uri: kyc.idBackUri }, { label: 'صورة ذاتية', uri: kyc.selfieUri }].map((item, idx) => (
                          <div key={idx} className="space-y-1">
                            <p className="text-xs text-muted-foreground text-center">{item.label}</p>
                            {item.uri && item.uri !== 'camera_capture' ? (
                              <a href={item.uri} target="_blank" rel="noopener noreferrer">
                                <img src={item.uri} alt={item.label} className="w-full h-24 object-cover rounded-lg border border-border bg-muted hover:opacity-80 transition-opacity cursor-pointer" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                              </a>
                            ) : (
                              <div className="w-full h-24 rounded-lg border border-border bg-muted flex items-center justify-center text-xs text-muted-foreground">لا توجد صورة</div>
                            )}
                          </div>
                        ))}
                      </div>
                      {kyc.status === 'pending' && (
                        <div className="flex gap-2 mt-3">
                          <Button size="sm" className="flex-1 gap-1" onClick={() => { approveKYC(userDetail.id); toast.success('تم قبول التوثيق'); setUserDetail(null); }}>
                            <CheckCircle size={12} /> قبول التوثيق
                          </Button>
                          <Button size="sm" variant="outline" className="flex-1 gap-1 text-destructive border-destructive/30" onClick={() => { setKycRejectUserId(userDetail.id); setKycRejectReason(''); setUserDetail(null); }}>
                            <XCircle size={12} /> رفض
                          </Button>
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}

              {/* تاريخ الإيجارات */}
              <Separator />
              <div>
                <p className="text-sm font-semibold flex items-center gap-1.5 mb-2">
                  <Package size={14} className="text-primary" /> تاريخ الإيجارات
                  {userRentals.length > 0 && <Badge variant="outline" className="text-xs">{userRentals.length}</Badge>}
                </p>
                {userRentalsLoading ? (
                  <p className="text-xs text-muted-foreground text-center py-4">جارٍ التحميل...</p>
                ) : userRentals.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">لا توجد إيجارات</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {userRentals.map((r, i) => (
                      <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 text-xs">
                        {r.product_image && <img src={r.product_image as string} alt="" className="w-8 h-8 rounded object-cover shrink-0" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{r.product_title as string}</p>
                          <p className="text-muted-foreground">{r.duration_days as number} يوم — {((r.total_amount as number) || 0).toLocaleString('ar-DZ')} دج</p>
                        </div>
                        <Badge className={cn('text-xs shrink-0', r.status === 'completed' ? 'bg-green-500/10 text-green-700 border-green-300' : r.status === 'active' ? 'bg-blue-500/10 text-blue-700 border-blue-300' : r.status === 'cancelled' ? 'bg-destructive/10 text-destructive border-destructive/30' : 'bg-amber-500/10 text-amber-700 border-amber-300')}>
                          {r.status === 'completed' ? 'مكتمل' : r.status === 'active' ? 'نشط' : r.status === 'cancelled' ? 'ملغى' : 'معلق'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Separator />
              <div className={cn('flex gap-2', isRTL ? 'flex-row-reverse' : '')}>
                {userDetail.accountStatus === 'active' ? (
                  <>
                    <Button size="sm" variant="outline" className="flex-1 gap-1 text-destructive border-destructive/30"
                      onClick={() => { banUser(userDetail.id); toast.error(`تم حظر ${userDetail.name}`); setUserDetail(null); }}>
                      <Ban size={12} /> حظر الحساب
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 gap-1 text-blue-600 border-blue-300"
                      onClick={() => { freezeUser(userDetail.id); toast.info(`تم تجميد ${userDetail.name}`); setUserDetail(null); }}>
                      <Snowflake size={12} /> تجميد
                    </Button>
                  </>
                ) : userDetail.accountStatus === 'banned' ? (
                  <Button size="sm" className="flex-1 gap-1"
                    onClick={() => { unbanUser(userDetail.id); toast.success('تم رفع الحظر'); setUserDetail(null); }}>
                    <UserCheck size={12} /> رفع الحظر
                  </Button>
                ) : (
                  <Button size="sm" className="flex-1 gap-1"
                    onClick={() => { unfreezeUser(userDetail.id); toast.success('تم رفع التجميد'); setUserDetail(null); }}>
                    <UserCheck size={12} /> رفع التجميد
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── نافذة عرض ملفات التوثيق ── */}
      <Dialog open={!!kycViewUser} onOpenChange={() => setKycViewUser(null)}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>ملفات التوثيق — {kycViewUser?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3">
              {kycViewUser && [
                { label: t('idFront'), uri: kycViewUser.idFrontUri },
                { label: t('idBack'), uri: kycViewUser.idBackUri },
                { label: t('selfie'), uri: kycViewUser.selfieUri },
              ].map((item, idx) => (
                <div key={idx} className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
                  {item.uri && item.uri !== 'camera_capture' ? (
                    <img
                      src={item.uri}
                      alt={item.label}
                      className="w-full h-40 object-contain rounded-lg border border-border bg-muted"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <div className="w-full h-20 rounded-lg border border-border bg-muted flex items-center justify-center text-xs text-muted-foreground">
                      لا توجد صورة
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className={cn('flex gap-2', isRTL ? 'flex-row-reverse' : '')}>
              {kycViewUser?.verificationStatus === 'pending' && (
                <>
                  <Button size="sm" className="flex-1 gap-1.5"
                    onClick={() => { if (kycViewUser) { approveKYC(kycViewUser.id); toast.success(t('kycApproved')); setKycViewUser(null); } }}>
                    <CheckCircle size={13} /> {t('approve')}
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1 gap-1.5 text-destructive border-destructive/30"
                    onClick={() => { if (kycViewUser) { setKycRejectUserId(kycViewUser.id); setKycRejectReason(''); setKycViewUser(null); } }}>
                    <XCircle size={13} /> {t('reject')}
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── نافذة تفاصيل النزاع (الطرفان معًا) ── */}
      <Dialog open={!!disputeDetail} onOpenChange={() => { setDisputeDetail(null); setDisputeNotes(''); }}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>تفاصيل النزاع</DialogTitle>
          </DialogHeader>
          {disputeDetail && (
            <div className="space-y-4">
              <div>
                <p className="font-semibold">{disputeDetail.title}</p>
                <p className="text-xs text-muted-foreground">{disputeDetail.productTitle}</p>
                <div className="flex items-center gap-2 mt-1">
                  {disputeStatusBadge(disputeDetail.status)}
                  <span className="text-xs text-muted-foreground">
                    {new Date(disputeDetail.createdAt).toLocaleDateString('ar-DZ')}
                  </span>
                </div>
              </div>

              {/* الطرفان جنبًا إلى جنب */}
              <div className="grid grid-cols-2 gap-3">
                <div className={cn('rounded-xl border p-3 space-y-1 text-sm', disputeDetail.filedBy === 'renter' ? 'bg-amber-500/8 border-amber-400/50' : 'bg-muted/50 border-border')}>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                    {disputeDetail.filedBy === 'renter' ? '🟡 المستأجر' : '⚪ المستأجر'}
                  </p>
                  {disputeDetail.userAvatarUri && (
                    <img src={disputeDetail.userAvatarUri} alt="" className="w-10 h-10 rounded-full object-cover border border-border" />
                  )}
                  <p className="font-semibold">
                    {disputeDetail.filedBy === 'renter' ? disputeDetail.userName : (disputeDetail.otherPartyName || '—')}
                  </p>
                  <p className="text-muted-foreground text-xs" dir="ltr">
                    {disputeDetail.filedBy === 'renter' ? disputeDetail.userPhone : (disputeDetail.otherPartyPhone || '—')}
                  </p>
                  {disputeDetail.filedBy === 'renter' && (
                    <Badge className="text-xs bg-amber-500/15 text-amber-700 border-amber-300">مقدّم النزاع</Badge>
                  )}
                </div>
                <div className={cn('rounded-xl border p-3 space-y-1 text-sm', disputeDetail.filedBy === 'owner' ? 'bg-amber-500/8 border-amber-400/50' : 'bg-muted/50 border-border')}>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                    {disputeDetail.filedBy === 'owner' ? '🟡 المؤجّر' : '⚪ المؤجّر'}
                  </p>
                  {disputeDetail.otherPartyAvatarUri && (
                    <img src={disputeDetail.otherPartyAvatarUri} alt="" className="w-10 h-10 rounded-full object-cover border border-border" />
                  )}
                  <p className="font-semibold">
                    {disputeDetail.filedBy === 'owner' ? disputeDetail.userName : (disputeDetail.otherPartyName || '—')}
                  </p>
                  <p className="text-muted-foreground text-xs" dir="ltr">
                    {disputeDetail.filedBy === 'owner' ? disputeDetail.userPhone : (disputeDetail.otherPartyPhone || '—')}
                  </p>
                  {disputeDetail.filedBy === 'owner' && (
                    <Badge className="text-xs bg-amber-500/15 text-amber-700 border-amber-300">مقدّم النزاع</Badge>
                  )}
                </div>
              </div>

              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">وصف النزاع:</p>
                <p className="text-sm text-pretty">{disputeDetail.description}</p>
              </div>
              {disputeDetail.adminNotes && (
                <div className="bg-primary/5 rounded-lg p-3 border border-primary/20">
                  <p className="text-xs font-medium text-primary mb-1">ملاحظات الإدارة السابقة:</p>
                  <p className="text-sm text-pretty">{disputeDetail.adminNotes}</p>
                </div>
              )}
              <div className="space-y-1">
                <Label className="text-sm font-normal">ملاحظات الإدارة</Label>
                <Textarea
                  value={disputeNotes}
                  onChange={e => setDisputeNotes(e.target.value)}
                  className="px-3 min-h-[80px]"
                  placeholder="أضف ملاحظاتك حول هذا النزاع..."
                />
              </div>
              <div className={cn('flex gap-2 flex-wrap', isRTL ? 'flex-row-reverse' : '')}>
                {disputeDetail.status === 'open' && (
                  <Button size="sm" variant="outline" className="flex-1 gap-1 min-w-[100px]"
                    onClick={() => { reviewDispute(disputeDetail.id); setDisputeDetail(null); toast.success('تم تحويل النزاع للمراجعة'); }}>
                    تحويل للمراجعة
                  </Button>
                )}
                <Button size="sm" className="flex-1 gap-1 min-w-[100px]"
                  onClick={() => { resolveDispute(disputeDetail.id, disputeNotes); setDisputeDetail(null); toast.success('تم حل النزاع'); }}>
                  <CheckCircle size={13} /> حل النزاع
                </Button>
                <Button size="sm" variant="outline" className="flex-1 gap-1 min-w-[100px] text-destructive border-destructive/30"
                  onClick={() => { rejectDispute(disputeDetail.id, disputeNotes); setDisputeDetail(null); toast.info('تم رفض النزاع'); }}>
                  <XCircle size={13} /> رفض
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── نافذة سبب رفض التوثيق ── */}
      <Dialog open={!!kycRejectUserId} onOpenChange={() => { setKycRejectUserId(null); setKycRejectReason(''); }}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>{t('rejectKyc')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-sm font-normal">{t('rejectionReason')}</Label>
              <Textarea
                value={kycRejectReason}
                onChange={e => setKycRejectReason(e.target.value)}
                className="px-3 min-h-[80px]"
                placeholder="اكتب سبب رفض طلب التوثيق..."
              />
              {!kycRejectReason.trim() && (
                <p className="text-xs text-destructive">{t('rejectionReasonRequired')}</p>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setKycRejectUserId(null); setKycRejectReason(''); }}>{t('cancel')}</Button>
              <Button
                className="flex-1 gap-1" disabled={!kycRejectReason.trim()}
                onClick={() => {
                  if (kycRejectUserId && kycRejectReason.trim()) {
                    rejectKYC(kycRejectUserId, kycRejectReason.trim());
                    toast.error(t('kycRejected'));
                    setKycRejectUserId(null);
                    setKycRejectReason('');
                  }
                }}
              >
                <XCircle size={13} /> {t('reject')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── نافذة حذف منتج مع سبب ── */}
      <Dialog open={!!productDeleteId} onOpenChange={() => { setProductDeleteId(null); setProductDeleteReason(''); }}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>{t('deleteProduct')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{t('deleteProductConfirm')}</p>
            <div className="space-y-1">
              <Label className="text-sm font-normal">{t('removalReasonLabel')}</Label>
              <Textarea
                value={productDeleteReason}
                onChange={e => setProductDeleteReason(e.target.value)}
                className="px-3 min-h-[80px]"
                placeholder="اكتب سبب حذف المنتج..."
              />
              {!productDeleteReason.trim() && (
                <p className="text-xs text-destructive">{t('deleteReasonRequired')}</p>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setProductDeleteId(null); setProductDeleteReason(''); }}>{t('cancel')}</Button>
              <Button
                className="flex-1 gap-1 text-destructive" variant="outline"
                disabled={!productDeleteReason.trim()}
                onClick={() => {
                  if (productDeleteId && productDeleteReason.trim()) {
                    deleteProduct(productDeleteId);
                    toast.success(t('productDeleted'));
                    setProductDeleteId(null);
                    setProductDeleteReason('');
                  }
                }}
              >
                <Trash2 size={13} /> {t('delete')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── نافذة تأكيد التنظيف ── */}
      <Dialog open={cleanupConfirmOpen} onOpenChange={setCleanupConfirmOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>تأكيد {t('dataCleanup')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className={cn('flex items-start gap-3 p-3 rounded-lg border border-destructive/20 bg-destructive/5', isRTL ? 'flex-row-reverse' : '')}>
              <AlertTriangle size={16} className="shrink-0 text-destructive mt-0.5" />
              <p className="text-sm text-destructive">{t('cleanupConfirm')}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setCleanupConfirmOpen(false)}>{t('cancel')}</Button>
              <Button
                className="flex-1 gap-1 text-destructive" variant="outline"
                onClick={() => {
                  if (cleanupType === 'accounts') {
                    clearTestAccounts();
                    toast.success(t('testAccountsDeleted'));
                  } else if (cleanupType === 'products') {
                    // حذف جميع المنتجات نهائياً
                    Promise.all(products.map(p => deleteProduct(p.id)));
                    toast.success(t('oldProductsDeleted'));
                  }
                  setCleanupConfirmOpen(false);
                  setCleanupType(null);
                }}
              >
                <Trash2 size={13} /> {t('confirm')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── نافذة رفض المنتج ── */}
      <Dialog open={!!productReviewId} onOpenChange={open => { if (!open) { setProductReviewId(null); setProductReviewReason(''); } }}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>رفض المنتج</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">يرجى كتابة سبب الرفض إلزامياً ليصل إلى حساب المستخدم:</p>
            <Textarea
              value={productReviewReason}
              onChange={e => setProductReviewReason(e.target.value)}
              placeholder="مثال: المنتج لا يتوافق مع سياسات المنصة..."
              className="min-h-[80px]"
            />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setProductReviewId(null); setProductReviewReason(''); }}>{t('cancel')}</Button>
              <Button
                className="flex-1 gap-1 text-destructive" variant="outline"
                disabled={!productReviewReason.trim()}
                onClick={() => {
                  if (productReviewId && productReviewReason.trim()) {
                    updateProduct(productReviewId, { reviewStatus: 'rejected', rejectionReason: productReviewReason.trim() });
                    toast.success('تم رفض المنتج مع إرسال السبب للمستخدم');
                    setProductReviewId(null);
                    setProductReviewReason('');
                  }
                }}
              >
                <XCircle size={13} /> تأكيد الرفض
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── نافذة إدارة الشعار ── */}
      <Dialog open={logoDialogOpen} onOpenChange={setLogoDialogOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>{t('logoManagement')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">{t('currentLogo')}</p>
              <div className="flex items-center gap-3">
                <img src={settings.logoUrl} alt="current logo" className="w-16 h-16 rounded-xl object-contain border border-border bg-black/5" />
                <div className="text-xs text-muted-foreground">الشعار الحالي المُطبق على كل الصفحات</div>
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label className="text-sm font-normal">{t('uploadNewLogo')}</Label>
              <Button variant="outline" className="w-full gap-2" onClick={() => logoFileRef.current?.click()}>
                <Upload size={14} /> رفع صورة جديدة
              </Button>
              <input ref={logoFileRef} type="file" accept="image/*" className="hidden" onChange={e => handleLogoFile(e.target.files)} />
            </div>
            <div className="space-y-1">
              <Label className="text-sm font-normal">أو أدخل رابط URL مباشرة</Label>
              <Input value={newLogoUrl} onChange={e => setNewLogoUrl(e.target.value)} className="px-3 text-xs" dir="ltr" placeholder="https://..." />
            </div>
            {newLogoUrl && newLogoUrl !== settings.logoUrl && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">معاينة:</p>
                <img src={newLogoUrl} alt="preview" className="w-16 h-16 rounded-xl object-contain border border-border bg-black/5" />
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setLogoDialogOpen(false)}>{t('cancel')}</Button>
              <Button className="flex-1" onClick={saveLogo}>{t('save')}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── نافذة إرسال إشعار عام ── */}
      <Dialog open={broadcastOpen} onOpenChange={setBroadcastOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle className="text-balance flex items-center gap-2">
              <Radio size={16} /> إرسال إشعار عام لجميع المستخدمين
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-sm font-normal">عنوان الإشعار</Label>
              <Input value={broadcastTitle} onChange={e => setBroadcastTitle(e.target.value)} className="px-3" placeholder="عنوان الرسالة..." />
            </div>
            <div className="space-y-1">
              <Label className="text-sm font-normal">نص الإشعار</Label>
              <Input value={broadcastBody} onChange={e => setBroadcastBody(e.target.value)} className="px-3" placeholder="محتوى الرسالة..." />
            </div>
            <div className="space-y-1">
              <Label className="text-sm font-normal">نوع الإشعار</Label>
              <Select value={broadcastType} onValueChange={(v: 'general' | 'admin' | 'reminder') => setBroadcastType(v)}>
                <SelectTrigger className="px-3"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">عام</SelectItem>
                  <SelectItem value="admin">إداري</SelectItem>
                  <SelectItem value="reminder">تذكير</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setBroadcastOpen(false)}>{t('cancel')}</Button>
              <Button
                className="flex-1"
                disabled={!broadcastTitle.trim() || !broadcastBody.trim()}
                onClick={async () => {
                  const userIds = await api.get<string[]>('/api/admin/users/ids').catch(() => []);
                  if (!userIds.length) { toast.error('لا يوجد مستخدمون'); return; }
                  const notifications = userIds.map((id: string) => ({
                    user_id: id,
                    title: broadcastTitle.trim(),
                    body: broadcastBody.trim(),
                    type: broadcastType,
                  }));
                  await api.post('/api/admin/notifications/broadcast', { notifications });
                  toast.success(`تم إرسال الإشعار لـ ${userIds.length} مستخدم`);
                  setBroadcastOpen(false);
                  setBroadcastTitle('');
                  setBroadcastBody('');
                }}
              >
                إرسال
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
