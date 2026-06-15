import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Shield, ShieldX, Star, Package, LogOut, Globe, ChevronRight, Camera, Trash2, User, KeyRound, TrendingUp, Clock, CheckCircle, XCircle, ArrowUpDown, Phone, HelpCircle, ScrollText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AppLayout } from '@/components/layouts/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useData } from '@/contexts/DataContext';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { Language, Rental } from '@/types';
import type { TranslationKey } from '@/constants/i18n';
import { TermsContent } from '@/components/common/TermsOfUse';

const LANGS: { code: Language; label: string }[] = [
  { code: 'ar', label: 'العربية' },
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
];

function VerificationBadge({ status, t }: { status: string; t: (k: TranslationKey) => string }) {
  if (status === 'verified') return (
    <Badge className="gap-1 bg-green-500/10 text-green-700 border-green-300" variant="outline">
      <ShieldCheck size={12} /> {t('verified')}
    </Badge>
  );
  if (status === 'pending') return (
    <Badge className="gap-1 bg-yellow-500/10 text-yellow-700 border-yellow-300" variant="outline">
      <Shield size={12} /> {t('verificationPending')}
    </Badge>
  );
  if (status === 'rejected') return (
    <Badge className="gap-1 bg-destructive/10 text-destructive border-destructive/30" variant="outline">
      <ShieldX size={12} /> {t('verificationRejected')}
    </Badge>
  );
  return (
    <Badge className="gap-1" variant="outline">
      <Shield size={12} /> {t('notVerified')}
    </Badge>
  );
}

/* ── بطاقة سجل إيجار مختصرة ── */
function RentalHistoryCard({
  rental, asOwner, fmt, t, isRTL,
}: {
  rental: Rental;
  asOwner: boolean;
  fmt: (n: number) => string;
  t: (k: TranslationKey) => string;
  isRTL: boolean;
}) {
  const statusColor: Record<string, string> = {
    pending_owner: 'bg-yellow-500/10 text-yellow-700 border-yellow-300',
    accepted: 'bg-blue-500/10 text-blue-700 border-blue-300',
    active: 'bg-green-500/10 text-green-700 border-green-300',
    completed: 'bg-muted text-muted-foreground border-border',
    cancelled: 'bg-destructive/10 text-destructive border-destructive/30',
    extend_requested: 'bg-orange-500/10 text-orange-700 border-orange-300',
    pending_delivery: 'bg-purple-500/10 text-purple-700 border-purple-300',
  };
  return (
    <div className={cn('flex items-center gap-3 p-3 rounded-lg bg-muted/40 border border-border', isRTL ? 'flex-row-reverse' : '')}>
      {rental.productImage && (
        <img src={rental.productImage} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0 border border-border" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{rental.productTitle}</p>
        <p className="text-xs text-muted-foreground truncate">
          {asOwner ? rental.renterName : rental.ownerName}
        </p>
        <p className="text-xs text-muted-foreground">
          {rental.durationDays} {t('days')} — {fmt(rental.totalAmount)} {t('dz')}
        </p>
      </div>
      <Badge className={cn('text-xs border shrink-0', statusColor[rental.status] || 'bg-muted text-muted-foreground')}>
        {t(rental.status as TranslationKey)}
      </Badge>
    </div>
  );
}

export default function ProfilePage() {
  const { t, isRTL, language, setLanguage } = useLanguage();
  const { user, logout, updateUser, changePassword } = useAuth();
  const { getOwnerStats, getRenterStats, rentals } = useData();
  const navigate = useNavigate();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [passDialogOpen, setPassDialogOpen] = useState(false);
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [passLoading, setPassLoading] = useState(false);
  const [historyTab, setHistoryTab] = useState<'out' | 'in'>('out');

  const handleChangePassword = async () => {
    if (!oldPass || !newPass || !confirmPass) { toast.error('يرجى ملء جميع الحقول'); return; }
    if (newPass.length < 6) { toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل'); return; }
    if (newPass !== confirmPass) { toast.error('كلمتا المرور غير متطابقتين'); return; }
    setPassLoading(true);
    const ok = await changePassword(oldPass, newPass);
    setPassLoading(false);
    if (ok) {
      toast.success('تم تغيير كلمة المرور بنجاح');
      setPassDialogOpen(false);
      setOldPass(''); setNewPass(''); setConfirmPass('');
    } else {
      toast.error('كلمة المرور الحالية غير صحيحة');
    }
  };

  if (!user) return (
    <AppLayout>
      <div className="flex flex-col items-center justify-center py-20 gap-4" dir={isRTL ? 'rtl' : 'ltr'}>
        <User className="text-muted-foreground" size={48} />
        <Button onClick={() => navigate('/login')}>{t('login')}</Button>
      </div>
    </AppLayout>
  );

  const ownerStats = getOwnerStats(user.id);
  const renterStats = getRenterStats(user.id);
  const fmt = (n: number) => n.toLocaleString('ar-DZ');

  // سجل المؤجَّرات: الأشياء التي أجّرها للآخرين (المستخدم كمؤجر)
  const rentedOutList = rentals.filter(r => r.ownerId === user.id);
  // سجل المستأجَرات: الأشياء التي استأجرها هو (المستخدم كمستأجر)
  const rentedInList = rentals.filter(r => r.renterId === user.id);

  /* ── تغيير الصورة الشخصية ── */
  const handleAvatarFile = (files: FileList | null) => {
    if (!files?.[0]) return;
    const reader = new FileReader();
    reader.onload = e => {
      const url = e.target?.result as string;
      updateUser({ avatarUri: url });
      toast.success('تم تحديث الصورة الشخصية');
    };
    reader.readAsDataURL(files[0]);
    setAvatarMenuOpen(false);
  };

  const handleDeleteAvatar = () => {
    updateUser({ avatarUri: undefined });
    setAvatarMenuOpen(false);
    toast.success('تم حذف الصورة الشخصية');
  };

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <AppLayout>
      <div className="max-w-xl mx-auto space-y-5" dir={isRTL ? 'rtl' : 'ltr'}>

        {/* ── بطاقة الملف الشخصي ── */}
        <Card>
          <CardContent className="pt-5">
            <div className={cn('flex items-start gap-4', isRTL ? 'flex-row-reverse' : '')}>
              {/* الصورة الشخصية */}
              <div className="relative shrink-0">
                <button
                  onClick={() => setAvatarMenuOpen(true)}
                  className="w-20 h-20 rounded-full bg-muted border-2 border-border overflow-hidden flex items-center justify-center hover:opacity-90 transition-opacity"
                >
                  {user.avatarUri
                    ? <img src={user.avatarUri} alt={user.name} className="w-full h-full object-cover" />
                    : <User size={32} className="text-muted-foreground" />
                  }
                </button>
                <button
                  onClick={() => setAvatarMenuOpen(true)}
                  className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-md"
                >
                  <Camera size={12} className="text-primary-foreground" />
                </button>
              </div>

              {/* المعلومات */}
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold text-balance truncate">{user.name}</h2>
                <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                <p className="text-sm text-muted-foreground" dir="ltr">{user.phone}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <VerificationBadge status={user.verificationStatus} t={t} />
                  <Badge variant="outline" className="text-xs">{user.wilayaName}</Badge>
                </div>
              </div>
            </div>

            {/* إجراء التوثيق */}
            {user.verificationStatus !== 'verified' && (
              <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                <p className="text-xs text-amber-700 dark:text-amber-400 mb-2">
                  {user.verificationStatus === 'pending'
                    ? 'طلب التوثيق قيد المراجعة من قِبل الإدارة'
                    : 'يجب توثيق هويتك لإضافة المنتجات والاستئجار'}
                </p>
                {user.verificationStatus !== 'pending' && (
                  <Button size="sm" onClick={() => navigate('/verification')} className="gap-1.5">
                    <ShieldCheck size={13} /> {t('verifyNow')}
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── سجل الإيجارات: تبويب المؤجَّرات / المستأجَرات ── */}
        <Card>
          <CardContent className="pt-4">
            <Tabs value={historyTab} onValueChange={v => setHistoryTab(v as 'out' | 'in')}>
              <TabsList className="w-full grid grid-cols-2 mb-4">
                <TabsTrigger value="out" className="gap-1.5 text-sm">
                  <TrendingUp size={13} />
                  {t('myRentedOut')}
                  {rentedOutList.length > 0 && (
                    <Badge className="text-xs px-1 h-4 min-w-[16px]">{rentedOutList.length}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="in" className="gap-1.5 text-sm">
                  <ArrowUpDown size={13} />
                  {t('myRentedIn')}
                  {rentedInList.length > 0 && (
                    <Badge className="text-xs px-1 h-4 min-w-[16px]">{rentedInList.length}</Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              {/* المؤجَّرات */}
              <TabsContent value="out">
                {/* إحصائيات سريعة */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {[
                    { label: t('totalProducts'), value: ownerStats.products },
                    { label: t('totalRentals'), value: ownerStats.rentals },
                    { label: t('monthlyEarnings'), value: fmt(ownerStats.monthlyEarnings) + ' ' + t('dz') },
                  ].map(s => (
                    <div key={s.label} className="bg-muted/50 rounded-lg py-2 px-1 text-center">
                      <p className="text-sm font-bold text-primary">{s.value}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 text-balance">{s.label}</p>
                    </div>
                  ))}
                </div>
                {rentedOutList.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <Package size={28} className="mx-auto mb-2 opacity-40" />
                    <p className="text-sm">{t('noRentalsYet')}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {rentedOutList.map(r => (
                      <RentalHistoryCard key={r.id} rental={r} asOwner={true} fmt={fmt} t={t} isRTL={isRTL} />
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* المستأجَرات */}
              <TabsContent value="in">
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {[
                    { label: t('totalOrders'), value: renterStats.totalOrders },
                    { label: t('frozenBalance'), value: fmt(renterStats.frozenDeposits) + ' ' + t('dz') },
                  ].map(s => (
                    <div key={s.label} className="bg-muted/50 rounded-lg py-2 px-1 text-center">
                      <p className="text-sm font-bold text-primary">{s.value}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 text-balance">{s.label}</p>
                    </div>
                  ))}
                </div>
                {rentedInList.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <Package size={28} className="mx-auto mb-2 opacity-40" />
                    <p className="text-sm">{t('noRentalsYet')}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {rentedInList.map(r => (
                      <RentalHistoryCard key={r.id} rental={r} asOwner={false} fmt={fmt} t={t} isRTL={isRTL} />
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* ── اختيار اللغة ── */}
        <Card>
          <CardContent className="py-3">
            <div className={cn('flex items-center justify-between', isRTL ? 'flex-row-reverse' : '')}>
              <div className={cn('flex items-center gap-2 text-sm', isRTL ? 'flex-row-reverse' : '')}>
                <Globe size={16} className="text-muted-foreground" />
                <span>{t('language')}</span>
              </div>
              <div className="flex gap-1">
                {LANGS.map(l => (
                  <Button
                    key={l.code}
                    size="sm"
                    variant={language === l.code ? 'default' : 'outline'}
                    className="h-7 px-2 text-xs"
                    onClick={() => setLanguage(l.code)}
                  >
                    {l.code.toUpperCase()}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── الإجراءات ── */}
        <div className="space-y-2">
          <Button
            variant="outline"
            className="w-full justify-between"
            onClick={() => navigate('/verification')}
          >
            <span className={cn('flex items-center gap-2', isRTL ? 'flex-row-reverse' : '')}>
              <ShieldCheck size={16} />
              {t('verification')}
            </span>
            <VerificationBadge status={user.verificationStatus} t={t} />
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start gap-2"
            onClick={() => setPassDialogOpen(true)}
          >
            <KeyRound size={16} />
            {t('changePassword')}
          </Button>

          {/* رقم الدعم الفني */}
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <HelpCircle size={15} className="text-primary" />
              <span>الدعم الفني</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone size={14} className="text-muted-foreground" />
              <a href="https://wa.me/213556945611" target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline" dir="ltr">
                0556 94 56 11
              </a>
            </div>
            <p className="text-xs text-muted-foreground">تواصل معنا عبر واتساب لأي استفسار أو مشكل</p>
          </div>

          {/* سياسة الاستخدام */}
          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <ScrollText size={15} className="text-primary" />
              <span>سياسة الاستخدام</span>
            </div>
            <TermsContent compact />
          </div>

          <Button
            variant="outline"
            className="w-full justify-start gap-2 text-destructive border-destructive/30 hover:bg-destructive/5"
            onClick={handleLogout}
          >
            <LogOut size={16} />
            {t('logout')}
          </Button>
        </div>
      </div>

      {/* ── نافذة إدارة الصورة الشخصية ── */}
      <Dialog open={avatarMenuOpen} onOpenChange={setAvatarMenuOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-sm" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>{t('uploadAvatar')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Button
              className="w-full gap-2"
              onClick={() => avatarInputRef.current?.click()}
            >
              <Camera size={15} />
              {user.avatarUri ? t('changeAvatar') : t('uploadAvatar')}
            </Button>
            {user.avatarUri && (
              <Button
                variant="outline"
                className="w-full gap-2 text-destructive border-destructive/30"
                onClick={handleDeleteAvatar}
              >
                <Trash2 size={15} />
                {t('deleteAvatar')}
              </Button>
            )}
            <Button variant="ghost" className="w-full" onClick={() => setAvatarMenuOpen(false)}>
              {t('cancel')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <input
        ref={avatarInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => handleAvatarFile(e.target.files)}
      />

      {/* ── نافذة تغيير كلمة المرور ── */}
      <Dialog open={passDialogOpen} onOpenChange={setPassDialogOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-sm" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>{t('changePassword')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-sm font-normal">{t('currentPassword')}</Label>
              <Input
                type="password"
                value={oldPass}
                onChange={e => setOldPass(e.target.value)}
                className="px-3"
                dir="ltr"
                placeholder="••••••••"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm font-normal">{t('newPassword')}</Label>
              <Input
                type="password"
                value={newPass}
                onChange={e => setNewPass(e.target.value)}
                className="px-3"
                dir="ltr"
                placeholder="••••••••"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm font-normal">{t('confirmPassword')}</Label>
              <Input
                type="password"
                value={confirmPass}
                onChange={e => setConfirmPass(e.target.value)}
                className="px-3"
                dir="ltr"
                placeholder="••••••••"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setPassDialogOpen(false)}>{t('cancel')}</Button>
              <Button className="flex-1" onClick={handleChangePassword} disabled={passLoading}>
                {passLoading ? t('loading') : t('save')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}


