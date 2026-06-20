import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, X, ImageIcon, Video, Truck, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { AppLayout } from '@/components/layouts/AppLayout';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { CATEGORIES } from '@/constants/categories';
import { calculatePricing } from '@/lib/pricing';
import { WILAYAS } from '@/constants/wilayas';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const MIN_IMAGES = 5;
const MAX_VIDEO_MB = 25;

export default function AddProductPage() {
  const { t, isRTL, language } = useLanguage();
  const { user } = useAuth();
  const { addProduct } = useData();
  const navigate = useNavigate();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [purchaseYear, setPurchaseYear] = useState(String(new Date().getFullYear()));
  const [categoryId, setCategoryId] = useState('');
  const [subcategoryId, setSubcategoryId] = useState('');
  const [wilayaCode, setWilayaCode] = useState<number | null>(null);
  const [deliveryAvailable, setDeliveryAvailable] = useState(false);
  const [stockQuantity, setStockQuantity] = useState('1');
  const [images, setImages] = useState<string[]>([]);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const getCatName = (cat: typeof CATEGORIES[0]) => language === 'ar' ? cat.ar : language === 'fr' ? cat.fr : cat.en;
  const getSubName = (sub: { ar: string; en: string; fr: string }) => language === 'ar' ? sub.ar : language === 'fr' ? sub.fr : sub.en;
  const selectedCat = CATEGORIES.find(c => c.id === categoryId);
  const price = Number(purchasePrice);

  /* ── ربط الجهاز بدون رفع فعلي للخادم ── */
  const handleImageFiles = (files: FileList | null) => {
    if (!files) return;
    const readers = Array.from(files).map(file =>
      new Promise<string>(res => {
        const reader = new FileReader();
        reader.onload = e => res(e.target?.result as string);
        reader.readAsDataURL(file);
      })
    );
    Promise.all(readers).then(urls =>
      setImages(prev => [...prev, ...urls].slice(0, 30))
    );
  };

  const handleVideoFile = (files: FileList | null) => {
    if (!files?.[0]) return;
    const file = files[0];
    const mb = file.size / (1024 * 1024);
    if (mb > MAX_VIDEO_MB) {
      toast.error(`حجم الفيديو يتجاوز ${MAX_VIDEO_MB} ميغابايت. يرجى اختيار فيديو أصغر.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = e => setVideoUri(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const removeImage = (idx: number) =>
    setImages(prev => prev.filter((_, i) => i !== idx));

  /* ── التحقق وإرسال ── */
  if (!user) return (
    <AppLayout>
      <div className="flex flex-col items-center justify-center py-20 gap-4" dir={isRTL ? 'rtl' : 'ltr'}>
        <AlertCircle className="text-muted-foreground" size={48} />
        <p className="text-muted-foreground text-center text-pretty">{t('verifyToAdd')}</p>
        <Button onClick={() => navigate('/login')}>{t('login')}</Button>
      </div>
    </AppLayout>
  );

  if (user.verificationStatus !== 'verified') return (
    <AppLayout>
      <div className="flex flex-col items-center justify-center py-20 gap-4" dir={isRTL ? 'rtl' : 'ltr'}>
        <AlertCircle className="text-amber-500" size={48} />
        <p className="text-muted-foreground text-center text-pretty">{t('verifyToAdd')}</p>
        <Button onClick={() => navigate('/verification')}>{t('verifyNow')}</Button>
      </div>
    </AppLayout>
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !price || !categoryId || !wilayaCode) {
      toast.error(t('fillAllFields')); return;
    }
    if (images.length < MIN_IMAGES) { toast.error(t('minImagesRequired')); return; }
    if (!videoUri) { toast.error(t('videoRequired')); return; }
    if (price < 500 || price > 2000000) { toast.error('السعر يجب أن يكون بين 500 و 2,000,000 دج'); return; }

    setLoading(true);
    const wilaya = WILAYAS.find(w => w.code === wilayaCode);
    const qty = Math.max(1, Number(stockQuantity) || 1);
    const pricing = calculatePricing(price);
    await addProduct({
      title: title.trim(), description: description.trim(),
      images, videoUri: videoUri ?? undefined,
      categoryId, subcategoryId, wilayaCode, wilayaName: wilaya?.ar || '',
      purchasePrice: price, purchaseYear: Number(purchaseYear) || new Date().getFullYear(),
      rentalPrice: pricing.dailyRate,
      deposit: pricing.deposit,
      commissionRate: pricing.commissionRate,
      deliveryAvailable, status: 'available',
      stockQuantity: qty, availableQuantity: qty,
      isHidden: false,
      reviewStatus: 'approved' as const,
      ownerId: user.id, ownerName: user.name, ownerAvatarUri: user.avatarUri,
      ownerPhone: user.phone, ownerAddress: user.address,
      ownerWilayaCode: user.wilayaCode, ownerWilayaName: user.wilayaName,
    });
    setLoading(false);
    toast.success('🎉 تم نشر منتجك بنجاح وهو متاح الآن للمستأجرين!');
    navigate('/');
  };

  return (
    <AppLayout>
      <div className="max-w-xl mx-auto" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-balance">{t('addProduct')}</h1>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* ── الصور ── */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2"><ImageIcon size={16} />{t('addImages')}</span>
                <Badge variant={images.length >= MIN_IMAGES ? 'default' : 'secondary'}>
                  {images.length}/{MIN_IMAGES} {images.length >= MIN_IMAGES && <CheckCircle size={12} className="ms-1" />}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {images.length > 0 && (
                <div className="grid grid-cols-4 md:grid-cols-5 gap-2">
                  {images.map((src, i) => (
                    <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-border bg-muted">
                      <img src={src} alt="" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeImage(i)}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center text-white"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                  {images.length < 30 && (
                    <button
                      type="button"
                      onClick={() => imageInputRef.current?.click()}
                      className="aspect-square rounded-lg border-2 border-dashed border-border flex items-center justify-center text-muted-foreground hover:bg-muted/50"
                    >
                      <Plus size={20} />
                    </button>
                  )}
                </div>
              )}
              {images.length === 0 && (
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-border rounded-xl py-8 flex flex-col items-center gap-2 text-muted-foreground hover:bg-muted/30 transition-colors"
                >
                  <ImageIcon size={28} />
                  <span className="text-sm">{t('addImages')}</span>
                </button>
              )}
              <input
                ref={imageInputRef} type="file" accept="image/*" multiple className="hidden"
                onChange={e => handleImageFiles(e.target.files)}
              />
              {images.length < MIN_IMAGES && images.length > 0 && (
                <p className="text-xs text-amber-600">
                  يلزم {MIN_IMAGES - images.length} صور إضافية على الأقل
                </p>
              )}
            </CardContent>
          </Card>

          {/* ── الفيديو ── */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2"><Video size={16} />{t('addVideo')}</span>
                {videoUri && <CheckCircle size={16} className="text-green-500" />}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {videoUri ? (
                <div className="space-y-2">
                  <video src={videoUri} controls className="w-full rounded-lg max-h-48 bg-black" />
                  <Button
                    type="button" variant="outline" size="sm"
                    onClick={() => setVideoUri(null)}
                    className="gap-1.5"
                  >
                    <X size={13} /> حذف الفيديو
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => videoInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-border rounded-xl py-8 flex flex-col items-center gap-2 text-muted-foreground hover:bg-muted/30 transition-colors"
                >
                  <Video size={28} />
                  <span className="text-sm">{t('addVideo')}</span>
                  <span className="text-xs text-destructive">{t('required')}</span>
                </button>
              )}
              <input
                ref={videoInputRef} type="file" accept="video/*" className="hidden"
                onChange={e => handleVideoFile(e.target.files)}
              />
            </CardContent>
          </Card>

          {/* ── معلومات المنتج ── */}
          <Card>
            <CardContent className="pt-5 space-y-4">
              <div className="space-y-1">
                <Label className="text-sm font-normal">{t('title')} <span className="text-destructive">*</span></Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} className="px-3" maxLength={100} />
              </div>
              <div className="space-y-1">
                <Label className="text-sm font-normal">{t('description')} <span className="text-destructive">*</span></Label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)} className="px-3 min-h-[80px] resize-none" maxLength={500} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-sm font-normal">{t('category')} <span className="text-destructive">*</span></Label>
                  <Select value={categoryId} onValueChange={v => { setCategoryId(v); setSubcategoryId(''); }}>
                    <SelectTrigger className="px-3"><SelectValue placeholder={t('selectCategory')} /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => <SelectItem key={c.id} value={c.id}>{c.icon} {getCatName(c)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-sm font-normal">{t('subcategory')}</Label>
                  <Select value={subcategoryId} onValueChange={setSubcategoryId} disabled={!selectedCat}>
                    <SelectTrigger className="px-3"><SelectValue placeholder={t('selectSubcategory')} /></SelectTrigger>
                    <SelectContent>
                      {selectedCat?.subcategories.map(s => <SelectItem key={s.id} value={s.id}>{getSubName(s)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-sm font-normal">{t('wilaya')} <span className="text-destructive">*</span></Label>
                <Select onValueChange={v => setWilayaCode(Number(v))}>
                  <SelectTrigger className="px-3"><SelectValue placeholder={t('selectWilaya')} /></SelectTrigger>
                  <SelectContent className="max-h-60">
                    {WILAYAS.map(w => <SelectItem key={w.code} value={String(w.code)}>{w.code} - {w.ar}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-sm font-normal">{t('purchasePrice')} (دج) <span className="text-destructive">*</span></Label>
                  <Input type="number" value={purchasePrice} onChange={e => setPurchasePrice(e.target.value)} className="px-3" min={500} max={2000000} dir="ltr" />
                </div>
                <div className="space-y-1">
                  <Label className="text-sm font-normal">{t('purchaseYear')}</Label>
                  <Input type="number" value={purchaseYear} onChange={e => setPurchaseYear(e.target.value)} className="px-3" min={2000} max={new Date().getFullYear()} dir="ltr" />
                </div>
              </div>

              {/* كمية المخزون */}
              <div className="space-y-1">
                <Label className="text-sm font-normal">{t('stockQuantity')} <span className="text-destructive">*</span></Label>
                <Input
                  type="number" value={stockQuantity}
                  onChange={e => setStockQuantity(e.target.value)}
                  className="px-3" min={1} max={100} dir="ltr"
                  placeholder="1"
                />
                <p className="text-xs text-muted-foreground">كم نسخة من هذا المنتج تملك للتأجير؟</p>
              </div>

              {/* خيار التوصيل */}
              <div className={cn('flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border', isRTL ? 'flex-row-reverse' : '')}>
                <div className={cn('flex items-center gap-2', isRTL ? 'flex-row-reverse' : '')}>
                  <Truck size={16} className="text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{t('deliveryOption')}</p>
                    <p className="text-xs text-muted-foreground">
                      {deliveryAvailable ? t('deliveryAvailable') : t('deliveryNotAvailable')}
                    </p>
                  </div>
                </div>
                <Switch checked={deliveryAvailable} onCheckedChange={setDeliveryAvailable} />
              </div>
            </CardContent>
          </Card>

          {/* معاينة الأسعار المحسوبة تلقائياً */}
          {price >= 500 && (
            <Card className="border-border">
              <CardContent className="py-3 px-4 text-sm space-y-3">
                <p className="text-xs text-muted-foreground font-medium">الأسعار المحسوبة تلقائياً:</p>
                {(() => {
                  const pricing = calculatePricing(price);
                  const exampleGross = pricing.dailyRate;
                  const exampleCommission = Math.round(exampleGross * (pricing.commissionRate / 100));
                  const exampleNet = exampleGross - exampleCommission;
                  return (
                    <>
                      <div className={cn('flex justify-between', isRTL ? 'flex-row-reverse' : '')}>
                        <span className="text-muted-foreground">{t('rentalPrice')}</span>
                        <span className="font-bold text-primary">{pricing.dailyRate.toLocaleString('ar-DZ')} {t('dz')} {t('perDay')}</span>
                      </div>
                      <div className={cn('flex justify-between', isRTL ? 'flex-row-reverse' : '')}>
                        <span className="text-muted-foreground">{t('deposit')}</span>
                        <span className="font-semibold">{pricing.deposit ? pricing.deposit.toLocaleString('ar-DZ') + ' ' + t('dz') : 'لا يوجد'}</span>
                      </div>

                      {/* ── قسم العمولة المبرز ── */}
                      <div className="rounded-lg border border-amber-400/40 bg-amber-500/8 p-3 space-y-2">
                        <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">عمولة المنصة ({pricing.label})</p>
                        <div className={cn('flex justify-between items-center', isRTL ? 'flex-row-reverse' : '')}>
                          <span className="text-muted-foreground text-xs">نسبة العمولة</span>
                          <span className="font-bold text-amber-600 dark:text-amber-400 text-base">{pricing.commissionRate}%</span>
                        </div>
                        <div className="border-t border-amber-400/30 pt-2 space-y-1 text-xs text-muted-foreground">
                          <p className="font-medium text-foreground">مثال على يوم واحد:</p>
                          <div className={cn('flex justify-between', isRTL ? 'flex-row-reverse' : '')}>
                            <span>سعر الإيجار اليومي</span>
                            <span>{exampleGross.toLocaleString('ar-DZ')} دج</span>
                          </div>
                          <div className={cn('flex justify-between text-destructive', isRTL ? 'flex-row-reverse' : '')}>
                            <span>عمولة المنصة ({pricing.commissionRate}%)</span>
                            <span>- {exampleCommission.toLocaleString('ar-DZ')} دج</span>
                          </div>
                          <div className={cn('flex justify-between font-semibold text-green-600 dark:text-green-400 border-t border-amber-400/30 pt-1', isRTL ? 'flex-row-reverse' : '')}>
                            <span>صافي أرباحك</span>
                            <span>{exampleNet.toLocaleString('ar-DZ')} دج</span>
                          </div>
                        </div>
                      </div>

                      <p className="text-[10px] text-muted-foreground border-t border-border pt-2">
                        {pricing.label} — سعر الشراء لا يظهر للزوار أو المستأجرين
                      </p>
                    </>
                  );
                })()}
              </CardContent>
            </Card>
          )}

          {/* ملخص المتطلبات */}
          <div className="flex gap-3 text-xs">
            <div className={cn('flex items-center gap-1', images.length >= MIN_IMAGES ? 'text-green-600' : 'text-muted-foreground')}>
              {images.length >= MIN_IMAGES ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
              <span>{images.length}/{MIN_IMAGES} صورة</span>
            </div>
            <div className={cn('flex items-center gap-1', videoUri ? 'text-green-600' : 'text-muted-foreground')}>
              {videoUri ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
              <span>فيديو {videoUri ? 'مرفوع' : 'مطلوب'}</span>
            </div>
          </div>

          <Button type="submit" className="w-full h-11 font-semibold" disabled={loading}>
            {loading ? t('loading') : t('publishProduct')}
          </Button>
        </form>
      </div>
    </AppLayout>
  );
}

