import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, ChevronLeft, Package, TrendingUp, Star, Wallet, ShieldCheck, Clock, ArrowUpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ProductCard } from '@/components/ProductCard';
import { SearchBar } from '@/components/SearchBar';
import { AppLayout } from '@/components/layouts/AppLayout';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { CATEGORIES } from '@/constants/categories';
import { cn } from '@/lib/utils';
import type { Product } from '@/types';

function SectionHeader({ title, onSeeAll, isRTL }: { title: string; onSeeAll?: () => void; isRTL: boolean }) {
  return (
    <div className={cn('flex items-center justify-between mb-4', isRTL ? 'flex-row-reverse' : '')}>
      <h2 className="text-base font-bold text-foreground text-balance">{title}</h2>
      {onSeeAll && (
        <Button variant="ghost" size="sm" className="text-primary gap-1 h-8 shrink-0" onClick={onSeeAll}>
          <span className="text-sm">عرض الكل</span>
          {isRTL ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
        </Button>
      )}
    </div>
  );
}

function ProductRow({ products }: { products: Product[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {products.map(p => <ProductCard key={p.id} product={p} />)}
    </div>
  );
}

function ProductRowSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-xl overflow-hidden border border-border bg-card">
          <Skeleton className="h-36 w-full" />
          <div className="p-3 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── لوحة المؤجر ── */
function OwnerDashboard() {
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const { getOwnerStats } = useData();
  const navigate = useNavigate();
  if (!user) return null;
  const stats = getOwnerStats(user.id);
  const items = [
    { label: 'المنتجات الكلية', value: stats.products, icon: Package },
    { label: 'إجمالي التأجيرات', value: stats.rentals, icon: Star },
    { label: 'إجمالي الأرباح', value: stats.totalEarnings.toLocaleString() + ' دج', icon: TrendingUp, accent: true },
    { label: 'أرباح الشهر', value: stats.monthlyEarnings.toLocaleString() + ' دج', icon: TrendingUp },
    { label: 'متاح', value: stats.available, icon: Package },
    { label: 'مؤجّر', value: stats.rented, icon: Clock },
  ];
  return (
    <Card className="border-primary/20">
      <CardContent className="pt-4 pb-4">
        <div className={cn('flex items-center justify-between mb-3', isRTL ? 'flex-row-reverse' : '')}>
          <p className="text-sm font-bold text-foreground">لوحة المؤجر</p>
          <Button size="sm" variant="ghost" className="text-primary h-7 gap-1 text-xs" onClick={() => navigate('/my-products')}>
            إدارة منتجاتي {isRTL ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
          </Button>
        </div>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {items.map(({ label, value, icon: Icon, accent }) => (
            <div key={label} className="flex flex-col items-center gap-1 py-2">
              <Icon size={16} className={accent ? 'text-primary' : 'text-muted-foreground'} />
              <p className={cn('text-base font-bold', accent ? 'text-primary' : 'text-foreground')}>{value}</p>
              <p className="text-xs text-muted-foreground text-center text-pretty">{label}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ── لوحة المستأجر ── */
function RenterDashboard() {
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const { getRenterStats } = useData();
  const navigate = useNavigate();
  if (!user) return null;
  const stats = getRenterStats(user.id);
  const items = [
    { label: 'إجمالي الطلبات', value: stats.totalOrders, icon: Package },
    { label: 'إيجارات مكتملة', value: stats.totalRentals, icon: Star },
    { label: 'إجمالي المصاريف', value: stats.totalExpenses.toLocaleString() + ' دج', icon: Wallet },
    { label: 'ضمانات مجمدة', value: stats.frozenDeposits.toLocaleString() + ' دج', icon: ShieldCheck, accent: true },
  ];
  return (
    <Card className="border-border">
      <CardContent className="pt-4 pb-4">
        <div className={cn('flex items-center justify-between mb-3', isRTL ? 'flex-row-reverse' : '')}>
          <p className="text-sm font-bold text-foreground">لوحة المستأجر</p>
          <Button size="sm" variant="ghost" className="text-primary h-7 gap-1 text-xs" onClick={() => navigate('/rentals')}>
            طلباتي {isRTL ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
          </Button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {items.map(({ label, value, icon: Icon, accent }) => (
            <div key={label} className="flex flex-col items-center gap-1 py-2">
              <Icon size={16} className={accent ? 'text-amber-500' : 'text-muted-foreground'} />
              <p className={cn('text-base font-bold', accent ? 'text-amber-600' : 'text-foreground')}>{value}</p>
              <p className="text-xs text-muted-foreground text-center text-pretty">{label}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function HomePage() {
  const { t, isRTL, language } = useLanguage();
  const { user } = useAuth();
  const { getTopRated, getMostRented, getNewArrivals, getNearby, productsLoaded } = useData();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState<string | null>(null);

  const topRated = getTopRated(8);
  const mostRented = getMostRented(8);
  const newArrivals = getNewArrivals(8);
  const nearby = user ? getNearby(user.wilayaCode, 6) : [];

  const handleSearch = () => {
    if (search.trim()) navigate(`/explore?q=${encodeURIComponent(search)}`);
  };

  const handleCat = (catId: string) => {
    setSelectedCat(prev => prev === catId ? null : catId);
    navigate(`/explore?cat=${catId}`);
  };

  const getCatName = (cat: typeof CATEGORIES[0]) =>
    language === 'ar' ? cat.ar : language === 'fr' ? cat.fr : cat.en;

  return (
    <AppLayout>
      <div className="space-y-8" dir={isRTL ? 'rtl' : 'ltr'}>
        {/* Hero search */}
        <div className="bg-primary rounded-2xl p-6 text-primary-foreground">
          <h1 className="text-xl font-bold mb-1 text-balance">MOSTAJIR</h1>
          <p className="text-sm text-primary-foreground/80 mb-4 text-pretty">منصة التأجير الشاملة</p>
          <SearchBar value={search} onChange={setSearch} onSearch={handleSearch} showFilter onFilter={() => navigate('/explore')} />
        </div>

        {/* ── لوحات الإحصاء للمستخدم المسجل ── */}
        {user && !user.isAdmin && (
          <div className="space-y-3">
            <OwnerDashboard />
            <RenterDashboard />
          </div>
        )}

        {/* Admin quick link */}
        {user?.isAdmin && (
          <Card className="border-primary/30 bg-primary/5 cursor-pointer" onClick={() => navigate('/admin')}>
            <CardContent className="py-4 px-4">
              <div className={cn('flex items-center justify-between', isRTL ? 'flex-row-reverse' : '')}>
                <div className={cn('flex items-center gap-3', isRTL ? 'flex-row-reverse' : '')}>
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                    <ArrowUpCircle size={18} className="text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-sm">لوحة الإدارة</p>
                    <p className="text-xs text-muted-foreground">إدارة المنصة والمستخدمين</p>
                  </div>
                </div>
                {isRTL ? <ChevronLeft size={18} className="text-muted-foreground" /> : <ChevronRight size={18} className="text-muted-foreground" />}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Categories */}
        <div>
          <h2 className={cn('text-base font-bold mb-3 text-balance', isRTL ? 'text-right' : '')}>{t('categories')}</h2>
          <div className={cn('flex gap-2 overflow-x-auto pb-2', isRTL ? 'flex-row-reverse' : '')} style={{ scrollbarWidth: 'none' }}>
            <Badge
              variant={!selectedCat ? 'default' : 'outline'}
              className="cursor-pointer whitespace-nowrap shrink-0 py-1.5 px-3 text-xs"
              onClick={() => setSelectedCat(null)}
            >
              {t('all')}
            </Badge>
            {CATEGORIES.map(cat => (
              <Badge
                key={cat.id}
                variant={selectedCat === cat.id ? 'default' : 'outline'}
                className="cursor-pointer whitespace-nowrap shrink-0 py-1.5 px-3 text-xs gap-1"
                onClick={() => handleCat(cat.id)}
              >
                <span>{cat.icon}</span>
                <span>{getCatName(cat)}</span>
              </Badge>
            ))}
          </div>
        </div>

        {/* Top Rated */}
        <div>
          <SectionHeader title={t('topRated')} onSeeAll={() => navigate('/explore?sort=rating')} isRTL={isRTL} />
          {!productsLoaded ? <ProductRowSkeleton /> : <ProductRow products={topRated} />}
        </div>

        {/* Most Rented */}
        <div>
          <SectionHeader title={t('mostRented')} onSeeAll={() => navigate('/explore?sort=rentals')} isRTL={isRTL} />
          {!productsLoaded ? <ProductRowSkeleton /> : <ProductRow products={mostRented} />}
        </div>

        {/* New Arrivals */}
        <div>
          <SectionHeader title={t('newArrivals')} onSeeAll={() => navigate('/explore?sort=newest')} isRTL={isRTL} />
          {!productsLoaded ? <ProductRowSkeleton /> : <ProductRow products={newArrivals.slice(0, 4)} />}
        </div>

        {/* Nearby */}
        {productsLoaded && nearby.length > 0 && (
          <div>
            <SectionHeader title={t('nearbyProducts')} isRTL={isRTL} />
            <ProductRow products={nearby} />
          </div>
        )}
      </div>
    </AppLayout>
  );
}
