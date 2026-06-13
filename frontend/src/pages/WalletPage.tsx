import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wallet, TrendingUp, PlusCircle, ArrowDownCircle, ArrowUpCircle, Lock, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AppLayout } from '@/components/layouts/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useData } from '@/contexts/DataContext';
import { useAdmin } from '@/contexts/AdminContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const MOCK_TRANSACTIONS = [
  { id: 't1', type: 'topup', amount: 10000, label: 'إيداع رصيد', date: '2025-03-10' },
  { id: 't2', type: 'rent', amount: -4500, label: 'استئجار كاميرا Canon', date: '2025-03-08' },
  { id: 't3', type: 'earning', amount: 3825, label: 'أرباح تأجير — صافي بعد العمولة', date: '2025-03-07' },
  { id: 't4', type: 'withdrawal', amount: -5000, label: 'سحب أرباح', date: '2025-03-05' },
  { id: 't5', type: 'earning', amount: 6200, label: 'أرباح تأجير — حفارة Bosch', date: '2025-03-02' },
  { id: 't6', type: 'rent', amount: -1600, label: 'إيجار أدوات', date: '2025-02-28' },
];

export default function WalletPage() {
  const { t, isRTL } = useLanguage();
  const { user, updateUser } = useAuth();
  const { rentals } = useData();
  const { settings } = useAdmin();
  const navigate = useNavigate();

  const [topUpOpen, setTopUpOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawName, setWithdrawName] = useState(user?.name || '');
  const [withdrawPhone, setWithdrawPhone] = useState(user?.phone || '');
  const [ccpNumber, setCcpNumber] = useState('');
  const [loading, setLoading] = useState(false);

  if (!user) return (
    <AppLayout>
      <div className="flex flex-col items-center justify-center py-20 gap-4" dir={isRTL ? 'rtl' : 'ltr'}>
        <Wallet className="text-muted-foreground" size={48} />
        <Button onClick={() => navigate('/login')}>{t('login')}</Button>
      </div>
    </AppLayout>
  );

  const fmt = (n: number) => n.toLocaleString('ar-DZ');

  /* ── إيداع ── */
  const handleTopUp = async () => {
    if (!selectedAmount) { toast.error('اختر مبلغاً'); return; }
    setLoading(true);
    await new Promise(r => setTimeout(r, 700));
    updateUser({ walletBalance: user.walletBalance + selectedAmount });
    setLoading(false);
    setTopUpOpen(false);
    setSelectedAmount(null);
    toast.success(`تم إيداع ${fmt(selectedAmount)} دج في محفظتك`);
  };

  /* ── سحب ── */
  const handleWithdraw = async () => {
    const amt = Number(withdrawAmount);
    if (!withdrawName.trim() || !withdrawPhone.trim() || !ccpNumber.trim() || !amt) {
      toast.error(t('fillAllFields')); return;
    }
    if (amt < settings.minWithdrawal) { toast.error(t('minWithdrawal')); return; }
    if (amt > user.earningsBalance) { toast.error(t('insufficientEarnings')); return; }
    setLoading(true);
    await new Promise(r => setTimeout(r, 700));
    updateUser({ earningsBalance: user.earningsBalance - amt });
    setLoading(false);
    setWithdrawOpen(false);
    setWithdrawAmount('');
    toast.success(t('withdrawalSubmitted'));
  };

  /* ── أرباح المؤجر من الإيجارات المكتملة ── */
  const completedOwnerRentals = rentals.filter(r => r.ownerId === user.id && r.status === 'completed');
  const earningsDetails = completedOwnerRentals.map(r => ({
    id: r.id, title: r.productTitle,
    gross: r.dailyRate * r.durationDays,
    commission: r.commissionAmount, net: r.netEarnings,
  }));

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-5" dir={isRTL ? 'rtl' : 'ltr'}>
        <h1 className="text-2xl font-bold text-balance">{t('wallet')}</h1>

        {/* ── بطاقات الأرصدة الثلاثة ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* رصيد المحفظة */}
          <Card className="h-full">
            <CardContent className="pt-4 space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Wallet size={16} />
                <span className="text-sm">{t('walletBalance')}</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{fmt(user.walletBalance)}</p>
              <p className="text-xs text-muted-foreground">{t('dz')}</p>
              <Button size="sm" className="w-full mt-2 gap-1.5" onClick={() => setTopUpOpen(true)}>
                <PlusCircle size={14} /> {t('topUp')}
              </Button>
            </CardContent>
          </Card>

          {/* الأرباح */}
          <Card className="h-full">
            <CardContent className="pt-4 space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <TrendingUp size={16} />
                <span className="text-sm">{t('earnings')}</span>
              </div>
              <p className="text-2xl font-bold text-primary">{fmt(user.earningsBalance)}</p>
              <p className="text-xs text-muted-foreground">{t('dz')}</p>
              <Button size="sm" variant="outline" className="w-full mt-2 gap-1.5" onClick={() => setWithdrawOpen(true)}>
                <ArrowUpCircle size={14} /> {t('withdraw')}
              </Button>
            </CardContent>
          </Card>

          {/* الضمانات المجمدة */}
          <Card className="h-full">
            <CardContent className="pt-4 space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Lock size={16} />
                <span className="text-sm">{t('frozenBalance')}</span>
              </div>
              <p className="text-2xl font-bold text-amber-600">{fmt(user.frozenBalance)}</p>
              <p className="text-xs text-muted-foreground">{t('dz')}</p>
              <p className="text-xs text-muted-foreground mt-2">مجمدة حتى اكتمال التسليم</p>
            </CardContent>
          </Card>
        </div>

        {/* ── تفصيل الأرباح (للمؤجر) ── */}
        {earningsDetails.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t('earningsBreakdown')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm whitespace-nowrap">
                  <thead>
                    <tr className="border-b border-border">
                      <th className={cn('py-2 font-medium text-muted-foreground', isRTL ? 'text-right' : 'text-left')}>المنتج</th>
                      <th className="py-2 font-medium text-muted-foreground text-center">الإجمالي</th>
                      <th className="py-2 font-medium text-muted-foreground text-center">العمولة</th>
                      <th className="py-2 font-medium text-primary text-center">الصافي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {earningsDetails.map(e => (
                      <tr key={e.id} className="border-b border-border last:border-0">
                        <td className="py-2 max-w-[120px] truncate">{e.title}</td>
                        <td className="py-2 text-center">{fmt(e.gross)}</td>
                        <td className="py-2 text-center text-destructive">- {fmt(e.commission)}</td>
                        <td className="py-2 text-center font-bold text-primary">{fmt(e.net)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── سجل المعاملات ── */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('transactions')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-0 divide-y divide-border">
              {MOCK_TRANSACTIONS.map(tx => (
                <div key={tx.id} className={cn('flex items-center gap-3 py-3', isRTL ? 'flex-row-reverse' : '')}>
                  <div className={cn('w-8 h-8 rounded-full flex items-center justify-center shrink-0', tx.amount > 0 ? 'bg-green-500/10' : 'bg-destructive/10')}>
                    {tx.amount > 0
                      ? <ArrowDownCircle size={16} className="text-green-600" />
                      : <ArrowUpCircle size={16} className="text-destructive" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{tx.label}</p>
                    <p className="text-xs text-muted-foreground">{tx.date}</p>
                  </div>
                  <span className={cn('font-semibold text-sm shrink-0', tx.amount > 0 ? 'text-green-600' : 'text-destructive')}>
                    {tx.amount > 0 ? '+' : ''}{fmt(tx.amount)} {t('dz')}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── نافذة الإيداع ── */}
      <Dialog open={topUpOpen} onOpenChange={setTopUpOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>{t('topUp')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">اختر المبلغ المراد إيداعه في محفظتك</p>
            <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto pr-1">
              {settings.topUpAmounts.map(amt => (
                <button
                  key={amt}
                  onClick={() => setSelectedAmount(amt)}
                  className={cn(
                    'py-3 rounded-lg border text-sm font-semibold transition-colors',
                    selectedAmount === amt
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:border-primary/50 text-foreground'
                  )}
                >
                  {fmt(amt)}
                </button>
              ))}
            </div>
            {selectedAmount && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg px-4 py-2 text-sm text-center">
                سيتم إيداع <span className="font-bold text-primary">{fmt(selectedAmount)} {t('dz')}</span>
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setTopUpOpen(false)}>{t('cancel')}</Button>
              <Button className="flex-1" disabled={!selectedAmount || loading} onClick={handleTopUp}>
                {loading ? t('loading') : t('confirm')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── نافذة السحب ── */}
      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>{t('withdraw')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-3 text-sm">
              <p className="text-muted-foreground">{t('earnings')}</p>
              <p className="font-bold text-primary text-lg">{fmt(user.earningsBalance)} {t('dz')}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-sm font-normal">{t('withdrawName')} <span className="text-destructive">*</span></Label>
              <Input value={withdrawName} onChange={e => setWithdrawName(e.target.value)} className="px-3" />
            </div>
            <div className="space-y-1">
              <Label className="text-sm font-normal">{t('withdrawPhone')} <span className="text-destructive">*</span></Label>
              <Input value={withdrawPhone} onChange={e => setWithdrawPhone(e.target.value)} className="px-3" dir="ltr" placeholder="05xx xxx xxx" />
            </div>
            <div className="space-y-1">
              <Label className="text-sm font-normal">{t('ccpNumber')} <span className="text-destructive">*</span></Label>
              <Input value={ccpNumber} onChange={e => setCcpNumber(e.target.value)} className="px-3" dir="ltr" placeholder="0000000000" />
            </div>
            <div className="space-y-1">
              <Label className="text-sm font-normal">{t('selectAmount')} ({t('dz')}) <span className="text-destructive">*</span></Label>
              <Input type="number" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} className="px-3" dir="ltr" min={settings.minWithdrawal} max={user.earningsBalance} />
              <p className="text-xs text-muted-foreground">{t('minWithdrawal')}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setWithdrawOpen(false)}>{t('cancel')}</Button>
              <Button className="flex-1" disabled={loading} onClick={handleWithdraw}>
                {loading ? t('loading') : t('submit')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}


