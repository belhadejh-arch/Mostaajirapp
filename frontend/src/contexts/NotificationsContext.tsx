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

/* ── Play notification sound ── */
let audioCtx: AudioContext | null = null;
const playNotificationSound = () => {
  try {
    const audio = new Audio('/notification.ogg');
    audio.volume = 0.6;
    audio.play().catch(() => {});
  } catch {}
};

/* ── Resolve WebSocket URL ── */
function getWsUrl(token: string): string {
  const apiBase = (import.meta.env.VITE_API_URL as string) || '';
  if (apiBase.startsWith('https://')) {
    const host = apiBase.replace('https://', '');
    return `wss://${host}/ws?token=${encodeURIComponent(token)}`;
  }
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const host = window.location.host;
  return `${proto}://${host}/ws?token=${encodeURIComponent(token)}`;
}

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const prevCountRef = useRef(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const handleNewNotifs = useCallback((newNotifs: Notification[]) => {
    const newUnread = newNotifs.filter(n => !n.read).length;
    if (newUnread > prevCountRef.current && prevCountRef.current >= 0) {
      const latest = newNotifs.find(n => !n.read);
      if (latest) {
        toast.info(latest.title, { description: latest.body });
        playNotificationSound();
      }
    }
    prevCountRef.current = newUnread;
    setNotifications(newNotifs);
  }, []);

  const fetchNotifications = useCallback(async () => {
    if (!getToken()) return;
    try {
      const data = await api.get<Record<string, unknown>[]>('/api/notifications');
      if (mountedRef.current) handleNewNotifs(data.map(rowToNotif));
    } catch { /* silent */ }
  }, [handleNewNotifs]);

  /* ── WebSocket connection with auto-reconnect ── */
  const connectWS = useCallback(() => {
    const token = getToken();
    if (!token || !mountedRef.current) return;

    const cleanup = () => {
      if (wsRef.current) {
        wsRef.current.onopen = null;
        wsRef.current.onmessage = null;
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        try { wsRef.current.close(); } catch {}
        wsRef.current = null;
      }
    };

    cleanup();

    try {
      const url = getWsUrl(token);
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {};

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string);
          if (data.type === 'notification') {
            fetchNotifications();
          }
        } catch {}
      };

      ws.onclose = () => {
        wsRef.current = null;
        if (mountedRef.current) {
          reconnectRef.current = setTimeout(connectWS, 5000);
        }
      };

      ws.onerror = () => {
        try { ws.close(); } catch {}
      };
    } catch {}
  }, [fetchNotifications]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (user?.id) {
      fetchNotifications();
      connectWS();
      /* Fallback polling every 30s (in case WS drops) */
      pollRef.current = setInterval(fetchNotifications, 30_000);
    } else {
      setNotifications([]);
      prevCountRef.current = 0;
      if (wsRef.current) { try { wsRef.current.close(); } catch {} wsRef.current = null; }
      if (pollRef.current) clearInterval(pollRef.current);
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (wsRef.current) { try { wsRef.current.close(); } catch {} wsRef.current = null; }
    };
  }, [user?.id, fetchNotifications, connectWS]);

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
