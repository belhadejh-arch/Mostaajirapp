import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Star, Package, CheckCircle, ChevronRight, Phone, MapPin, ShieldCheck, ArrowRight } from 'lucide-react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ProductCard } from '@/components/ProductCard';
import { api } from '@/api/client';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import type { Product } from '@/types';

interface OwnerProfile {
  id: string;
  name: string;
  owner_avatar_uri?: string;
  owner_wilaya_name?: string;
  owner_wilaya_code?: number;
  verification_status?: string;
  owner_rating?: number;
  owner_review_count?: number;
  total_rentals?: number;
  created_at?: string;
}

interface RatingRow {
  rating: number;
  comment?: string;
  created_at: string;
  renter_name?: string;
}

function StarRating({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(star => (
        <Star
          key={star}
          size={size}
          className={star <= Math.round(value) ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/40'}
        />
      ))}
    </div>
  );
}

export default function OwnerProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isRTL } = useLanguage();

  const [profile, setProfile] = useState<OwnerProfile | null>(null);
  const [ratings, setRatings] = useState<RatingRow[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [completedRentals, setCompletedRentals] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      api.get<{ profile: OwnerProfile; ratings: RatingRow[]; completedRentals: number }>(`/api/admin/public-profile/${id}`).catch(() => null),
      api.get<Record<string, unknown>[]>(`/api/products/public/${id}`).catch(() => []),
    ]).then(([profileData, productsData]) => {
      if (profileData) {
        setProfile(profileData.profile);
        setRatings(profileData.ratings || []);
        setCompletedRentals(profileData.completedRentals || 0);
      } else {
        setError('لم يتم العثور على الملف الشخصي');
      }
      setProducts((productsData || []).map((row) => ({
        id: row.id as string,
        title: (row.title as string) || '',
        description: (row.description as string) || '',
        images: Array.isArray(row.images) ? (row.images as string[]) : [],
        categoryId: (row.category_id as string) || '',
        subcategoryId: (row.subcategory_id as string) || '',
        wilayaCode: (row.wilaya_code as number) || 16,
        wilayaName: (row.wilaya_name as string) || '',
        purchasePrice: (row.purchase_price as number) || 0,
        purchaseYear: (row.purchase_year as number) || 2020,
        rentalPrice: (row.rental_price as number) || 0,
        deposit: (row.deposit as number) || 0,
        commissionRate: (row.commission_rate as number) || 10,
        deliveryAvailable: (row.delivery_available as boolean) || false,
        status: (row.status as Product['status']) || 'available',
        stockQuantity: (row.stock_quantity as number) || 1,
        availableQuantity: (row.available_quantity as number) || 1,
        isHidden: false,
        isFrozen: false,
        reviewStatus: 'approved' as const,
        ownerId: id,
        ownerName: (row.owner_name as string) || '',
        ownerAvatarUri: row.owner_avatar_uri as string | undefined,
        ownerRating: (row.owner_rating as number) || 0,
        ownerReviewCount: (row.owner_review_count as number) || 0,
        ownerTotalRentals: (row.owner_total_rentals as number) || 0,
        totalRentals: (row.total_rentals as number) || 0,
        rating: (row.rating as number) || 0,
        reviewCount: (row.review_count as number) || 0,
        createdAt: (row.created_at as string) || new Date().toISOString(),
      })));
    }).finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <AppLayout>
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    </AppLayout>
  );

  if (error || !profile) return (
    <AppLayout>
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-muted-foreground">
        <Package size={48} className="opacity-40" />
        <p>{error || 'المؤجر غير موجود'}</p>
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowRight size={14} className="mr-1" /> رجوع
        </Button>
      </div>
    </AppLayout>
  );

  const avgRating = profile.owner_rating || 0;
  const reviewCount = profile.owner_review_count || 0;
  const joinDate = profile.created_at ? new Date(profile.created_at).toLocaleDateString('ar-DZ', { year: 'numeric', month: 'long' }) : '';

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
        {/* ── الرأس ── */}
        <Card className="overflow-hidden">
          <div className="h-20 bg-gradient-to-r from-primary/20 to-primary/5" />
          <CardContent className="pt-0 pb-5 px-4">
            <div className={cn('flex items-end gap-4 -mt-8', isRTL ? 'flex-row-reverse' : '')}>
              <div className="w-16 h-16 rounded-2xl border-4 border-background bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
                {profile.owner_avatar_uri ? (
                  <img src={profile.owner_avatar_uri} alt={profile.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl font-bold text-primary">{profile.name?.[0] || '؟'}</span>
                )}
              </div>
              <div className="flex-1 min-w-0 pb-1">
                <div className={cn('flex items-center gap-2 flex-wrap', isRTL ? 'flex-row-reverse' : '')}>
                  <h1 className="text-lg font-bold truncate">{profile.name}</h1>
                  {profile.verification_status === 'verified' && (
                    <Badge className="bg-blue-500/10 text-blue-700 border-blue-300 text-xs gap-1">
                      <ShieldCheck size={10} /> موثق
                    </Badge>
                  )}
                </div>
                {profile.owner_wilaya_name && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <MapPin size={11} />
                    {profile.owner_wilaya_name}
                  </p>
                )}
              </div>
            </div>

            {/* إحصاءات سريعة */}
            <div className="grid grid-cols-3 gap-3 mt-4">
              <div className="text-center py-3 bg-muted/50 rounded-xl">
                <p className="text-lg font-bold text-primary">{avgRating.toFixed(1)}</p>
                <StarRating value={avgRating} size={12} />
                <p className="text-xs text-muted-foreground mt-1">{reviewCount} تقييم</p>
              </div>
              <div className="text-center py-3 bg-muted/50 rounded-xl">
                <p className="text-lg font-bold">{completedRentals}</p>
                <p className="text-xs text-muted-foreground mt-1">تأجير مكتمل</p>
              </div>
              <div className="text-center py-3 bg-muted/50 rounded-xl">
                <p className="text-lg font-bold">{products.length}</p>
                <p className="text-xs text-muted-foreground mt-1">منتجات نشطة</p>
              </div>
            </div>

            {joinDate && (
              <p className="text-xs text-muted-foreground mt-3">
                عضو منذ {joinDate}
              </p>
            )}
          </CardContent>
        </Card>

        {/* ── منتجات المؤجر ── */}
        {products.length > 0 && (
          <div>
            <h2 className="text-base font-bold mb-3">منتجات المؤجر ({products.length})</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {products.map(p => <ProductCard key={p.id} product={p} />)}
            </div>
          </div>
        )}

        {/* ── التقييمات ── */}
        {ratings.length > 0 && (
          <div>
            <h2 className="text-base font-bold mb-3 flex items-center gap-2">
              <Star size={16} className="text-yellow-500" />
              تقييمات المستأجرين ({ratings.length})
            </h2>
            <div className="space-y-3">
              {ratings.map((r, i) => (
                <Card key={i}>
                  <CardContent className="pt-4 pb-4">
                    <div className={cn('flex items-start justify-between gap-3', isRTL ? 'flex-row-reverse' : '')}>
                      <div className="flex-1 min-w-0">
                        <div className={cn('flex items-center gap-2 mb-1', isRTL ? 'flex-row-reverse' : '')}>
                          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-primary">{r.renter_name?.[0] || '؟'}</span>
                          </div>
                          <p className="text-sm font-medium">{r.renter_name || 'مستأجر'}</p>
                          <StarRating value={r.rating} size={12} />
                        </div>
                        {r.comment && (
                          <p className="text-sm text-muted-foreground text-pretty">{r.comment}</p>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground shrink-0">
                        {new Date(r.created_at).toLocaleDateString('ar-DZ', { dateStyle: 'short' })}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {products.length === 0 && ratings.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Package size={40} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">لا توجد منتجات أو تقييمات بعد</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
