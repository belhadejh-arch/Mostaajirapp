import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, Send, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { AppLayout } from '@/components/layouts/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function DisputePage() {
  const { rentalId } = useParams<{ rentalId: string }>();
  const { t, isRTL } = useLanguage();
  const { user } = useAuth();
  const { rentals, fileDispute } = useData();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const rental = rentals.find(r => r.id === rentalId);

  if (!user) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-20 gap-4" dir={isRTL ? 'rtl' : 'ltr'}>
          <AlertTriangle className="text-muted-foreground" size={48} />
          <Button onClick={() => navigate('/login')}>{t('login')}</Button>
        </div>
      </AppLayout>
    );
  }

  if (!rental) {
    return (
      <AppLayout>
        <div className="max-w-lg mx-auto py-8 text-center" dir={isRTL ? 'rtl' : 'ltr'}>
          <AlertTriangle className="mx-auto mb-3 text-muted-foreground" size={40} />
          <p className="text-muted-foreground">الإيجار غير موجود</p>
          <Button className="mt-4" onClick={() => navigate('/rentals')}>طلباتي</Button>
        </div>
      </AppLayout>
    );
  }

  const isOwner = rental.ownerId === user.id;
  const isRenter = rental.renterId === user.id;

  if (!isOwner && !isRenter) {
    return (
      <AppLayout>
        <div className="max-w-lg mx-auto py-8 text-center" dir={isRTL ? 'rtl' : 'ltr'}>
          <AlertTriangle className="mx-auto mb-3 text-destructive" size={40} />
          <p className="text-muted-foreground">لا يمكنك تقديم نزاع على هذا الإيجار</p>
        </div>
      </AppLayout>
    );
  }

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) {
      toast.error('يرجى ملء عنوان النزاع ووصفه'); return;
    }
    setLoading(true);
    await fileDispute({
      rentalId: rental.id,
      filedBy: isOwner ? 'owner' : 'renter',
      userId: user.id,
      userName: user.name,
      userPhone: user.phone,
      title: title.trim(),
      description: description.trim(),
    });
    setLoading(false);
    toast.success('تم تقديم النزاع بنجاح. سيتم مراجعته من قِبل الإدارة.');
    navigate('/rentals');
  };

  return (
    <AppLayout>
      <div className="max-w-xl mx-auto space-y-5" dir={isRTL ? 'rtl' : 'ltr'}>
        <div>
          <Button variant="ghost" size="sm" className="gap-1 mb-2 h-8 px-2" onClick={() => navigate('/rentals')}>
            {isRTL ? <ChevronRight size={14} /> : <ChevronRight size={14} className="rotate-180" />}
            رجوع
          </Button>
          <h1 className="text-2xl font-bold text-balance">تقديم نزاع</h1>
          <p className="text-sm text-muted-foreground mt-1 text-pretty">
            {isOwner ? 'تقديم شكوى بصفتك مؤجّراً' : 'تقديم شكوى بصفتك مستأجراً'}
          </p>
        </div>

        {/* معلومات الإيجار */}
        <Card className="border-primary/20">
          <CardContent className="pt-4 pb-4">
            <div className={cn('flex items-center gap-3', isRTL ? 'flex-row-reverse' : '')}>
              <img src={rental.productImage} alt={rental.productTitle} className="w-14 h-14 rounded-lg object-cover shrink-0" />
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate">{rental.productTitle}</p>
                <p className="text-xs text-muted-foreground">
                  {isOwner ? `المستأجر: ${rental.renterName}` : `المؤجّر: ${rental.ownerName}`}
                </p>
                <p className="text-xs text-muted-foreground">
                  الحالة: {rental.status === 'active' ? 'نشط' : rental.status === 'completed' ? 'مكتمل' : rental.status}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* نموذج النزاع */}
        <Card>
          <CardContent className="pt-5 space-y-4">
            <div className="space-y-1">
              <Label className="text-sm font-normal">عنوان النزاع</Label>
              <Input
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="px-3"
                placeholder="مثال: تأخير في التسليم / ضرر في المنتج"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm font-normal">تفاصيل النزاع</Label>
              <Textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="px-3 min-h-[120px]"
                placeholder="اشرح المشكلة بالتفصيل..."
              />
            </div>
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-400">
                سيتم إرسال النزاع لفريق الإدارة للمراجعة والتدخل لحله قانونياً.
              </p>
            </div>
            <Button className="w-full gap-2" onClick={handleSubmit} disabled={loading}>
              <Send size={16} />
              {loading ? t('loading') : 'تقديم النزاع'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
