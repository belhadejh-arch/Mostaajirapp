import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AppLayout } from '@/components/layouts/AppLayout';
import { useNotifications } from '@/contexts/NotificationsContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

export default function NotificationsPage() {
  const { notifications, markAsRead, markAllAsRead } = useNotifications();
  const { isRTL } = useLanguage();
  const navigate = useNavigate();

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-4">
        {/* رأس الصفحة */}
        <div className={cn('flex items-center gap-3', isRTL ? 'flex-row-reverse' : '')}>
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft size={18} />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-balance">الإشعارات</h1>
            <p className="text-xs text-muted-foreground">تابع آخر تحديثاتك وأخبارك</p>
          </div>
          {notifications.some(n => !n.read) && (
            <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={markAllAsRead}>
              <CheckCheck size={14} /> تحديد الكل كمقروء
            </Button>
          )}
        </div>

        {/* قائمة الإشعارات */}
        {notifications.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Bell size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">لا توجد إشعارات حالياً</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map(n => (
              <Card
                key={n.id}
                className={cn('cursor-pointer transition-colors', !n.read ? 'bg-primary/5 border-primary/20' : 'bg-card')}
                onClick={() => { if (!n.read) markAsRead(n.id); }}
              >
                <CardContent className="p-3 flex items-start gap-3">
                  <div className={cn('w-2 h-2 rounded-full mt-2 shrink-0', !n.read ? 'bg-primary' : 'bg-transparent')} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{n.title}</p>
                    <p className="text-xs text-muted-foreground text-pretty">{n.body}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {new Date(n.createdAt).toLocaleDateString('ar-DZ', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
