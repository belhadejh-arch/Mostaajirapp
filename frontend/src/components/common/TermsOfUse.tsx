import React, { useState } from 'react';
import { ScrollText, CheckCircle, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

/* ── محتوى شروط الاستخدام ── */
const SECTIONS = [
  {
    num: '1',
    title: 'طبيعة الخدمة',
    body: 'يوفر التطبيق منصة إلكترونية تربط بين المؤجرين والمستأجرين لتسهيل عمليات تأجير واستئجار المنتجات والأدوات والممتلكات المختلفة. التطبيق يعمل كوسيط إلكتروني فقط ولا يعد طرفًا في عقد التأجير المبرم بين المستخدمين.',
  },
  {
    num: '2',
    title: 'إنشاء الحساب',
    body: 'يجب على المستخدم تقديم معلومات صحيحة ودقيقة عند التسجيل. يحق للتطبيق طلب توثيق الهوية من أجل تعزيز الأمان وحماية المستخدمين من الاحتيال وسوء الاستخدام. يتحمل المستخدم مسؤولية المحافظة على سرية بيانات الدخول الخاصة به.',
  },
  {
    num: '3',
    title: 'التحقق من الهوية',
    body: 'قد يطلب التطبيق صورة من بطاقة الهوية وصورة سيلفي للتحقق من هوية المستخدم. تستخدم هذه المعلومات لأغراض التحقق والأمان فقط ولا يتم بيعها أو مشاركتها مع أي طرف غير مصرح له قانونًا.',
  },
  {
    num: '4',
    title: 'مسؤوليات المؤجر',
    body: 'يلتزم المؤجر بتقديم معلومات صحيحة عن المنتج المعروض. يلتزم بتسليم المنتج بالحالة الموصوفة داخل الإعلان. يتحمل مسؤولية صحة ملكية المنتج المعروض للتأجير.',
  },
  {
    num: '5',
    title: 'مسؤوليات المستأجر',
    body: 'يلتزم المستأجر باستخدام المنتج بطريقة قانونية وآمنة. يلتزم بإعادة المنتج في الموعد المتفق عليه وبالحالة المناسبة وفقًا لشروط التأجير. يتحمل مسؤولية الأضرار الناتجة عن سوء الاستخدام أو الإهمال.',
  },
  {
    num: '6',
    title: 'الرسوم والعمولات',
    body: 'يحق للتطبيق اقتطاع عمولة أو رسوم خدمة مقابل استخدام المنصة. قد يتم تعديل الرسوم مستقبلًا مع إشعار المستخدمين عبر التطبيق.',
  },
  {
    num: '7',
    title: 'المحتوى المحظور',
    body: 'يمنع عرض أو تأجير المنتجات المسروقة، والمواد غير القانونية، والأسلحة أو المواد الخطرة المحظورة قانونًا، وأي منتج يخالف القوانين المعمول بها.',
  },
  {
    num: '8',
    title: 'إيقاف الحسابات',
    body: 'يحق لإدارة التطبيق تعليق أو حذف أي حساب يخالف هذه الشروط أو يقوم بأعمال احتيالية أو يهدد سلامة المستخدمين.',
  },
  {
    num: '9',
    title: 'حدود المسؤولية',
    body: 'التطبيق يوفر منصة للتواصل بين المستخدمين ولا يضمن جودة أو سلامة أو صلاحية المنتجات المعروضة. يتحمل المؤجر والمستأجر المسؤولية الكاملة عن الاتفاقات والالتزامات الناشئة بينهما.',
  },
  {
    num: '10',
    title: 'تعديل الشروط',
    body: 'يحق لإدارة التطبيق تعديل شروط الاستخدام في أي وقت، ويعتبر استمرار استخدام التطبيق موافقة على التعديلات الجديدة.',
  },
  {
    num: '11',
    title: 'التواصل',
    body: 'لأي استفسار أو شكوى يمكن التواصل مع إدارة التطبيق عبر وسائل الاتصال المتوفرة داخل التطبيق.',
  },
];

/* ── محتوى الشروط (للعرض داخل الصفحات) ── */
export function TermsContent({ compact = false }: { compact?: boolean }) {
  const [expanded, setExpanded] = useState<string | null>(compact ? null : 'all');

  return (
    <div className="space-y-3 text-right" dir="rtl">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <ScrollText size={18} className="text-primary" />
        </div>
        <div>
          <h3 className="font-bold text-base">شروط الاستخدام — مستأجر</h3>
          <p className="text-xs text-muted-foreground">باستخدامك للتطبيق فإنك توافق على الالتزام بهذه الشروط والأحكام</p>
        </div>
      </div>

      {SECTIONS.map(s => (
        <div key={s.num} className="rounded-lg border border-border bg-muted/30 overflow-hidden">
          <button
            type="button"
            className="w-full flex items-center justify-between gap-3 px-4 py-3 text-right hover:bg-muted/50 transition-colors"
            onClick={() => setExpanded(prev => prev === s.num ? null : s.num)}
          >
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                {s.num}
              </span>
              <span className="font-semibold text-sm">{s.title}</span>
            </div>
            {expanded === s.num
              ? <ChevronUp size={15} className="text-muted-foreground shrink-0" />
              : <ChevronDown size={15} className="text-muted-foreground shrink-0" />}
          </button>
          {expanded === s.num && (
            <p className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed">
              {s.body}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

/* ── نافذة شروط الاستخدام (للتسجيل) ── */
interface TermsModalProps {
  open: boolean;
  onAccept: () => void;
  onReject: () => void;
}

export function TermsModal({ open, onAccept, onReject }: TermsModalProps) {
  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-[calc(100%-2rem)] md:max-w-2xl max-h-[90vh] flex flex-col p-0"
        dir="rtl"
        onPointerDownOutside={e => e.preventDefault()}
        onEscapeKeyDown={e => e.preventDefault()}
      >
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <ScrollText size={18} className="text-primary" />
            شروط الاستخدام وسياسة الخصوصية
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            يرجى قراءة الشروط التالية بعناية قبل استخدام تطبيق مستأجر
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="mb-4 p-3 rounded-lg bg-primary/5 border border-primary/20">
            <p className="text-sm font-medium text-primary">
              مرحبًا بك في تطبيق "مستأجر". باستخدامك للتطبيق فإنك توافق على الالتزام بهذه الشروط والأحكام.
            </p>
          </div>

          <div className="space-y-3" dir="rtl">
            {SECTIONS.map(s => (
              <div key={s.num} className="rounded-lg border border-border bg-muted/20 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                    {s.num}
                  </span>
                  <h4 className="font-semibold text-sm">{s.title}</h4>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed pr-8">{s.body}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="px-5 py-4 border-t border-border shrink-0 bg-background">
          <p className="text-xs text-muted-foreground text-center mb-3">
            بالضغط على "أقبل الشروط" فإنك تؤكد قراءتك والموافقة على جميع البنود أعلاه
          </p>
          <div className={cn('flex gap-3')}>
            <Button
              variant="outline"
              className="flex-1 gap-2 text-destructive border-destructive/40 hover:bg-destructive/5"
              onClick={onReject}
            >
              <XCircle size={16} /> أرفض الشروط
            </Button>
            <Button className="flex-1 gap-2" onClick={onAccept}>
              <CheckCircle size={16} /> أقبل الشروط
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
