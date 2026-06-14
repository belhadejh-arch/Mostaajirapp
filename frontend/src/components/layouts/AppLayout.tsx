import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Search, PlusCircle, Package, User, Wallet, ShieldCheck, LogOut, Menu, Settings, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAdmin } from '@/contexts/AdminContext';
import { useNotifications } from '@/contexts/NotificationsContext';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { key: 'home' as const, path: '/', icon: Home },
  { key: 'explore' as const, path: '/explore', icon: Search },
  { key: 'addProduct' as const, path: '/add', icon: PlusCircle },
  { key: 'rentals' as const, path: '/rentals', icon: Package },
  { key: 'wallet' as const, path: '/wallet', icon: Wallet },
  { key: 'profile' as const, path: '/profile', icon: User },
];

function NavLink({ path, icon: Icon, label, active, onClick }: {
  path: string; icon: React.ElementType; label: string; active: boolean; onClick?: () => void;
}) {
  return (
    <Link
      to={path}
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors',
        active
          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
          : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
      )}
    >
      <Icon className="shrink-0" size={18} />
      <span className="truncate">{label}</span>
    </Link>
  );
}

function SidebarContent({ onNav }: { onNav?: () => void }) {
  const { t, isRTL } = useLanguage();
  const { user, logout } = useAuth();
  const { settings } = useAdmin();
  const { unreadCount } = useNotifications();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    onNav?.();
    navigate('/login');
  };

  return (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground py-4">
      {/* الشعار الرسمي */}
      <div className="px-4 mb-6 flex items-center justify-center">
        <img
          src="/logo.png"
          alt="MOSTAAJIR"
          className="h-12 w-auto object-contain"
        />
      </div>

      {/* روابط التنقل */}
      <nav className="flex-1 px-2 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(item => (
          <NavLink
            key={item.key}
            path={item.path}
            icon={item.icon}
            label={t(item.key)}
            active={location.pathname === item.path}
            onClick={onNav}
          />
        ))}
        {user?.isAdmin && (
          <NavLink
            path="/admin"
            icon={Settings}
            label={t('admin')}
            active={location.pathname.startsWith('/admin')}
            onClick={onNav}
          />
        )}
      </nav>

      {/* قسم المستخدم */}
      <div className="px-2 pt-4 border-t border-sidebar-border mt-2">
        {user ? (
          <>
            <div className={cn('flex items-center gap-3 px-4 py-3', isRTL ? 'flex-row-reverse' : '')}>
              <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center shrink-0 overflow-hidden">
                {user.avatarUri
                  ? <img src={user.avatarUri} alt={user.name} className="w-full h-full object-cover" />
                  : <span className="text-sm font-bold text-secondary-foreground">{user.name[0]}</span>
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn('text-sm font-semibold text-sidebar-foreground truncate', isRTL ? 'text-right' : '')}>{user.name}</p>
                {user.verificationStatus === 'verified' && (
                  <span className="flex items-center gap-1 text-xs text-green-400">
                    <ShieldCheck size={11} /> <span>{t('verified')}</span>
                  </span>
                )}
                {user.verificationStatus === 'pending' && (
                  <span className="text-xs text-yellow-400">{t('verificationPending')}</span>
                )}
              </div>
            </div>
            <Link to="/notifications" onClick={onNav}>
              <Button
                variant="ghost"
                size="sm"
                className={cn('w-full justify-start gap-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground relative', isRTL ? 'flex-row-reverse' : '')}
              >
                <Bell size={16} />
                الإشعارات
                {unreadCount > 0 && (
                  <span className="absolute top-1 end-2 w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              className={cn('w-full justify-start gap-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground', isRTL ? 'flex-row-reverse' : '')}
              onClick={handleLogout}
            >
              <LogOut size={16} />
              {t('logout')}
            </Button>
          </>
        ) : (
          <Link to="/login" onClick={onNav}>
            <Button className="w-full">{t('login')}</Button>
          </Link>
        )}
      </div>
    </div>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isRTL, t } = useLanguage();
  const { settings } = useAdmin();
  const location = useLocation();

  return (
    <div className={cn('flex min-h-screen w-full bg-background', isRTL ? 'flex-row-reverse' : '')} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* شريط جانبي — سطح المكتب */}
      <aside className="hidden lg:flex flex-col w-64 shrink-0 border-e border-sidebar-border">
        <SidebarContent />
      </aside>

      {/* المحتوى الرئيسي */}
      <div className="flex-1 min-w-0 overflow-x-hidden flex flex-col">
        {/* شريط علوي — الجوال */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-sidebar text-sidebar-foreground border-b border-sidebar-border">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
                <Menu size={22} />
              </Button>
            </SheetTrigger>
            <SheetContent side={isRTL ? 'right' : 'left'} className="w-64 p-0 bg-sidebar border-sidebar-border">
              <SidebarContent onNav={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>

          <div className="flex items-center gap-2">
            <img
              src="/logo.png"
              alt="MOSTAAJIR"
              className="h-9 w-auto object-contain"
            />
          </div>

          <Link to="/notifications" className="relative">
            <Button variant="ghost" size="icon" className="text-sidebar-foreground hover:bg-sidebar-accent">
              <Bell size={20} />
            </Button>
          </Link>
        </header>

        <main className="flex-1 p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
