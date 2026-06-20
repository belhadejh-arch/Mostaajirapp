import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, X, ImageIcon, Video, Truck, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
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
import { api } from '@/api/client';

const MIN_IMAGES = 5;
const MAX_VIDEO_MB = 25;
const MAX_IMG_PX = 1200;
const IMG_QUALITY = 0.82;

/* ── ضغط الصورة باستخدام Canvas ── */
async function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const { width, height } = img;
      const scale = Math.min(1, MAX_IMG_PX / Math.max(width, height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas not supported')); return; }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        blob => blob ? resolve(blob) : reject(new Error('Compression failed')),
        'image/jpeg',
        IMG_QUALITY,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Image load failed')); };
    img.src = objectUrl;
  });
}

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

  /* ── الصور: URLs مباشرة من الخادم بعد الرفع ── */
  const [images, setImages] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);

  /* ── الفيديو: URL من الخادم ── */
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [uploadingVideo, setUploadingVideo] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  const getCatName = (cat: typeof CATEGORIES[0]) => language === 'ar' ? cat.ar : language === 'fr' ? cat.fr : cat.en;
  const getSubName = (sub: { ar: string; en: string; fr: string }) => language === 'ar' ? sub.ar : language === 'fr' ? sub.fr : sub.en;
  const selectedCat = CATEGORIES.find(c => c.id === categoryId);
  const price = Number(purchasePrice);
  const isUploading = uploadingImages || uploadingVideo;

  /* ── رفع الصور: ضغط فوري ثم رفع إلى الخادم ── */
  const handleImageFiles = async (files: FileList | null) => {
    if (!files || uploadingImages) return;
    const remaining = 30 - images.length;
    if (remaining <= 0) return;
    const fileArr = Array.from(files).slice(0, remaining);
    if (!fileArr.length) return;

    setUploadingImages(true);
    try {
      /* ضغط جميع الصور بالتوازي */
      const compressed = await Promise.all(fileArr.map(f => compressImage(f)));

      /* رفع دفعة واحدة */
      const formData = new FormData();
      compressed.forEach((blob, i) => formData.append('files', blob, `img${i}.jpg`));
      const { urls } = await api.upload<{ urls: string[] }>('/api/upload/images', formData);

      setImages(prev => [...prev, ...urls].slice(0, 30));
      toast.success(`تم رفع ${urls.length} صورة بنجاح`);
    } catch {
      toast.error('فشل رفع الصور. تأكد من الاتصال وحاول مجدداً.');
    } finally {
      setUploadingImages(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  };

  /* ── رفع الفيديو مباشرة إلى الخادم ── */
  const handleVideoFile = async (files: FileList | null) => {
    if (!files?.[0] || uploadingVideo) return;
    const file = files[0];
    const mb = file.size / (1024 * 1024);
    if (mb > MAX_VIDEO_MB) {
      toast.error(`حجم الفيديو يتجاوز ${MAX_VIDEO_MB} ميغابايت. يرجى اختيار فيديو أصغر.`);
      return;
    }
    setUploadingVideo(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { url } = await api.upload<{ url: string }>('/api/upload/video', formData);
      setVideoUri(url);
      toast.success('تم رفع الفيديو بنجاح');
    } catch {
      toast.error('فشل رفع الفيديو. تأكد من الاتصال وحاول مجدداً.');
    } finally {
      setUploadingVideo(false);
      if (videoInputRef.current) videoInputRef.current.value = '';
    }
  };

  const removeImage = (idx: number) => setImages(prev => prev.filter((_, i) => i !== idx));

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
    if (isUploading) { toast.error('انتظر حتى اكتمال رفع الملفات'); return; }
    if (!title.trim() || !description.trim() || !price || !categoryId || !wilayaCode) {
      toast.error(t('fillAllFields')); return;
    }
    if (images.length < MIN_IMAGES) { toast.error(t('minImagesRequired')); return; }
    if (!videoUri) { toast.error(t('videoRequired')); return; }
    if (price < 500 || price > 2000000) { toast.error('السعر يجب أن يكون بين 500 و 2,000,000 دج'); return; }

    setSubmitting(true);
    const wilaya = WILAYAS.find(w => w.code === wilayaCode);
    const qty = Math.max(1, Number(stockQuantity) || 1);
    const pricing = calculatePricing(price);
    try {
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
      toast.success('🎉 تم نشر منتجك بنجاح وهو متاح الآن للمستأجرين!');
      navigate('/');
    } catch {
      toast.error('فشل نشر المنتج. حاول مجدداً.');
    } finally {
      setSubmitting(false);
    }
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
                      <img src={src} alt="" className="w-full h-full object-cover" loading="lazy" />
                      <button
                        type="button"
                        onClick={() => removeImage(i)}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center text-white"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                  {images.length < 30 && !uploadingImages && (
                    <button
                      type="button"
                      onClick={() => imageInputRef.current?.click()}
                      className="aspect-square rounded-lg border-2 border-dashed border-border flex items-center justify-center text-muted-foreground hover:bg-muted/50"
                    >
                      <Plus size={20} />
                    </button>
                  )}
                  {uploadingImages && (
                    <div className="aspect-square rounded-lg border-2 border-dashed border-primary/40 flex flex-col items-center justify-center gap-1 text-primary">
                      <Loader2 size={20} className="animate-spin" />
                      <span className="text-[10px]">جاري الرفع…</span>
                    </div>
                  )}
                </div>
              )}
              {images.length === 0 && (
                <button
                  type="button"
                  onClick={() => !uploadingImages && imageInputRef.current?.click()}
                  disabled={uploadingImages}
                  className="w-full border-2 border-dashed border-border rounded-xl py-8 flex flex-col items-center gap-2 text-muted-foreground hover:bg-muted/30 transition-colors disabled:opacity-60"
                >
                  {uploadingImages
                    ? <><Loader2 size={28} className="animate-spin text-primary" /><span className="text-sm">جاري ضغط الصور ورفعها…</span></>
                    : <><ImageIcon size={28} /><span className="text-sm">{t('addImages')}</span><span className="text-xs text-muted-foreground">تُضغط تلقائياً للحصول على أسرع أداء</span></>
                  }
                </button>
              )}
              <input
                ref={imageInputRef} type="file" accept="image/*" multiple className="hidden"
                onChange={e => handleImageFiles(e.target.files)}
              />
              {images.length < MIN_IMAGES && images.length > 0 && !uploadingImages && (
                <p className="text-xs text-amber-600">
                  يلزم {MIN_IMAGES - images.length} صور إضافية على الأقل
                </p>
              )}
              {uploadingImages && images.length > 0 && (
                <p className="text-xs text-primary flex items-center gap-1">
                  <Loader2 size={11} className="animate-spin" /> جاري رفع الصور…
                </p>
              )}
            </CardContent>
          </Card>

          {/* ── الفيديو ── */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2"><Video size={16} />{t('addVideo')}</span>
                {videoUri && !uploadingVideo && <CheckCircle size={16} className="text-green-500" />}
                {uploadingVideo && <Loader2 size={16} className="animate-spin text-primary" />}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {videoUri && !uploadingVideo ? (
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
                  onClick={() => !uploadingVideo && videoInputRef.current?.click()}
                  disabled={uploadingVideo}
                  className="w-full border-2 border-dashed border-border rounded-xl py-8 flex flex-col items-center gap-2 text-muted-foreground hover:bg-muted/30 transition-colors disabled:opacity-60"
                >
                  {uploadingVideo
                    ? <><Loader2 size={28} className="animate-spin text-primary" /><span className="text-sm">جاري رفع الفيديو…</span></>
                    : <><Video size={28} /><span className="text-sm">{t('addVideo')}</span><span className="text-xs text-destructive">{t('required')} — الحد الأقصى {MAX_VIDEO_MB} ميغابايت</span></>
                  }
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
            <div className={cn('flex items-center gap-1',
              uploadingImages ? 'text-primary' : images.length >= MIN_IMAGES ? 'text-green-600' : 'text-muted-foreground'
            )}>
              {uploadingImages ? <Loader2 size={13} className="animate-spin" /> : images.length >= MIN_IMAGES ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
              <span>{images.length}/{MIN_IMAGES} صورة</span>
            </div>
            <div className={cn('flex items-center gap-1',
              uploadingVideo ? 'text-primary' : videoUri ? 'text-green-600' : 'text-muted-foreground'
            )}>
              {uploadingVideo ? <Loader2 size={13} className="animate-spin" /> : videoUri ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
              <span>فيديو {videoUri ? 'مرفوع' : uploadingVideo ? 'جاري الرفع…' : 'مطلوب'}</span>
            </div>
          </div>

          {isUploading && (
            <p className="text-xs text-center text-primary flex items-center justify-center gap-1">
              <Loader2 size={12} className="animate-spin" />
              جاري رفع الملفات… يُرجى الانتظار
            </p>
          )}

          <Button
            type="submit"
            className="w-full h-11 font-semibold"
            disabled={submitting || isUploading}
          >
            {submitting
              ? <><Loader2 size={16} className="animate-spin me-2" />{t('loading')}</>
              : isUploading
              ? <><Loader2 size={16} className="animate-spin me-2" />جاري رفع الملفات…</>
              : t('publishProduct')
            }
          </Button>
        </form>
      </div>
    </AppLayout>
  );
}
