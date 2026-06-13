import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/db/supabase';
import { toast } from 'sonner';
import type { Notification } from '@/types';

interface NotificationsContextType {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  sendNotification: (userId: string, title: string, body: string, type?: Notification['type']) => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextType | null>(null);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }: { data: { user: { id: string } | null } }) => {
      if (data.user) setUserId(data.user.id);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event: string, session: { user: { id: string } | null } | null) => {
      setUserId(session?.user?.id || null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const fetchNotifications = useCallback(async () => {
    if (!userId) { setNotifications([]); return; }
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) {
      setNotifications(data.map((r: Record<string, unknown>) => ({
        id: r.id as string,
        userId: r.user_id as string,
        title: r.title as string,
        body: r.body as string,
        type: r.type as Notification['type'],
        read: r.read as boolean,
        createdAt: r.created_at as string,
      })));
    }
  }, [userId]);

  useEffect(() => {
    fetchNotifications();
    if (!userId) return;
    const channel = supabase
      .channel('notifications-' + userId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, (payload: { new: Record<string, unknown> }) => {
        const n = payload.new as Record<string, unknown>;
        const notif: Notification = {
          id: n.id as string,
          userId: n.user_id as string,
          title: n.title as string,
          body: n.body as string,
          type: n.type as Notification['type'],
          read: n.read as boolean,
          createdAt: n.created_at as string,
        };
        setNotifications(prev => [notif, ...prev]);
        toast.info(notif.title, { description: notif.body });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, fetchNotifications]);

  const markAsRead = useCallback(async (id: string) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!userId) return;
    await supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, [userId]);

  const sendNotification = useCallback(async (targetUserId: string, title: string, body: string, type: Notification['type'] = 'general') => {
    await supabase.from('notifications').insert({
      user_id: targetUserId,
      title,
      body,
      type,
    });
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <NotificationsContext.Provider value={{ notifications, unreadCount, markAsRead, markAllAsRead, sendNotification }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider');
  return ctx;
}
