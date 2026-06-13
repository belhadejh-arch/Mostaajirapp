import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function LoginPage() {
  const { t, isRTL, language, setLanguage } = useLanguage();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) { toast.error('يرجى ملء جميع الحقول'); return; }
    setLoading(true);
    const ok = await login(email.trim(), password);
    setLoading(false);
    if (ok) navigate('/');
    else toast.error('البريد الإلكتروني أو كلمة المرور غير صحيحة');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="w-full max-w-md space-y-4">
        {/* الشعار الرسمي */}
        <div className="flex flex-col items-center gap-2 mb-6">
          <img
            src="https://miaoda-conversation-file.s3cdn.medo.dev/user-c8wxjlfz0sn4/app-c8wxvvf3rb41/20260612/IMG_0309.png"
            alt="MOSTAAJIR"
            className="w-44 h-auto object-contain"
          />
          <p className="text-sm text-muted-foreground text-center text-pretty max-w-xs">
            المنصة الجزائرية الأولى لتأجير واستئجار أي شيء بذكاء، أمان، واقتصاد
          </p>
        </div>

        {/* اختيار اللغة */}
        <div className="flex gap-2 justify-center">
          {(['ar', 'en', 'fr'] as const).map(l => (
            <Button key={l} size="sm" variant={language === l ? 'default' : 'outline'}
              className="w-12 text-xs" onClick={() => setLanguage(l)}>
              {l.toUpperCase()}
            </Button>
          ))}
        </div>

        <Card className="shadow-sm max-w-[calc(100%-0rem)]">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl text-balance text-center">{t('loginTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <Label className="text-sm font-normal">{t('email')}</Label>
                <Input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="example@email.com" className="px-3" dir="ltr"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-sm font-normal">{t('password')}</Label>
                <div className="relative">
                  <Input
                    type={showPass ? 'text' : 'password'} value={password}
                    onChange={e => setPassword(e.target.value)} placeholder="••••••••"
                    className={cn('px-3', isRTL ? 'pl-10' : 'pr-10')} dir="ltr"
                  />
                  <button
                    type="button"
                    className={cn('absolute top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground', isRTL ? 'left-3' : 'right-3')}
                    onClick={() => setShowPass(!showPass)}
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? t('loading') : t('login')}
              </Button>
            </form>

            <p className="text-center text-sm text-muted-foreground mt-4">
              {t('noAccount')}{' '}
              <Link to="/register" className="text-primary font-medium hover:underline">{t('register')}</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

