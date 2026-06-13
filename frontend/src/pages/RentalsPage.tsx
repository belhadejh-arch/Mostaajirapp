import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, QrCode, Clock, CheckCircle, XCircle, Timer, PhoneCall, MapPin, RefreshCw, AlertCircle, AlertTriangle, Star, User, MessageSquare, Camera, Keyboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { AppLayout } from '@/components/layouts/AppLayout';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/db/supabase';
import QRCode from 'react-qr-code';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { Rental } from '@/types';

/* ── عداد الوقت الحقيقي (يتحدث كل ثانية) ── */
function CountdownTimer({ startTime, durationDays }: { startTime: string; durationDays: number }) {
  const [display, setDisplay] = useState('');
  const [late, setLate] = useState(false);

  useEffect(() => {
    const tick = () => {
      const end = new Date(startTime).getTime() + durationDays * 24 * 3600000;
      const diff = end - Date.now();
      setLate(diff < 0);
      const abs = Math.abs(diff);
      const d = Math.floor(abs / 86400000);
      const h = Math.floor((abs % 86400000) / 3600000);
      const m = Math.floor((abs % 3600000) / 60000);
      const s = Math.floor((abs % 60000) / 1000);
      const parts: string[] = [];
      if (d > 0) parts.push(`${d}ي`);
      parts.push(`${String(h).padStart(2, '0')}س`);
      parts.push(`${String(m).padStart(2, '0')}د`);
      parts.push(`${String(s).padStart(2, '0')}ث`);
      setDisplay(parts.join(' '));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startTime, durationDays]);

  if (!display) return null;
  return (
    <span className={cn('font-mono text-xs', late ? 'text-destructive font-bold' : 'text-foreground')}>
      {late ? `تأخير: ${display}` : display}
    </span>
  );
}

/* ── ماسح QR بالكاميرا ── */
function CameraQRScanner({ onScan }: { onScan: (text: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    let active = true;
    setError(null);
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      .then(stream => {
        if (!active) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          setScanning(true);
        }
      })
      .catch(() => setError('تعذّر الوصول إلى الكاميرا. تحقق من صلاحيات المتصفح.'));

    return () => {
      active = false;
      streamRef.current?.getTracks().forEach(t => t.stop());
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  useEffect(() => {
    if (!scanning) return;
    let jsQR: ((data: Uint8ClampedArray, w: number, h: number) => { data: string } | null) | null = null;
    import('jsqr').then(m => { jsQR = m.default; startLoop(); }).catch(() => {});

    const startLoop = () => {
      const loop = () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || video.readyState < 2) { rafRef.current = requestAnimationFrame(loop); return; }
        const ctx = canvas.getContext('2d');
        if (!ctx || !jsQR) { rafRef.current = requestAnimationFrame(loop); return; }
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code?.data) { onScan(code.data); return; }
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    };

    return () => cancelAnimationFrame(rafRef.current);
  }, [scanning, onScan]);

  if (error) return (
    <div className="flex flex-col items-center gap-2 py-6 text-destructive text-sm text-center">
      <Camera size={32} className="opacity-50" />
      <p>{error}</p>
    </div>
  );

  return (
    <div className="relative rounded-xl overflow-hidden border border-border bg-black">
      <video ref={videoRef} className="w-full aspect-square object-cover" playsInline muted />
      <canvas ref={canvasRef} className="hidden" />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-48 h-48 border-2 border-primary rounded-xl opacity-80" />
      </div>
      {scanning && (
        <div className="absolute bottom-2 inset-x-0 text-center">
          <span className="text-white text-xs bg-black/50 px-3 py-1 rounded-full">صوّب على رمز QR</span>
        </div>
      )}
    </div>
  );
}

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

/* ── نافذة المحادثة ── */
function ChatDialog({ rental, currentUserId, open, onClose }: {
  rental: Rental; currentUserId: string; open: boolean; onClose: () => void;
}) {
  const { isRTL } = useLanguage();
  const otherName = currentUserId === rental.ownerId ? rental.renterName : rental.ownerName;
  const otherId = currentUserId === rental.ownerId ? rental.renterId : rental.ownerId;
  const [messages, setMessages] = useState<{ id: string; sender_id: string; content: string; created_at: string }[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      const { data } = await supabase
        .from('messages')
        .select('id, sender_id, content, created_at')
        .eq('rental_id', rental.id)
        .order('created_at', { ascending: true });
      if (data) setMessages(data);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    };
    load();
    const channel = supabase
      .channel(`messages:${rental.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `rental_id=eq.${rental.id}` },
        payload => {
          setMessages(prev => [...prev, payload.new as typeof messages[0]]);
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [open, rental.id]);

  const sendMessage = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    await supabase.from('messages').insert({
      rental_id: rental.id,
      sender_id: currentUserId,
      receiver_id: otherId,
      content: text.trim(),
    });
    setText('');
    setSending(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md flex flex-col h-[80vh] p-0" dir={isRTL ? 'rtl' : 'ltr'}>
        <DialogHeader className="px-4 py-3 border-b border-border shrink-0">
          <DialogTitle className="text-base flex items-center gap-2">
            <MessageSquare size={16} />
            محادثة مع {otherName}
            <span className="text-xs font-normal text-muted-foreground truncate">({rental.productTitle})</span>
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 min-h-0">
          {messages.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-8">لا توجد رسائل. ابدأ المحادثة!</p>
          )}
          {messages.map(msg => {
            const isMine = msg.sender_id === currentUserId;
            return (
              <div key={msg.id} className={cn('flex', isMine ? 'justify-end' : 'justify-start')}>
                <div className={cn('max-w-[75%] px-3 py-2 rounded-2xl text-sm', isMine ? 'bg-primary text-primary-foreground rounded-ee-sm' : 'bg-muted text-foreground rounded-es-sm')}>
                  <p>{msg.content}</p>
                  <p className={cn('text-[10px] mt-1 opacity-60', isMine ? 'text-end' : 'text-start')}>
                    {new Date(msg.created_at).toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
        <div className="px-4 py-3 border-t border-border shrink-0">
          <div className={cn('flex gap-2', isRTL ? 'flex-row-reverse' : '')}>
            <Input
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder="اكتب رسالة..."
              className="flex-1 px-3 text-sm"
            />
            <Button size="sm" onClick={sendMessage} disabled={!text.trim() || sending} className="shrink-0">
              إرسال
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── بطاقة تأجير واحدة ── */
function RentalCard({ rental, asOwner }: { rental: Rental; asOwner: boolean }) {
  const navigate = useNavigate();
  const { t, isRTL } = useLanguage();
  const { acceptRental, rejectRental, requestExtension, acceptExtension, rejectExtension, scanHandover, scanReturn, rateOwner } = useData();
  const { user } = useAuth();
  const [qrType, setQrType] = useState<'delivery' | 'return' | null>(null);
  const [extDays, setExtDays] = useState('');
  const [extOpen, setExtOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState<'handover' | 'return' | null>(null);
  const [scanInput, setScanInput] = useState('');
  const [scanMode, setScanMode] = useState<'manual' | 'camera'>('manual');
  const [ratingOpen, setRatingOpen] = useState(false);
  const [ratingValue, setRatingValue] = useState(5);
  const [ratingComment, setRatingComment] = useState('');
  const [ratingDone, setRatingDone] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  const fmt = (n: number) => n.toLocaleString('ar-DZ');
  const qrValue = qrType === 'delivery' ? (rental.handoverToken || rental.qrCodeDelivery) : (rental.returnToken || rental.qrCodeReturn);

  const show48hAlert = () => {
    if (rental.status !== 'active' || !rental.startTime) return false;
    const end = new Date(rental.startTime).getTime() + rental.durationDays * 24 * 3600000;
    const diff = end - Date.now();
    return diff > 0 && diff <= 48 * 3600000;
  };

  const canRequestExtension = () => {
    if (!rental.startTime) return true;
    const end = new Date(rental.startTime).getTime() + rental.durationDays * 24 * 3600000;
    return end - Date.now() >= 12 * 3600000;
  };

  const handleExtend = () => {
    const d = Number(extDays);
    if (!d || d < 1) { toast.error('أدخل عدد أيام صحيح'); return; }
    if (!canRequestExtension()) { toast.error(t('minExtensionNotice')); return; }
    requestExtension(rental.id, d);
    setExtOpen(false);
    toast.success(t('extensionSent'));
  };

  const handleScanConfirm = async () => {
    const scanner = scanOpen === 'handover' ? scanHandover : scanReturn;
    const res = await scanner(scanInput.trim(), rental.ownerId);
    if (res.success) {
      toast.success(res.message);
      setScanOpen(null);
      setScanInput('');
    } else {
      toast.error(res.message || 'كود غير صالح');
    }
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

        {/* بيانات المستأجر — للمؤجر فقط */}
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
          {rental.status === 'active' && rental.startTime && (
            <div className={cn('flex items-center gap-1 col-span-2', isRTL ? 'flex-row-reverse' : '')}>
              <Timer size={11} className="shrink-0" />
              <CountdownTimer startTime={rental.startTime} durationDays={rental.durationDays} />
            </div>
          )}
        </div>

        {/* تنبيه 48 ساعة */}
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

          {/* مؤجر: قبول/رفض */}
          {asOwner && rental.status === 'pending_owner' && (
            <div className="flex gap-2">
              <Button size="sm" className="flex-1 gap-1.5" onClick={() => { acceptRental(rental.id); toast.success(t('acceptOrder')); }}>
                <CheckCircle size={13} /> {t('acceptOrder')}
              </Button>
              <Button size="sm" variant="outline" className="flex-1 gap-1.5" onClick={() => { rejectRental(rental.id); toast.info(t('rejectOrder')); }}>
                <XCircle size={13} /> {t('rejectOrder')}
              </Button>
            </div>
          )}

          {/* مستأجر: QR التسليم */}
          {!asOwner && rental.status === 'accepted' && (
            <Button size="sm" className="w-full gap-1.5" onClick={() => setQrType('delivery')}>
              <QrCode size={14} /> عرض كود QR للتسليم
            </Button>
          )}

          {/* مؤجر: مسح QR التسليم */}
          {asOwner && rental.status === 'accepted' && (
            <Button size="sm" className="w-full gap-1.5" onClick={() => { setScanOpen('handover'); setScanInput(''); setScanMode('manual'); }}>
              <QrCode size={14} /> مسح كود QR للتسليم
            </Button>
          )}

          {/* مستأجر: QR الإرجاع */}
          {!asOwner && rental.status === 'active' && (
            <Button size="sm" variant="outline" className="w-full gap-1.5" onClick={() => setQrType('return')}>
              <QrCode size={14} /> عرض كود QR للإعادة
            </Button>
          )}

          {/* مؤجر: مسح QR الإرجاع */}
          {asOwner && rental.status === 'active' && (
            <Button size="sm" className="w-full gap-1.5" onClick={() => { setScanOpen('return'); setScanInput(''); setScanMode('manual'); }}>
              <QrCode size={14} /> مسح كود QR للإعادة
            </Button>
          )}

          {/* مستأجر: طلب تمديد */}
          {!asOwner && rental.status === 'active' && !rental.extensionRequested && canRequestExtension() && (
            <Button size="sm" variant="outline" className="w-full gap-1.5" onClick={() => setExtOpen(true)}>
              <RefreshCw size={13} /> {t('extendRental')}
            </Button>
          )}

          {/* مؤجر: قبول/رفض تمديد */}
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

          {/* زر المحادثة — لجميع الإيجارات النشطة */}
          {['pending_owner', 'accepted', 'active', 'extend_requested'].includes(rental.status) && user && (
            <Button size="sm" variant="outline" className="w-full gap-1.5" onClick={() => setChatOpen(true)}>
              <MessageSquare size={13} /> رسالة
            </Button>
          )}

          {/* تقديم نزاع */}
          {(rental.status === 'active' || rental.status === 'completed') && (
            <Button size="sm" variant="ghost" className="w-full gap-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-500/10" onClick={() => navigate(`/dispute/${rental.id}`)}>
              <AlertTriangle size={13} /> تقديم نزاع
            </Button>
          )}

          {/* تقييم المؤجر */}
          {!asOwner && rental.status === 'completed' && !ratingDone && (
            <Button size="sm" variant="ghost" className="w-full gap-1.5 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-500/10" onClick={() => setRatingOpen(true)}>
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
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map(star => (
                <button key={star} type="button" onClick={() => setRatingValue(star)} className="focus:outline-none transition-transform hover:scale-110">
                  <Star size={32} className={star <= ratingValue ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'} />
                </button>
              ))}
            </div>
            <div className="space-y-1">
              <Label className="text-sm font-normal">تعليق (اختياري)</Label>
              <input type="text" value={ratingComment} onChange={e => setRatingComment(e.target.value)} placeholder="اكتب تعليقك هنا..." className="w-full px-3 h-10 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
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

      {/* ── نافذة QR للمستأجر ── */}
      <Dialog open={!!qrType} onOpenChange={() => setQrType(null)}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-balance">
              {qrType === 'delivery' ? t('deliveryQR') : t('returnQR')}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="p-4 bg-white rounded-xl border border-border">
              <QRCode value={qrValue || 'MOSTAJIR'} size={180} />
            </div>
            <p className="text-xs text-muted-foreground text-center text-pretty">
              {qrType === 'delivery' ? 'اعرض هذا الرمز للمؤجر لمسحه عند التسليم' : 'اعرض هذا الرمز للمؤجر لمسحه عند الإعادة'}
            </p>
            <p className="font-mono text-xs text-muted-foreground break-all text-center">{qrValue}</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── نافذة الماسح (للمؤجر) مع كاميرا ── */}
      <Dialog open={!!scanOpen} onOpenChange={() => { setScanOpen(null); setScanInput(''); setScanMode('manual'); }}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-sm" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle className="text-balance">
              {scanOpen === 'handover' ? 'مسح كود QR للتسليم' : 'مسح كود QR للإعادة'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* اختيار الوضع */}
            <div className="flex gap-2 bg-muted rounded-lg p-1">
              <button
                className={cn('flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-sm font-medium transition-colors', scanMode === 'manual' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground')}
                onClick={() => setScanMode('manual')}
              >
                <Keyboard size={14} /> يدوي
              </button>
              <button
                className={cn('flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-sm font-medium transition-colors', scanMode === 'camera' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground')}
                onClick={() => setScanMode('camera')}
              >
                <Camera size={14} /> كاميرا
              </button>
            </div>

            {scanMode === 'manual' ? (
              <>
                <p className="text-xs text-muted-foreground">اطلب من المستأجر عرض الكود، ثم أدخله يدوياً:</p>
                <Input value={scanInput} onChange={e => setScanInput(e.target.value)} placeholder="أدخل كود QR..." className="px-3 font-mono text-xs" dir="ltr" />
              </>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">صوّب الكاميرا نحو رمز QR المستأجر:</p>
                {scanOpen && (
                  <CameraQRScanner onScan={(text) => { setScanInput(text); setScanMode('manual'); toast.info('تم مسح الرمز! اضغط تأكيد.'); }} />
                )}
              </>
            )}

            {scanInput && (
              <div className="bg-muted/50 rounded px-3 py-1.5 text-xs font-mono text-center text-muted-foreground break-all">{scanInput}</div>
            )}

            <Button className="w-full gap-1.5" disabled={!scanInput.trim()} onClick={handleScanConfirm}>
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
              <Input type="number" min={1} max={15} value={extDays} onChange={e => setExtDays(e.target.value)} className="px-3" dir="ltr" placeholder="1 - 15" />
            </div>
            <p className="text-xs text-muted-foreground">{t('minExtensionNotice')}</p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setExtOpen(false)}>{t('cancel')}</Button>
              <Button className="flex-1" onClick={handleExtend}>{t('submit')}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── نافذة المحادثة ── */}
      {user && (
        <ChatDialog rental={rental} currentUserId={user.id} open={chatOpen} onClose={() => setChatOpen(false)} />
      )}
    </Card>
  );
}

/* ── الصفحة الرئيسية ── */
export default function RentalsPage() {
  const { t, isRTL } = useLanguage();
  const { rentals } = useData();
  const { user } = useAuth();
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
