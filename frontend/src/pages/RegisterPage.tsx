import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { WILAYAS } from '@/constants/wilayas';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { TermsModal } from '@/components/common/TermsOfUse';

export default function RegisterPage() {
  const { t, isRTL } = useLanguage();
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [wilayaCode, setWilayaCode] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !phone.trim() || !password || !wilayaCode) {
      toast.error(t('fillAllFields')); return;
    }
    if (password.length < 6) { toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل'); return; }
    setShowTerms(true);
  };

  const handleAcceptTerms = async () => {
    setShowTerms(false);
    setLoading(true);
    const wilaya = WILAYAS.find(w => w.code === wilayaCode);
    const ok = await register({ name: name.trim(), email: email.trim(), phone, password, wilayaCode: wilayaCode!, wilayaName: wilaya?.ar || '' });
    setLoading(false);
    if (ok) { toast.success('تم إنشاء الحساب بنجاح'); navigate('/verification'); }
    else toast.error(t('error'));
  };

  const handleRejectTerms = () => {
    setShowTerms(false);
    toast.info('يجب قبول شروط الاستخدام للتسجيل في التطبيق');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="w-full max-w-md">
        {/* الشعار الرسمي */}
        <div className="flex flex-col items-center gap-2 mb-6">
          <img
            src="https://miaoda-conversation-file.s3cdn.medo.dev/user-c8wxjlfz0sn4/app-c8wxvvf3rb41/20260612/IMG_0309.png"
            alt="MOSTAAJIR"
            className="w-44 h-auto object-contain"
          />
          <h1 className="text-xl font-bold text-foreground text-balance">مستأجر MOSTAJIR</h1>
          <p className="text-sm text-muted-foreground text-center text-pretty max-w-xs">
            المنصة الجزائرية الأولى لتأجير واستئجار أي شيء بذكاء، أمان، واقتصاد
          </p>
        </div>

        <Card className="max-w-[calc(100%-0rem)] shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl text-balance text-center">{t('registerTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <Label className="text-sm font-normal">{t('name')}</Label>
                <Input value={name} onChange={e => setName(e.target.value)} className="px-3" placeholder="الاسم الكامل" />
              </div>
              <div className="space-y-1">
                <Label className="text-sm font-normal">{t('email')}</Label>
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} className="px-3" dir="ltr" placeholder="example@email.com" />
              </div>
              <div className="space-y-1">
                <Label className="text-sm font-normal">{t('phone')}</Label>
                <Input value={phone} onChange={e => setPhone(e.target.value)} className="px-3" dir="ltr" placeholder="05xx xxx xxx" />
              </div>
              <div className="space-y-1">
                <Label className="text-sm font-normal">{t('wilaya')}</Label>
                <Select onValueChange={v => setWilayaCode(Number(v))}>
                  <SelectTrigger className="px-3">
                    <SelectValue placeholder={t('selectWilaya')} />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {WILAYAS.map(w => (
                      <SelectItem key={w.code} value={String(w.code)}>{w.code} - {w.ar}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-sm font-normal">{t('password')}</Label>
                <div className="relative">
                  <Input
                    type={showPass ? 'text' : 'password'}
                    value={password} onChange={e => setPassword(e.target.value)}
                    className={cn('px-3', isRTL ? 'pl-10' : 'pr-10')} dir="ltr"
                    placeholder="••••••••"
                  />
                  <button type="button"
                    className={cn('absolute top-1/2 -translate-y-1/2 text-muted-foreground', isRTL ? 'left-3' : 'right-3')}
                    onClick={() => setShowPass(!showPass)}>
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? t('loading') : t('register')}
              </Button>
            </form>

            <p className="text-center text-sm text-muted-foreground mt-4">
              {t('hasAccount')}{' '}
              <Link to="/login" className="text-primary font-medium hover:underline">{t('login')}</Link>
            </p>
          </CardContent>
        </Card>
      </div>

      <TermsModal
        open={showTerms}
        onAccept={handleAcceptTerms}
        onReject={handleRejectTerms}
      />
    </div>
  );
}
