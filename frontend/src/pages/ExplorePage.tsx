import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ProductCard } from '@/components/ProductCard';
import { SearchBar } from '@/components/SearchBar';
import { AppLayout } from '@/components/layouts/AppLayout';
import { useData } from '@/contexts/DataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { CATEGORIES } from '@/constants/categories';
import { WILAYAS } from '@/constants/wilayas';
import { cn } from '@/lib/utils';
import type { Product } from '@/types';

export default function ExplorePage() {
  const { t, isRTL, language } = useLanguage();
  const { products } = useData();
  const [searchParams] = useSearchParams();

  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [category, setCategory] = useState(searchParams.get('cat') || 'all');
  const [wilaya, setWilaya] = useState('all');
  const [sort, setSort] = useState(searchParams.get('sort') || 'newest');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);

  const getCatName = (cat: typeof CATEGORIES[0]) =>
    language === 'ar' ? cat.ar : language === 'fr' ? cat.fr : cat.en;

  const filtered = useMemo(() => {
    let list: Product[] = [...products];
    if (query.trim()) list = list.filter(p => p.title.toLowerCase().includes(query.toLowerCase()) || p.description.toLowerCase().includes(query.toLowerCase()));
    if (category && category !== 'all') list = list.filter(p => p.categoryId === category);
    if (wilaya && wilaya !== 'all') list = list.filter(p => p.wilayaCode === Number(wilaya));
    if (minPrice) list = list.filter(p => p.rentalPrice >= Number(minPrice));
    if (maxPrice) list = list.filter(p => p.rentalPrice <= Number(maxPrice));
    switch (sort) {
      case 'rating': list.sort((a, b) => b.rating - a.rating); break;
      case 'rentals': list.sort((a, b) => b.totalRentals - a.totalRentals); break;
      case 'priceLow': list.sort((a, b) => a.rentalPrice - b.rentalPrice); break;
      case 'priceHigh': list.sort((a, b) => b.rentalPrice - a.rentalPrice); break;
      default: list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    return list;
  }, [products, query, category, wilaya, sort, minPrice, maxPrice]);

  const clearFilters = () => { setCategory('all'); setWilaya('all'); setMinPrice(''); setMaxPrice(''); setSort('newest'); };
  const hasFilters = category !== 'all' || wilaya !== 'all' || minPrice || maxPrice;

  const FilterPanel = () => (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label className="text-sm font-medium">{t('category')}</Label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="px-3"><SelectValue placeholder={t('selectCategory')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('all')}</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c.id} value={c.id}>{getCatName(c)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label className="text-sm font-medium">{t('wilaya')}</Label>
        <Select value={wilaya} onValueChange={setWilaya}>
          <SelectTrigger className="px-3"><SelectValue placeholder={t('selectWilaya')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('all')}</SelectItem>
            {WILAYAS.map(w => <SelectItem key={w.code} value={String(w.code)}>{w.ar}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label className="text-sm font-medium">{t('priceRange')}</Label>
        <div className="flex gap-2">
          <Input placeholder={t('minPrice')} value={minPrice} onChange={e => setMinPrice(e.target.value)} type="number" className="px-3" />
          <Input placeholder={t('maxPrice')} value={maxPrice} onChange={e => setMaxPrice(e.target.value)} type="number" className="px-3" />
        </div>
      </div>
      {hasFilters && (
        <Button variant="outline" className="w-full" onClick={clearFilters}>
          <X size={14} className="mr-1" />{t('clearFilters')}
        </Button>
      )}
    </div>
  );

  return (
    <AppLayout>
      <div className="space-y-4" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <SearchBar value={query} onChange={setQuery} showFilter onFilter={() => setFilterOpen(true)} />
          </div>
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="w-40 shrink-0 px-3 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">{t('newest')}</SelectItem>
              <SelectItem value="rating">{t('ratingHighLow')}</SelectItem>
              <SelectItem value="rentals">{t('mostRented')}</SelectItem>
              <SelectItem value="priceLow">{t('priceLowHigh')}</SelectItem>
              <SelectItem value="priceHigh">{t('priceHighLow')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Active filters */}
        {hasFilters && (
          <div className={cn('flex gap-2 flex-wrap', isRTL ? 'flex-row-reverse' : '')}>
            {category !== 'all' && (
              <Badge variant="secondary" className="gap-1 cursor-pointer" onClick={() => setCategory('all')}>
                {getCatName(CATEGORIES.find(c => c.id === category) || CATEGORIES[0])}
                <X size={10} />
              </Badge>
            )}
            {wilaya !== 'all' && (
              <Badge variant="secondary" className="gap-1 cursor-pointer" onClick={() => setWilaya('all')}>
                {WILAYAS.find(w => w.code === Number(wilaya))?.ar}
                <X size={10} />
              </Badge>
            )}
          </div>
        )}

        <div className="flex gap-6">
          {/* Desktop filter sidebar */}
          <aside className="hidden md:block w-56 shrink-0">
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="font-semibold text-sm mb-4">{t('applyFilters')}</p>
              <FilterPanel />
            </div>
          </aside>

          {/* Results */}
          <div className="flex-1 min-w-0">
            <p className={cn('text-sm text-muted-foreground mb-4', isRTL ? 'text-right' : '')}>
              {filtered.length} {language === 'ar' ? 'منتج' : language === 'fr' ? 'produits' : 'products'}
            </p>
            {filtered.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground">
                <p className="text-4xl mb-3">🔍</p>
                <p className="font-medium">{t('noResults')}</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filtered.map(p => <ProductCard key={p.id} product={p} />)}
              </div>
            )}
          </div>
        </div>

        {/* Mobile filter sheet */}
        <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
          <SheetContent side={isRTL ? 'right' : 'left'} className="max-w-[calc(100%-2rem)] md:max-w-sm">
            <SheetHeader>
              <SheetTitle>{t('applyFilters')}</SheetTitle>
            </SheetHeader>
            <div className="mt-4"><FilterPanel /></div>
            <div className="mt-6">
              <Button className="w-full" onClick={() => setFilterOpen(false)}>{t('applyFilters')}</Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </AppLayout>
  );
}
