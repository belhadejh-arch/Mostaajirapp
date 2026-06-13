import React, { useState, useRef } from 'react';
import { Upload, CheckCircle, XCircle, Send, AlertCircle, ChevronRight, ImageIcon, Trash2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AppLayout } from '@/components/layouts/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/db/supabase';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type KYCStep = 'front' | 'back' | 'selfie';

const STEPS: { key: KYCStep; labelKey: 'step1' | 'step2' | 'step3'; idKey: 'idFront' | 'idBack' | 'selfie' }[] = [
  { key: 'front', labelKey: 'step1', idKey: 'idFront' },
  { key: 'back', labelKey: 'step2', idKey: 'idBack' },
  { key: 'selfie', labelKey: 'step3', idKey: 'selfie' },
];

interface UploadZoneProps {
  label: string;
  sublabel: string;
  note: string;
  uploaded: string | null;
  onUpload: (dataUrl: string) => void;
  onRemove: () => void;
  active: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
}

function UploadZone({ label, sublabel, note, uploaded, onUpload, onRemove, active, inputRef }: UploadZoneProps) {
  const { t } = useLanguage();
  const [previewOpen, setPreviewOpen] = useState(false);

  const handleFile = (files: FileList | null) => {
    if (!files?.[0]) return;
    const reader = new FileReader();
    reader.onload = e => { onUpload(e.target?.result as string); };
    reader.readAsDataURL(files[0]);
  };

  if (!active && !uploaded) return null;

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <p className="text-xs text-muted-foreground">{sublabel}</p>
      <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded px-2 py-1.5">{note}</p>

      {uploaded ? (
        <div className="relative rounded-lg overflow-hidden border border-border">
          <img src={uploaded} alt={label} className="w-full h-48 object-contain bg-muted" />
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center pointer-events-none">
            <CheckCircle className="text-green-400" size={48} />
          </div>
          <div className="absolute bottom-3 right-3 flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setPreviewOpen(true)}>
              <Eye size={13} /> {t('preview')}
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 text-destructive border-destructive/30" onClick={onRemove}>
              <Trash2 size={13} /> {t('remove')}
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <Button
            variant="outline"
            className="w-full gap-2 h-32 flex flex-col items-center justify-center border-dashed"
            onClick={() => inputRef.current?.click()}
          >
            <ImageIcon size={24} className="text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{t('uploadFile')}</span>
          </Button>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => handleFile(e.target.files)}
      />

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
          </DialogHeader>
          <img src={uploaded || ''} alt={label} className="w-full rounded-lg object-contain" />
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function VerificationPage() {
  const { t, isRTL } = useLanguage();
  const { user, updateUser } = useAuth();
  const [captures, setCaptures] = useState<{ front: string | null; back: string | null; selfie: string | null }>({
    front: user?.idFrontUri || null,
    back: user?.idBackUri || null,
    selfie: user?.selfieUri || null,
  });
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  const frontRef = useRef<HTMLInputElement>(null);
  const backRef = useRef<HTMLInputElement>(null);
  const selfieRef = useRef<HTMLInputElement>(null);
  const refs = { front: frontRef, back: backRef, selfie: selfieRef };

  const handleUpload = (step: KYCStep, dataUrl: string) => {
    setCaptures(prev => ({ ...prev, [step]: dataUrl }));
    updateUser({
      [`id${step === 'front' ? 'FrontUri' : step === 'back' ? 'BackUri' : 'SelfieUri'}`]: dataUrl,
    });
    if (step === 'front' && currentStep === 0) setCurrentStep(1);
    else if (step === 'back' && currentStep === 1) setCurrentStep(2);
  };

  const handleRemove = (step: KYCStep) => {
    setCaptures(prev => ({ ...prev, [step]: null }));
  };

  const handleSubmit = async () => {
    if (!captures.front || !captures.back || !captures.selfie) {
      toast.error('يرجى رفع جميع الملفات المطلوبة'); return;
    }
    if (!user) return;
    setSubmitting(true);
    try {
      // رفع الملفات إلى Supabase Storage
      const uploadFile = async (dataUrl: string, name: string): Promise<string> => {
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        const ext = blob.type.split('/')[1] || 'jpg';
        const path = `${user.id}/${name}.${ext}`;
        const { error } = await supabase.storage.from('kyc-docs').upload(path, blob, { upsert: true, contentType: blob.type });
        if (error) throw error;
        const { data: urlData } = supabase.storage.from('kyc-docs').getPublicUrl(path);
        return urlData.publicUrl;
      };
      const [frontUrl, backUrl, selfieUrl] = await Promise.all([
        uploadFile(captures.front, 'id_front'),
        uploadFile(captures.back, 'id_back'),
        uploadFile(captures.selfie, 'selfie'),
      ]);
      // إدراج طلب التوثيق في قاعدة البيانات
      const { error: kycError } = await supabase.from('kyc_requests').insert({
        user_id: user.id,
        user_name: user.name,
        user_email: user.email,
        user_phone: user.phone,
        id_front_uri: frontUrl,
        id_back_uri: backUrl,
        selfie_uri: selfieUrl,
      });
      if (kycError) throw kycError;
      // تحديث حالة التوثيق للمستخدم
      await supabase.from('profiles').update({ verification_status: 'pending' }).eq('id', user.id);
      updateUser({ verificationStatus: 'pending' });
      toast.success('تم تقديم طلب التوثيق. سيتم مراجعته من قِبل الإدارة.');
    } catch (err) {
      console.error('خطأ في رفع ملفات التوثيق:', err);
      toast.error('حدث خطأ أثناء رفع الملفات. يرجى المحاولة مجدداً.');
    } finally {
      setSubmitting(false);
    }
  };

  const allCaptured = captures.front && captures.back && captures.selfie;

  if (user?.verificationStatus === 'verified') {
    return (
      <AppLayout>
        <div className="max-w-lg mx-auto py-8 text-center space-y-4">
          <CheckCircle className="text-green-500 mx-auto" size={64} />
          <h2 className="text-xl font-bold text-balance">{t('verificationApproved')}</h2>
          <p className="text-muted-foreground text-pretty">هويتك موثَّقة ويمكنك الآن إضافة المنتجات والاستئجار.</p>
        </div>
      </AppLayout>
    );
  }

  if (user?.verificationStatus === 'pending') {
    return (
      <AppLayout>
        <div className="max-w-lg mx-auto py-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center mx-auto">
            <AlertCircle className="text-yellow-500" size={32} />
          </div>
          <h2 className="text-xl font-bold text-balance">{t('verificationPending')}</h2>
          <p className="text-muted-foreground text-pretty">جارٍ مراجعة طلبك من قِبل فريق الإدارة. سيتم إشعارك عند الانتهاء.</p>
        </div>
      </AppLayout>
    );
  }

  if (user?.verificationStatus === 'rejected') {
    return (
      <AppLayout>
        <div className="max-w-lg mx-auto py-8 text-center space-y-4">
          <XCircle className="text-destructive mx-auto" size={64} />
          <h2 className="text-xl font-bold text-balance">{t('verificationRejected')}</h2>
          <p className="text-muted-foreground text-pretty">
            {user.kycRejectionReason || 'تم رفض طلبك. يمكنك إعادة التقديم مع التأكد من وضوح الصور.'}
          </p>
          <Button onClick={() => updateUser({ verificationStatus: 'none', kycRejectionReason: undefined })}>إعادة التقديم</Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
        <div>
          <h1 className="text-2xl font-bold text-balance">{t('verification')}</h1>
          <p className="text-sm text-muted-foreground mt-1 text-pretty">{t('cameraRequired')}</p>
        </div>

        {/* شريط التقدم */}
        <div className="flex items-center gap-2">
          {STEPS.map((step, i) => (
            <React.Fragment key={step.key}>
              <button
                onClick={() => setCurrentStep(i)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                  i === currentStep
                    ? 'bg-primary text-primary-foreground'
                    : captures[step.key]
                      ? 'bg-green-500/10 text-green-600 border border-green-300'
                      : 'bg-muted text-muted-foreground'
                )}
              >
                {captures[step.key] && <CheckCircle size={12} />}
                {t(step.labelKey)}
              </button>
              {i < STEPS.length - 1 && <ChevronRight className="text-muted-foreground shrink-0" size={14} />}
            </React.Fragment>
          ))}
        </div>

        {/* تعليمات الرفع */}
        <div className="flex items-start gap-2 bg-primary/5 border border-primary/20 rounded-lg p-3">
          <AlertCircle className="text-primary shrink-0 mt-0.5" size={16} />
          <div className="text-xs text-muted-foreground space-y-1">
            <p>{t('cameraRequired')}</p>
            <ul className="list-disc list-inside mr-4 space-y-0.5">
              <li>صورة الجهة الأمامية لبطاقة الهوية</li>
              <li>صورة الجهة الخلفية لبطاقة الهوية</li>
              <li>صورة شخصية (سيلفي) واضحة وأنت تحمل بطاقة هويتك</li>
            </ul>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-6">
            <UploadZone
              label={t('idFront')}
              sublabel="الخطوة 1 من 3"
              note="صورة واضحة للجهة الأمامية لبطاقة الهوية (carte nationale)"
              uploaded={captures.front}
              onUpload={(url) => handleUpload('front', url)}
              onRemove={() => handleRemove('front')}
              active={currentStep === 0 || !!captures.front}
              inputRef={frontRef}
            />
            <UploadZone
              label={t('idBack')}
              sublabel="الخطوة 2 من 3"
              note="صورة واضحة للجهة الخلفية لبطاقة الهوية"
              uploaded={captures.back}
              onUpload={(url) => handleUpload('back', url)}
              onRemove={() => handleRemove('back')}
              active={currentStep === 1 || !!captures.back}
              inputRef={backRef}
            />
            <UploadZone
              label={t('selfie')}
              sublabel="الخطوة 3 من 3"
              note="صورة شخصية (سيلفي) إلزامية — يجب أن تكون واضحة وأنت تحمل بطاقة هويتك بيدك"
              uploaded={captures.selfie}
              onUpload={(url) => handleUpload('selfie', url)}
              onRemove={() => handleRemove('selfie')}
              active={currentStep === 2 || !!captures.selfie}
              inputRef={selfieRef}
            />
          </CardContent>
        </Card>

        {/* الملخص */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex gap-3">
              {STEPS.map(step => (
                <div key={step.key} className="flex-1 text-center space-y-1">
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center mx-auto',
                    captures[step.key] ? 'bg-green-500/10' : 'bg-muted'
                  )}>
                    {captures[step.key]
                      ? <CheckCircle className="text-green-500" size={16} />
                      : <ImageIcon className="text-muted-foreground" size={14} />
                    }
                  </div>
                  <p className="text-xs text-muted-foreground">{t(step.labelKey)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Button
          className="w-full gap-2"
          disabled={!allCaptured || submitting}
          onClick={handleSubmit}
        >
          <Send size={16} />
          {submitting ? t('loading') : t('submitVerification')}
        </Button>
      </div>
    </AppLayout>
  );
}
