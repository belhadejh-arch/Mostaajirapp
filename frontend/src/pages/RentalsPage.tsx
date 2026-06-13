import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, QrCode, Clock, CheckCircle, XCircle, ChevronRight, Timer, PhoneCall, MapPin, RefreshCw, AlertCircle, AlertTriangle, Star, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { AppLayout } from '@/components/layouts/AppLayout';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import QRCode from 'react-qr-code';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { Rental } from '@/types';

/* ── ألوان الحالة ── */
function statusBadgeClass(status: Rental['status']) {
  const map: Record<string, string> = {
    pending_owner: 'bg-yellow-500/10 text-yellow-700 border-yellow-300',
    accepted: 'bg-blue-500/10 text-blue-700 border-blue-300',
    pending_delivery: 'bg-purple-500/10 text-purple-700 border-purple-300',
    active: 'bg-green-500/10 text-green-700 border-green-300',
    completed: 'bg-muted text-muted-foreground border-border',
    cancelled: 'bg-destructive/10 text-destructive border-destructive/30',
    extend_requested: 'bg-orange-500/10 text-orange-700 border-orange-300',
  };
  return map[status] || 'bg-muted text-muted-foreground';
}

/* ── بطاقة تأجير واحدة ── */
function RentalCard({ rental, asOwner }: { rental: Rental; asOwner: boolean }) {
  const navigate = useNavigate();
  const { t, isRTL } = useLanguage();
  const { acceptRental, rejectRental, startDelivery, completeReturn, requestExtension, acceptExtension, rejectExtension, scanHandover, scanReturn, rateOwner } = useData();
  const { user } = useAuth();
  const [qrType, setQrType] = useState<'delivery' | 'return' | null>(null);
  const [extDays, setExtDays] = useState('');
  const [extOpen, setExtOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState<'handover' | 'return' | null>(null);
  const [scanInput, setScanInput] = useState('');
  const [ratingOpen, setRatingOpen] = useState(false);
  const [ratingValue, setRatingValue] = useState(5);
  const [ratingComment, setRatingComment] = useState('');
  const [ratingDone, setRatingDone] = useState(false);

  const fmt = (n: number) => n.toLocaleString('ar-DZ');
  const qrValue = qrType === 'delivery' ? (rental.handoverToken || rental.qrCodeDelivery) : (rental.returnToken || rental.qrCodeReturn);

  // حساب الوقت المتبقي للإيجارات النشطة
  const timeLeft = () => {
    if (!rental.startTime || rental.status !== 'active') return null;
    const end = new Date(rental.startTime).getTime() + rental.durationDays * 24 * 3600000;
    const diff = end - Date.now();
    if (diff <= 0) return `${Math.abs(Math.ceil(diff / 3600000))} ساعة تأخير`;
    const hrs = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    return `${hrs}س ${mins}د`;
  };

  // تنبيه 48 ساعة: الإشعار الثابت
  const show48hAlert = () => {
    if (rental.status !== 'active' || !rental.startTime) return false;
    const end = new Date(rental.startTime).getTime() + rental.durationDays * 24 * 3600000;
    const diff = end - Date.now();
    return diff > 0 && diff <= 48 * 3600000;
  };

  // حارس 12 ساعة: هل يزال التمديد متاحاً؟
  const canRequestExtension = () => {
    if (!rental.startTime) return true;
    const end = new Date(rental.startTime).getTime() + rental.durationDays * 24 * 3600000;
    return end - Date.now() >= 12 * 3600000;
  };

  const handleExtend = () => {
    const d = Number(extDays);
    if (!d || d < 1) { toast.error('أدخل عدد أيام صحيح'); return; }
    if (!canRequestExtension()) {
      toast.error(t('minExtensionNotice')); return;
    }
    requestExtension(rental.id, d);
    setExtOpen(false);
    toast.success(t('extensionSent'));
  };

  return (
    <Card className="h-full flex flex-col">
      <CardContent className="pt-4 flex flex-col gap-3 flex-1">
        {/* صورة + عنوان + حالة */}
        <div className={cn('flex items-start gap-3', isRTL ? 'flex-row-reverse' : '')}>
          {rental.productImage && (
            <img src={rental.productImage} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0 border border-border" />
          )}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate text-balance">{rental.productTitle}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {asOwner ? rental.renterName : rental.ownerName}
            </p>
          </div>
          <Badge className={cn('text-xs border shrink-0', statusBadgeClass(rental.status))}>
            {t(rental.status as keyof ReturnType<typeof t> extends never ? 'pending' : typeof rental.status)}
          </Badge>
        </div>

        {/* بيانات المستأجر — تظهر للمؤجر فقط عند وجود الطلب */}
        {asOwner && (
          <div className="bg-muted/50 rounded-lg p-2.5 text-xs space-y-1.5 border border-border">
            <p className="font-semibold text-foreground text-xs">بيانات المستأجر</p>
            <div className={cn('flex items-center gap-1.5', isRTL ? 'flex-row-reverse' : '')}>
              <User size={11} className="text-muted-foreground shrink-0" />
              <span>{rental.renterName}</span>
            </div>
            {rental.renterPhone && (
              <div className={cn('flex items-center gap-1.5', isRTL ? 'flex-row-reverse' : '')}>
                <PhoneCall size={11} className="text-muted-foreground shrink-0" />
                <a href={`tel:${rental.renterPhone}`} className="text-primary underline">{rental.renterPhone}</a>
              </div>
            )}
            {rental.renterAddress && (
              <div className={cn('flex items-center gap-1.5', isRTL ? 'flex-row-reverse' : '')}>
                <MapPin size={11} className="text-muted-foreground shrink-0" />
                <span>{rental.renterAddress}{rental.renterWilaya ? `، ${rental.renterWilaya}` : ''}</span>
              </div>
            )}
          </div>
        )}

        {/* تفاصيل */}
        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <div className={cn('flex items-center gap-1', isRTL ? 'flex-row-reverse' : '')}>
            <Clock size={11} /> {rental.durationDays} {t('days')}
          </div>
          <div className={cn('flex items-center gap-1', isRTL ? 'flex-row-reverse' : '')}>
            <MapPin size={11} /> {rental.renterWilaya}
          </div>
          {rental.status === 'active' && timeLeft() && (
            <div className={cn('flex items-center gap-1 col-span-2', timeLeft()?.includes('تأخير') ? 'text-destructive' : 'text-foreground', isRTL ? 'flex-row-reverse' : '')}>
              <Timer size={11} /> {timeLeft()}
            </div>
          )}
        </div>

        {/* تنبيه 48 ساعة — ثابت حتى مسح QR الإعادة */}
        {show48hAlert() && (
          <div className={cn('flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-400/40 text-amber-700', isRTL ? 'flex-row-reverse text-right' : '')}>
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold">{t('alert48h')}</p>
              <p className="text-xs opacity-80 mt-0.5 text-pretty">{t('alert48hDesc')}</p>
            </div>
          </div>
        )}

        {/* المبالغ */}
        <div className="bg-muted/50 rounded-lg p-2 text-xs space-y-1">
          <div className={cn('flex justify-between', isRTL ? 'flex-row-reverse' : '')}>
            <span className="text-muted-foreground">{t('totalCost')}</span>
            <span className="font-semibold">{fmt(rental.totalAmount)} {t('dz')}</span>
          </div>
          <div className={cn('flex justify-between', isRTL ? 'flex-row-reverse' : '')}>
            <span className="text-muted-foreground">{t('deposit')}</span>
            <span>{fmt(rental.deposit)} {t('dz')}</span>
          </div>
          {/* عمولة المنصة — للمؤجر فقط */}
          {asOwner && (
            <div className={cn('flex justify-between text-muted-foreground', isRTL ? 'flex-row-reverse' : '')}>
              <span>{t('commissionAmount')}</span>
              <span>- {fmt(rental.commissionAmount)} {t('dz')}</span>
            </div>
          )}
          {asOwner && (
            <div className={cn('flex justify-between font-semibold text-primary border-t border-border pt-1', isRTL ? 'flex-row-reverse' : '')}>
              <span>{t('netAmount')}</span>
              <span>{fmt(rental.netEarnings)} {t('dz')}</span>
            </div>
          )}
          {rental.latePenalty > 0 && (
            <div className={cn('flex justify-between text-destructive', isRTL ? 'flex-row-reverse' : '')}>
              <span>{t('latePenalty')}</span>
              <span>- {fmt(rental.latePenalty)} {t('dz')}</span>
            </div>
          )}
        </div>

        <Separator />

        {/* أزرار الإجراءات */}
        <div className="space-y-2 mt-auto">

          {/* أزرار المؤجر: قبول/رفض الطلب */}
          {asOwner && rental.status === 'pending_owner' && (
            <div className="flex gap-2">
              <Button
                size="sm" className="flex-1 gap-1.5" onClick={() => { acceptRental(rental.id); toast.success(t('acceptOrder')); }}
              >
                <CheckCircle size={13} /> {t('acceptOrder')}
              </Button>
              <Button
                size="sm" variant="outline" className="flex-1 gap-1.5"
                onClick={() => { rejectRental(rental.id); toast.info(t('rejectOrder')); }}
              >
                <XCircle size={13} /> {t('rejectOrder')}
              </Button>
            </div>
          )}

          {/* مستأجر: عرض QR التسليم */}
          {!asOwner && rental.status === 'accepted' && (
            <Button size="sm" className="w-full gap-1.5" onClick={() => setQrType('delivery')}>
              <QrCode size={14} /> عرض كود QR للتسليم
            </Button>
          )}

          {/* مؤجر: مسح QR التسليم */}
          {asOwner && rental.status === 'accepted' && (
            <Button size="sm" className="w-full gap-1.5" onClick={() => { setScanOpen('handover'); setScanInput(''); }}>
              <QrCode size={14} /> مسح كود QR للتسليم
            </Button>
          )}

          {/* مستأجر: عرض QR الإرجاع */}
          {!asOwner && rental.status === 'active' && (
            <Button size="sm" variant="outline" className="w-full gap-1.5" onClick={() => setQrType('return')}>
              <QrCode size={14} /> عرض كود QR للإعادة
            </Button>
          )}

          {/* مؤجر: مسح QR الإرجاع */}
          {asOwner && rental.status === 'active' && (
            <Button size="sm" className="w-full gap-1.5" onClick={() => { setScanOpen('return'); setScanInput(''); }}>
              <QrCode size={14} /> مسح كود QR للإعادة
            </Button>
          )}

          {/* مستأجر: طلب تمديد — يُعرض فقط إذا تبقى 12 ساعة أو أكثر */}
          {!asOwner && rental.status === 'active' && !rental.extensionRequested && canRequestExtension() && (
            <Button size="sm" variant="outline" className="w-full gap-1.5" onClick={() => setExtOpen(true)}>
              <RefreshCw size={13} /> {t('extendRental')}
            </Button>
          )}

          {/* مؤجر: قبول/رفض طلب التمديد */}
          {asOwner && rental.status === 'extend_requested' && (
            <div className="flex gap-2">
              <Button size="sm" className="flex-1 gap-1" onClick={() => { acceptExtension(rental.id); toast.success(t('extensionAccepted')); }}>
                <CheckCircle size={12} /> قبول التمديد
              </Button>
              <Button size="sm" variant="outline" className="flex-1" onClick={() => rejectExtension(rental.id)}>
                <XCircle size={12} /> رفض
              </Button>
            </div>
          )}

          {/* تقديم نزاع */}
          {(rental.status === 'active' || rental.status === 'completed') && (
            <Button
              size="sm" variant="ghost"
              className="w-full gap-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-500/10"
              onClick={() => navigate(`/dispute/${rental.id}`)}
            >
              <AlertTriangle size={13} /> تقديم نزاع
            </Button>
          )}

          {/* تقييم المؤجر — للمستأجر بعد انتهاء الإيجار */}
          {!asOwner && rental.status === 'completed' && !ratingDone && (
            <Button
              size="sm" variant="ghost"
              className="w-full gap-1.5 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-500/10"
              onClick={() => setRatingOpen(true)}
            >
              <Star size={13} /> تقييم المؤجر
            </Button>
          )}
          {!asOwner && rental.status === 'completed' && ratingDone && (
            <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1">
              <Star size={11} className="fill-yellow-400 text-yellow-400" /> تم تقييم المؤجر
            </p>
          )}
        </div>
      </CardContent>

      {/* ── نافذة تقييم المؤجر ── */}
      <Dialog open={ratingOpen} onOpenChange={setRatingOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-sm" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle className="text-balance flex items-center gap-2">
              <Star size={16} className="text-yellow-500" /> تقييم المؤجر
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">كيف كانت تجربتك مع المؤجر <strong>{rental.ownerName}</strong>؟</p>
            {/* نجوم التقييم */}
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map(star => (
                <button key={star} type="button" onClick={() => setRatingValue(star)}
                  className="focus:outline-none transition-transform hover:scale-110">
                  <Star size={32} className={star <= ratingValue ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'} />
                </button>
              ))}
            </div>
            <div className="space-y-1">
              <Label className="text-sm font-normal">تعليق (اختياري)</Label>
              <input
                type="text"
                value={ratingComment}
                onChange={e => setRatingComment(e.target.value)}
                placeholder="اكتب تعليقك هنا..."
                className="w-full px-3 h-10 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setRatingOpen(false)}>إلغاء</Button>
              <Button className="flex-1" onClick={async () => {
                if (!user) return;
                await rateOwner({ ownerId: rental.ownerId, renterId: user.id, rentalId: rental.id, rating: ratingValue, comment: ratingComment.trim() || undefined });
                setRatingDone(true);
                setRatingOpen(false);
                toast.success('تم إرسال تقييمك بنجاح، شكراً!');
              }}>
                <Star size={14} /> إرسال التقييم
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── نافذة QR ── */}
      <Dialog open={!!qrType} onOpenChange={() => setQrType(null)}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-sm">          <DialogHeader>
            <DialogTitle className="text-balance">
              {qrType === 'delivery' ? t('deliveryQR') : t('returnQR')}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="p-4 bg-white rounded-xl border border-border animate-pulse-gentle">
              <QRCode value={qrValue || 'MOSTAJIR'} size={180} />
            </div>
            <p className="text-xs text-muted-foreground text-center text-pretty">
              {qrType === 'delivery'
                ? 'اعرض هذا الرمز للمؤجر لمسحه عند التسليم'
                : 'اعرض هذا الرمز للمؤجر لمسحه عند الإعادة'}
            </p>
            <p className="font-mono text-xs text-muted-foreground break-all text-center">{qrValue}</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── نافذة الماسح (للمؤجر) ── */}
      <Dialog open={!!scanOpen} onOpenChange={() => { setScanOpen(null); setScanInput(''); }}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-sm" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle className="text-balance">
              {scanOpen === 'handover' ? 'مسح كود QR للتسليم' : 'مسح كود QR للإعادة'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground text-pretty">
              اطلب من المستأجر عرض الكود، ثم أدخل الرمز أدناه أو اكتبه يدوياً:
            </p>
            <Input
              value={scanInput}
              onChange={e => setScanInput(e.target.value)}
              placeholder="أدخل كود QR..."
              className="px-3 font-mono text-xs"
              dir="ltr"
            />
            <Button
              className="w-full gap-1.5"
              disabled={!scanInput.trim()}
              onClick={async () => {
                const scanner = scanOpen === 'handover' ? scanHandover : scanReturn;
                const res = await scanner(scanInput.trim(), rental.ownerId);
                if (res.success) {
                  toast.success(res.message);
                  setScanOpen(null);
                  setScanInput('');
                } else {
                  toast.error(res.message || 'كود غير صالح');
                }
              }}
            >
              <CheckCircle size={14} /> تأكيد المسح
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── نافذة طلب التمديد ── */}
      <Dialog open={extOpen} onOpenChange={setExtOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('extendRental')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-sm font-normal">{t('extensionDays')}</Label>
              <Input
                type="number" min={1} max={15} value={extDays}
                onChange={e => setExtDays(e.target.value)}
                className="px-3" dir="ltr"
                placeholder="1 - 15"
              />
            </div>
            <p className="text-xs text-muted-foreground">{t('minExtensionNotice')}</p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setExtOpen(false)}>{t('cancel')}</Button>
              <Button className="flex-1" onClick={handleExtend}>{t('submit')}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* ── الصفحة الرئيسية ── */
export default function RentalsPage() {
  const { t, isRTL } = useLanguage();
  const { rentals } = useData();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'renter' | 'owner'>('renter');

  if (!user) return (
    <AppLayout>
      <div className="flex flex-col items-center justify-center py-20 gap-4" dir={isRTL ? 'rtl' : 'ltr'}>
        <Package className="text-muted-foreground" size={48} />
        <p className="text-muted-foreground">{t('noRentals')}</p>
      </div>
    </AppLayout>
  );

  const renterRentals = rentals.filter(r => r.renterId === user.id);
  const ownerRentals = rentals.filter(r => r.ownerId === user.id);

  const activeCount = (list: typeof rentals) =>
    list.filter(r => ['active', 'pending_owner', 'accepted', 'pending_delivery', 'extend_requested'].includes(r.status)).length;

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-5" dir={isRTL ? 'rtl' : 'ltr'}>
        <h1 className="text-2xl font-bold text-balance">{t('rentals')}</h1>

        <Tabs value={tab} onValueChange={v => setTab(v as 'renter' | 'owner')}>
          <TabsList className="w-full md:w-auto">
            <TabsTrigger value="renter" className="flex-1 md:flex-none gap-1.5">
              {t('asRenter')}
              {activeCount(renterRentals) > 0 && (
                <Badge className="bg-primary text-primary-foreground text-xs px-1.5 py-0 min-w-[18px] h-[18px]">
                  {activeCount(renterRentals)}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="owner" className="flex-1 md:flex-none gap-1.5">
              {t('asOwner')}
              {activeCount(ownerRentals) > 0 && (
                <Badge className="bg-primary text-primary-foreground text-xs px-1.5 py-0 min-w-[18px] h-[18px]">
                  {activeCount(ownerRentals)}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="renter">
            {renterRentals.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Package size={40} className="mx-auto mb-3 opacity-40" />
                <p>{t('noRentals')}</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {renterRentals.map(r => <RentalCard key={r.id} rental={r} asOwner={false} />)}
              </div>
            )}
          </TabsContent>

          <TabsContent value="owner">
            {ownerRentals.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Package size={40} className="mx-auto mb-3 opacity-40" />
                <p>{t('noRentals')}</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {ownerRentals.map(r => <RentalCard key={r.id} rental={r} asOwner />)}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
