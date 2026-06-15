import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, MapPin, Star, User, Calendar, Play, ZoomIn, X, Truck, ShieldCheck, AlertCircle, ArrowRight, Package, Shield, Phone, Clock } from 'lucide-react';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { AppLayout } from '@/components/layouts/AppLayout';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { WILAYAS } from '@/constants/wilayas';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

/* ── معرض الوسائط المحترف ── */
function MediaGallery({ images, videoUri }: { images: string[]; videoUri?: string }) {
  const [active, setActive] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const total = videoUri ? images.length + 1 : images.length;
  const isVideo = videoUri && active === images.length;

  const prev = () => setActive(i => (i - 1 + total) % total);
  const next = () => setActive(i => (i + 1) % total);

  return (
    <>
      <div className="relative w-full aspect-[4/3] md:aspect-video rounded-xl overflow-hidden bg-black group">
        {isVideo ? (
          <video
            src={videoUri}
            controls
            className="w-full h-full object-contain"
            playsInline
          />
        ) : (
          <>
            <img
              src={images[active]}
              alt=""
              className="w-full h-full object-cover transition-transform duration-300"
              onClick={() => setZoomed(true)}
            />
            <button
              onClick={() => setZoomed(true)}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ZoomIn size={16} />
            </button>
          </>
        )}
        {total > 1 && (
          <>
            <button onClick={prev} className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70">
              <ChevronLeft size={18} />
            </button>
            <button onClick={next} className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70">
              <ChevronRight size={18} />
            </button>
          </>
        )}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1">
          {Array.from({ length: total }).map((_, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={cn('w-1.5 h-1.5 rounded-full transition-all', i === active ? 'bg-white w-3' : 'bg-white/50')}
            />
          ))}
        </div>
      </div>

      {/* شريط الصور المصغرة */}
      <div className="flex gap-2 overflow-x-auto py-1 scrollbar-thin">
        {images.map((src, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            className={cn('shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all', i === active ? 'border-primary' : 'border-transparent opacity-70')}
          >
            <img src={src} alt="" className="w-full h-full object-cover" />
          </button>
        ))}
        {videoUri && (
          <button
            onClick={() => setActive(images.length)}
            className={cn('shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all bg-black flex items-center justify-center', active === images.length ? 'border-primary' : 'border-transparent opacity-70')}
          >
            <Play className="text-white" size={20} fill="white" />
          </button>
        )}
      </div>

      {/* نافذة التكبير */}
      <Dialog open={zoomed} onOpenChange={setZoomed}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-4xl p-2 bg-black border-black">
          <img src={images[active]} alt="" className="w-full max-h-[80vh] object-contain" />
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 text-white hover:bg-white/10"
            onClick={() => setZoomed(false)}
          >
            <X size={20} />
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ── صف السعر ── */
function PriceRow({ label, value, primary, muted }: { label: string; value: string; primary?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
      <span className={cn('text-sm', muted ? 'text-muted-foreground text-xs' : primary ? 'font-semibold text-foreground' : 'text-muted-foreground')}>{label}</span>
      <span className={cn('text-sm font-semibold', primary ? 'text-primary' : muted ? 'text-muted-foreground text-xs' : 'text-foreground')}>{value}</span>
    </div>
  );
}

interface PricingDetails {
  durationHours: number;
  durationDays: number;
  totalRentalFee: number;
  depositAmount: number;
  platformFee: number;
  ownerShare: number;
  totalCharge: number;
  rate24h: number;
  commissionRate: number;
}

/* ── الصفحة الرئيسية ── */
export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t, isRTL, language } = useLanguage();
  const { getProductById, createRental } = useData();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [showRentModal, setShowRentModal] = useState(false);
  const [hours, setHours] = useState(24);
  const [pricing, setPricing] = useState<PricingDetails | null>(null);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [renterName, setRenterName] = useState(user?.name || '');
  const [renterPhone, setRenterPhone] = useState(user?.phone || '');
  const [renterAddress, setRenterAddress] = useState('');
  const [renterWilaya, setRenterWilaya] = useState('');
  const [selfPickup, setSelfPickup] = useState(false);
  const [loading, setLoading] = useState(false);

  const product = getProductById(id || '');

  useEffect(() => {
    if (!product) return;
    setPricingLoading(true);
    api.get<PricingDetails>(`/api/rentals/pricing?productPrice=${product.purchasePrice}&hours=${hours}`)
      .then(d => setPricing(d))
      .catch(() => setPricing(null))
      .finally(() => setPricingLoading(false));
  }, [hours, product?.purchasePrice]);

  if (!product) return (
    <AppLayout>
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-muted-foreground">{t('noResults')}</p>
        <Button onClick={() => navigate('/explore')}>{t('back')}</Button>
      </div>
    </AppLayout>
  );

  const isOwner = user?.id === product.ownerId;
  const days = hours / 24;
  const totalCost = pricing?.totalCharge ?? (product.rentalPrice * days + product.deposit);
  const commission = pricing?.platformFee ?? (product.rentalPrice * days * (product.commissionRate / 100));
  const net = pricing?.ownerShare ?? (product.rentalPrice * days - commission);
  const depositAmount = pricing?.depositAmount ?? product.deposit;
  const rentalFee = pricing?.totalRentalFee ?? (product.rentalPrice * days);

  const handleRentNow = () => {
    if (!user) { navigate('/login'); return; }
    if (user.verificationStatus !== 'verified') { toast.error(t('verifyToRent')); navigate('/verification'); return; }
    if (isOwner) { toast.error(t('cannotRentOwn')); return; }
    if (user.walletBalance < totalCost) { toast.error(t('insufficientBalance')); return; }
    setRenterName(user.name);
    setRenterPhone(user.phone);
    setShowRentModal(true);
  };

  const handleConfirmRent = async () => {
    if (!user) return;
    if (!renterName.trim() || !renterPhone.trim() || (!selfPickup && !renterAddress.trim()) || (!selfPickup && !renterWilaya)) {
      toast.error(t('fillAllFields')); return;
    }
    setLoading(true);
    const rentalId = await createRental({
      productId: product.id, durationHours: hours,
      renterId: user.id, renterName: renterName.trim(),
      renterPhone: renterPhone.trim(),
      renterAddress: selfPickup ? 'استلام شخصي' : renterAddress.trim(),
      renterWilaya: selfPickup ? product.wilayaName : renterWilaya,
      selfPickup,
    });
    setLoading(false);
    setShowRentModal(false);
    if (rentalId) {
      toast.success('تم إرسال طلب الاستئجار للمؤجر. في انتظار الموافقة.');
      navigate('/rentals');
    } else {
      toast.error('فشل إرسال الطلب. تأكد من رصيدك.');
    }
  };

  const fmt = (n: number) => n.toLocaleString('ar-DZ');

  return (
    <AppLayout>
      <div className={cn('max-w-3xl mx-auto space-y-5', isRTL ? 'rtl' : 'ltr')} dir={isRTL ? 'rtl' : 'ltr'}>

        {/* ← زر الرجوع */}
        <Button variant="ghost" size="sm" className="gap-1 -mb-2" onClick={() => navigate(-1)}>
          {isRTL ? <ArrowRight size={16} /> : <ChevronLeft size={16} />}
          {t('back')}
        </Button>

        {/* المعرض */}
        <MediaGallery images={product.images} videoUri={product.videoUri} />

        <div className="grid md:grid-cols-[1fr_300px] gap-5">
          {/* العمود الأيسر */}
          <div className="space-y-4">
            {/* العنوان والحالة */}
            <div>
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-balance flex-1">{product.title}</h1>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {/* شارة الكمية */}
                  {(product.availableQuantity ?? 1) > 0 ? (
                    <Badge variant="default" className="gap-1">
                      <Package size={11} />
                      {(product.availableQuantity ?? 1) > 1
                        ? `${product.availableQuantity} ${t('remainingStock')}`
                        : t('available')}
                    </Badge>
                  ) : (
                    <Badge variant="secondary">{t('outOfStock')}</Badge>
                  )}
                  {/* شارة الوديعة */}
                  {product.deposit > 0 && (
                    <Badge variant="outline" className="gap-1 text-xs">
                      <Shield size={11} />
                      {t('deposit')}: {product.deposit.toLocaleString('ar-DZ')} {t('dz')}
                    </Badge>
                  )}
                </div>
              </div>
              <div className={cn('flex items-center gap-3 mt-2 text-sm text-muted-foreground flex-wrap', isRTL ? 'flex-row-reverse' : '')}>
                <span className={cn('flex items-center gap-1', isRTL ? 'flex-row-reverse' : '')}>
                  <MapPin size={13} /> {product.wilayaName}
                </span>
                <span className={cn('flex items-center gap-1', isRTL ? 'flex-row-reverse' : '')}>
                  <Star size={13} className="fill-yellow-400 text-yellow-400" />
                  {product.rating > 0 ? product.rating.toFixed(1) : 'جديد'}
                  {product.reviewCount > 0 && ` (${product.reviewCount})`}
                </span>
                <span className={cn('flex items-center gap-1', isRTL ? 'flex-row-reverse' : '')}>
                  <Calendar size={13} /> {product.purchaseYear}
                </span>
              </div>
            </div>

            {/* الوصف */}
            <Card>
              <CardContent className="py-3">
                <p className="text-sm text-muted-foreground text-pretty leading-relaxed">{product.description}</p>
              </CardContent>
            </Card>

            {/* خيار التوصيل */}
            <div className={cn('flex items-center gap-2 p-3 rounded-lg border', product.deliveryAvailable ? 'bg-green-500/5 border-green-500/30' : 'bg-muted/50 border-border', isRTL ? 'flex-row-reverse' : '')}>
              <Truck size={16} className={product.deliveryAvailable ? 'text-green-600' : 'text-muted-foreground'} />
              <span className="text-sm">{product.deliveryAvailable ? t('deliveryAvailable') : t('deliveryNotAvailable')}</span>
            </div>

            {/* معلومات المؤجر */}
            <Card>
              <CardContent className="py-3">
                <div className={cn('flex items-center gap-3', isRTL ? 'flex-row-reverse' : '')}>
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                    {product.ownerAvatarUri
                      ? <img src={product.ownerAvatarUri} alt={product.ownerName} className="w-full h-full object-cover" />
                      : <User size={18} className="text-muted-foreground" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{product.ownerName}</p>
                    <div className={cn('flex items-center gap-2 text-xs text-muted-foreground', isRTL ? 'flex-row-reverse' : '')}>
                      <span className={cn('flex items-center gap-1', isRTL ? 'flex-row-reverse' : '')}>
                        <Star size={11} className="fill-yellow-400 text-yellow-400" />
                        {product.ownerRating.toFixed(1)}
                      </span>
                      <span>{product.ownerTotalRentals} {t('totalRentals')}</span>
                    </div>
                  </div>
                  {/* سعر الشراء — للمالك والإدارة فقط */}
                  {(isOwner || user?.isAdmin) && (
                    <div className="text-xs text-muted-foreground text-left border-s border-border ps-3">
                      <p>{t('purchasePrice')}</p>
                      <p className="font-semibold text-foreground">{fmt(product.purchasePrice)} {t('dz')}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* العمود الأيمن — بطاقة التسعير */}
          <div className="space-y-4">
            <Card className="sticky top-4">
              <CardContent className="pt-4 space-y-3">
                {/* عرض السعر من نظام التسعير الديناميكي */}
                {pricing ? (
                  <div>
                    <p className="text-2xl font-bold text-primary">{fmt(pricing.rate24h)} {t('dz')}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock size={11} /> يوم / 24 ساعة
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-2xl font-bold text-primary">{fmt(product.rentalPrice)} {t('dz')}</p>
                    <p className="text-xs text-muted-foreground">{t('perDay')}</p>
                  </div>
                )}

                {/* اختيار مدة الإيجار بالساعات */}
                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1">
                    <Clock size={11} /> مدة الإيجار
                  </Label>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" size="icon" className="h-8 w-8"
                      onClick={() => setHours(h => Math.max(24, h - 24))} disabled={hours <= 24}>
                      <ChevronLeft size={14} />
                    </Button>
                    <div className="flex-1 text-center">
                      <p className="font-bold text-lg">{hours / 24} يوم</p>
                      <p className="text-xs text-muted-foreground">{hours} ساعة</p>
                    </div>
                    <Button type="button" variant="outline" size="icon" className="h-8 w-8"
                      onClick={() => setHours(h => Math.min(720, h + 24))} disabled={hours >= 720}>
                      <ChevronRight size={14} />
                    </Button>
                  </div>
                  {/* شريط سريع للاختيار */}
                  <div className="flex gap-1 flex-wrap">
                    {[24, 48, 72, 168, 336, 720].map(h => (
                      <button
                        key={h}
                        onClick={() => setHours(h)}
                        className={cn(
                          'text-xs px-2 py-0.5 rounded-full border transition-colors',
                          hours === h ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
                        )}
                      >
                        {h === 24 ? '1 يوم' : h === 48 ? '2 يوم' : h === 72 ? '3 أيام' : h === 168 ? 'أسبوع' : h === 336 ? 'أسبوعان' : 'شهر'}
                      </button>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* ملخص التكلفة الديناميكي */}
                {pricingLoading ? (
                  <div className="text-center text-xs text-muted-foreground py-2">جارٍ الحساب...</div>
                ) : (
                  <div className="space-y-0">
                    <PriceRow
                      label={`إيجار ${days} يوم (${hours}س)`}
                      value={`${fmt(Math.round(rentalFee))} ${t('dz')}`}
                    />
                    <PriceRow label={`${t('deposit')} (مُسترجعة)`} value={`${fmt(depositAmount)} ${t('dz')}`} />
                    {isOwner && (
                      <PriceRow label={`عمولة المنصة (${Math.round((pricing?.commissionRate ?? product.commissionRate / 100) * 100)}%)`} value={`- ${fmt(Math.round(commission))} ${t('dz')}`} muted />
                    )}
                    <PriceRow label={t('totalCost')} value={`${fmt(Math.round(totalCost))} ${t('dz')}`} primary />
                    {isOwner && (
                      <PriceRow label={t('netEarnings')} value={`${fmt(Math.round(net))} ${t('dz')}`} primary />
                    )}
                  </div>
                )}

                {/* إشعار التجميد */}
                <div className="flex items-start gap-2 text-xs text-amber-600 bg-amber-500/10 rounded-lg p-2">
                  <ShieldCheck size={13} className="shrink-0 mt-0.5" />
                  <span>الضمان يُجمّد من رصيدك ويُعاد تلقائياً بعد 48 ساعة من إغلاق الإيجار</span>
                </div>

                {!isOwner ? (
                  <Button
                    className="w-full h-10 font-semibold"
                    disabled={product.status !== 'available' || pricingLoading}
                    onClick={handleRentNow}
                  >
                    {product.status === 'available' ? t('rentNow') : t('rented')}
                  </Button>
                ) : (
                  <Badge variant="outline" className="w-full justify-center py-2 text-sm">
                    {t('owner')} — منتجك الخاص
                  </Badge>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* ── نافذة استمارة الاستئجار ── */}
      <Dialog open={showRentModal} onOpenChange={setShowRentModal}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle className="text-balance">{t('confirmRent')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* ملخص سريع + معلومات المؤجر */}
            <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-2">
              <p className="font-semibold truncate">{product.title}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock size={11} /> {days} يوم ({hours} ساعة)
              </p>
              {/* تفصيل المبالغ مع نظام التسعير الديناميكي */}
              <div className="space-y-1 text-xs border border-border rounded-md p-2 bg-background">
                <div className={cn('flex justify-between', isRTL ? 'flex-row-reverse' : '')}>
                  <span className="text-muted-foreground">إيجار {days} يوم</span>
                  <span>{fmt(Math.round(rentalFee))} {t('dz')}</span>
                </div>
                <div className={cn('flex justify-between text-destructive', isRTL ? 'flex-row-reverse' : '')}>
                  <span>عمولة المنصة ({Math.round((pricing?.commissionRate ?? product.commissionRate / 100) * 100)}%)</span>
                  <span>- {fmt(Math.round(commission))} {t('dz')}</span>
                </div>
                <div className={cn('flex justify-between text-green-600 dark:text-green-400 font-medium border-t border-border pt-1', isRTL ? 'flex-row-reverse' : '')}>
                  <span>صافي المؤجر</span>
                  <span>{fmt(Math.round(net))} {t('dz')}</span>
                </div>
                {depositAmount > 0 && (
                  <div className={cn('flex justify-between text-muted-foreground border-t border-border pt-1', isRTL ? 'flex-row-reverse' : '')}>
                    <span>{t('deposit')} (مُسترجعة)</span>
                    <span>{fmt(depositAmount)} {t('dz')}</span>
                  </div>
                )}
                <div className={cn('flex justify-between font-bold text-foreground border-t border-border pt-1', isRTL ? 'flex-row-reverse' : '')}>
                  <span>إجمالي ما تدفعه</span>
                  <span>{fmt(Math.round(totalCost))} {t('dz')}</span>
                </div>
              </div>
              {/* بيانات المؤجر الكاملة — شفافية كاملة */}
              <div className="border-t border-border pt-2 space-y-1">
                <p className="text-xs font-semibold text-foreground">بيانات المؤجر:</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <User size={12} />
                  <span>{product.ownerName}</span>
                </div>
                {product.ownerPhone && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Phone size={12} />
                    <a href={`tel:${product.ownerPhone}`} className="text-primary underline">{product.ownerPhone}</a>
                  </div>
                )}
                {product.ownerAddress && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <MapPin size={12} />
                    <span>{product.ownerAddress}{product.ownerWilayaName ? `، ${product.ownerWilayaName}` : ''}</span>
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground pt-1">يمكنك التواصل مع المؤجر الآن لترتيب اللقاء والتسليم</p>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-sm font-normal">{t('renterFullName')} <span className="text-destructive">*</span></Label>
              <Input value={renterName} onChange={e => setRenterName(e.target.value)} className="px-3" />
            </div>
            <div className="space-y-1">
              <Label className="text-sm font-normal">{t('phone')} <span className="text-destructive">*</span></Label>
              <Input value={renterPhone} onChange={e => setRenterPhone(e.target.value)} className="px-3" dir="ltr" placeholder="05xx xxx xxx" />
            </div>

            {/* خيار الاستلام الشخصي */}
            <div
              onClick={() => setSelfPickup(!selfPickup)}
              className={cn('flex items-start gap-2 p-3 rounded-lg border cursor-pointer transition-colors', selfPickup ? 'border-primary bg-primary/5' : 'border-border')}
            >
              <div className={cn('w-4 h-4 mt-0.5 rounded-full border-2 shrink-0 flex items-center justify-center', selfPickup ? 'border-primary bg-primary' : 'border-muted-foreground')}>
                {selfPickup && <div className="w-2 h-2 rounded-full bg-white" />}
              </div>
              <p className="text-sm">{t('selfPickup')}</p>
            </div>

            {!selfPickup && (
              <>
                <div className="space-y-1">
                  <Label className="text-sm font-normal">{t('deliveryAddress')} <span className="text-destructive">*</span></Label>
                  <Input value={renterAddress} onChange={e => setRenterAddress(e.target.value)} className="px-3" />
                </div>
                <div className="space-y-1">
                  <Label className="text-sm font-normal">{t('deliveryWilaya')} <span className="text-destructive">*</span></Label>
                  <Select value={renterWilaya} onValueChange={setRenterWilaya}>
                    <SelectTrigger className="px-3"><SelectValue placeholder={t('selectWilaya')} /></SelectTrigger>
                    <SelectContent className="max-h-52">
                      {WILAYAS.map(w => <SelectItem key={w.code} value={w.ar}>{w.code} - {w.ar}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setShowRentModal(false)}>{t('cancel')}</Button>
              <Button className="flex-1" disabled={loading} onClick={handleConfirmRent}>
                {loading ? t('loading') : t('confirm')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

