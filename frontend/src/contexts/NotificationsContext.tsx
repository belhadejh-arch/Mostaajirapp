import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { api, getToken } from '@/api/client';
import { toast } from 'sonner';
import type { Notification } from '@/types';
import { useAuth } from './AuthContext';

interface NotificationsContextType {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  sendNotification: (userId: string, title: string, body: string, type?: Notification['type']) => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextType | null>(null);

function rowToNotif(r: Record<string, unknown>): Notification {
  return {
    id: r.id as string,
    userId: r.user_id as string,
    title: r.title as string,
    body: r.body as string,
    type: r.type as Notification['type'],
    read: r.read as boolean,
    createdAt: r.created_at as string,
  };
}

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const prevCountRef = useRef(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchNotifications = useCallback(async () => {
    if (!getToken()) return;
    try {
      const data = await api.get<Record<string, unknown>[]>('/api/notifications');
      setNotifications(prev => {
        const newNotifs = data.map(rowToNotif);
        const newUnread = newNotifs.filter(n => !n.read).length;
        if (newUnread > prevCountRef.current && prevCountRef.current > 0) {
          const latest = newNotifs.find(n => !n.read);
          if (latest) toast.info(latest.title, { description: latest.body });
        }
        prevCountRef.current = newUnread;
        return newNotifs;
      });
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    if (user?.id) {
      fetchNotifications();
      pollRef.current = setInterval(fetchNotifications, 15_000);
    } else {
      setNotifications([]);
      if (pollRef.current) clearInterval(pollRef.current);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [user?.id, fetchNotifications]);

  const markAsRead = useCallback(async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    try { await api.put(`/api/notifications/${id}/read`); } catch { /* silent */ }
  }, []);

  const markAllAsRead = useCallback(async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    try { await api.put('/api/notifications/read-all'); } catch { /* silent */ }
  }, []);

  const sendNotification = useCallback(async (userId: string, title: string, body: string, type: Notification['type'] = 'general') => {
    try { await api.post('/api/notifications', { userId, title, body, type }); } catch { /* silent */ }
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
