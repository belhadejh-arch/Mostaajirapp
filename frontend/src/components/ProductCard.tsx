import React from 'react';
import { Link } from 'react-router-dom';
import { Star, MapPin } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useLanguage } from '@/contexts/LanguageContext';
import type { Product } from '@/types';
import { cn } from '@/lib/utils';

interface ProductCardProps {
  product: Product;
  className?: string;
}

export function ProductCard({ product, className }: ProductCardProps) {
  const { t, isRTL } = useLanguage();

  return (
    <Link to={`/product/${product.id}`}>
      <Card className={cn('h-full flex flex-col hover:shadow-md transition-shadow cursor-pointer overflow-hidden', className)}>
        <div className="aspect-[4/3] w-full overflow-hidden bg-muted relative">
          {product.images[0] ? (
            <img src={product.images[0]} alt={product.title}
              className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-4xl bg-muted">📦</div>
          )}
          <Badge
            className={cn(
              'absolute top-2 text-xs font-semibold',
              isRTL ? 'left-2' : 'right-2',
              product.status === 'available'
                ? 'bg-green-100 text-green-800 border-green-200'
                : 'bg-orange-100 text-orange-800 border-orange-200'
            )}
            variant="outline"
          >
            {product.status === 'available' ? t('available') : t('rented')}
          </Badge>
        </div>
        <CardContent className="flex-1 flex flex-col p-3 gap-2">
          <p className={cn('text-sm font-semibold text-foreground line-clamp-2 text-balance', isRTL ? 'text-right' : '')}>{product.title}</p>
          <div className={cn('flex items-center gap-1 text-xs text-muted-foreground', isRTL ? 'flex-row-reverse justify-end' : '')}>
            <MapPin size={11} className="shrink-0" />
            <span className="truncate">{product.wilayaName}</span>
          </div>
          <div className="mt-auto flex items-center justify-between gap-2">
            <span className="text-primary font-bold text-sm whitespace-nowrap">
              {product.rentalPrice.toLocaleString()} {t('dz')}
              <span className="text-xs font-normal text-muted-foreground"> {t('perDay')}</span>
            </span>
            {product.ownerRating > 0 && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                <Star size={11} className="fill-yellow-400 text-yellow-400" />
                {product.ownerRating.toFixed(1)}
                <span className="text-[10px]">({product.ownerTotalRentals})</span>
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export function ProductCardSkeleton() {
  return (
    <Card className="h-full overflow-hidden">
      <Skeleton className="aspect-[4/3] w-full bg-muted" />
      <CardContent className="p-3 space-y-2">
        <Skeleton className="h-4 w-3/4 bg-muted" />
        <Skeleton className="h-3 w-1/2 bg-muted" />
        <Skeleton className="h-4 w-1/3 bg-muted" />
      </CardContent>
    </Card>
  );
}
