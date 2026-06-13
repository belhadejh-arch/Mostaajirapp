
-- ── جدول الملفات الشخصية (يمتد على auth.users) ──
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  wilaya_code integer NOT NULL DEFAULT 16,
  wilaya_name text NOT NULL DEFAULT 'الجزائر',
  verification_status text NOT NULL DEFAULT 'none'
    CHECK (verification_status IN ('none','pending','verified','rejected')),
  account_status text NOT NULL DEFAULT 'active'
    CHECK (account_status IN ('active','banned','frozen')),
  wallet_balance numeric NOT NULL DEFAULT 0,
  earnings_balance numeric NOT NULL DEFAULT 0,
  frozen_balance numeric NOT NULL DEFAULT 0,
  total_rentals integer NOT NULL DEFAULT 0,
  rating numeric NOT NULL DEFAULT 0,
  review_count integer NOT NULL DEFAULT 0,
  is_admin boolean NOT NULL DEFAULT false,
  avatar_uri text,
  kyc_rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── جدول طلبات التوثيق ──
CREATE TABLE public.kyc_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_name text NOT NULL,
  user_email text NOT NULL,
  user_phone text NOT NULL,
  id_front_uri text NOT NULL,
  id_back_uri text NOT NULL,
  selfie_uri text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected')),
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);

-- ── جدول المنتجات ──
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  owner_name text NOT NULL,
  owner_avatar_uri text,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  images text[] NOT NULL DEFAULT '{}',
  video_uri text,
  category_id text NOT NULL,
  subcategory_id text NOT NULL DEFAULT '',
  wilaya_code integer NOT NULL,
  wilaya_name text NOT NULL,
  purchase_price numeric NOT NULL,
  purchase_year integer NOT NULL DEFAULT 2020,
  rental_price numeric NOT NULL,
  deposit numeric NOT NULL DEFAULT 0,
  commission_rate numeric NOT NULL DEFAULT 10,
  delivery_available boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available','rented')),
  stock_quantity integer NOT NULL DEFAULT 1,
  available_quantity integer NOT NULL DEFAULT 1,
  is_hidden boolean NOT NULL DEFAULT false,
  is_frozen boolean NOT NULL DEFAULT false,
  removal_reason text,
  owner_rating numeric NOT NULL DEFAULT 0,
  owner_review_count integer NOT NULL DEFAULT 0,
  owner_total_rentals integer NOT NULL DEFAULT 0,
  total_rentals integer NOT NULL DEFAULT 0,
  rating numeric NOT NULL DEFAULT 0,
  review_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── جدول طلبات السحب ──
CREATE TABLE public.withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_name text NOT NULL,
  phone text NOT NULL,
  ccp_number text NOT NULL,
  amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processed','rejected')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── جدول الإيجارات ──
CREATE TABLE public.rentals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_title text NOT NULL,
  product_image text,
  owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  owner_name text NOT NULL,
  renter_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  renter_name text NOT NULL,
  renter_phone text NOT NULL,
  renter_address text NOT NULL DEFAULT '',
  renter_wilaya text NOT NULL DEFAULT '',
  self_pickup boolean NOT NULL DEFAULT false,
  start_time timestamptz,
  end_time timestamptz,
  duration_days integer NOT NULL DEFAULT 1,
  daily_rate numeric NOT NULL DEFAULT 0,
  deposit numeric NOT NULL DEFAULT 0,
  commission_amount numeric NOT NULL DEFAULT 0,
  net_earnings numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  escrow_amount numeric NOT NULL DEFAULT 0,
  late_penalty numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending_owner'
    CHECK (status IN ('pending_owner','accepted','pending_delivery','active','completed','cancelled','extend_requested')),
  qr_code_delivery text NOT NULL DEFAULT '',
  qr_code_return text NOT NULL DEFAULT '',
  extension_requested boolean NOT NULL DEFAULT false,
  extension_days integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── جدول النزاعات ──
CREATE TABLE public.disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id uuid REFERENCES public.rentals(id) ON DELETE SET NULL,
  product_title text NOT NULL,
  filed_by text NOT NULL CHECK (filed_by IN ('owner','renter')),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  user_name text NOT NULL,
  user_phone text NOT NULL,
  other_party_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  other_party_name text,
  other_party_phone text,
  title text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','under_review','resolved','rejected')),
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

-- ── دالة مساعدة: هل المستخدم أدمن ──
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT COALESCE((SELECT is_admin FROM public.profiles WHERE id = auth.uid()), false)
$$;

-- ── دالة مساعدة: مالك المورد ──
CREATE OR REPLACE FUNCTION public.is_owner(owner_col uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT auth.uid() = owner_col
$$;

-- ── تفعيل RLS ──
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyc_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rentals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

-- ── سياسات profiles ──
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin());
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_admin());
CREATE POLICY "profiles_admin_all" ON public.profiles FOR ALL TO authenticated
  USING (public.is_admin());

-- ── سياسات kyc_requests ──
CREATE POLICY "kyc_select" ON public.kyc_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "kyc_insert_own" ON public.kyc_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "kyc_update_admin" ON public.kyc_requests FOR UPDATE TO authenticated
  USING (public.is_admin());

-- ── سياسات products ──
CREATE POLICY "products_select_all" ON public.products FOR SELECT
  USING (true);
CREATE POLICY "products_insert_owner" ON public.products FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "products_update_owner_or_admin" ON public.products FOR UPDATE TO authenticated
  USING (public.is_owner(owner_id) OR public.is_admin());
CREATE POLICY "products_delete_owner_or_admin" ON public.products FOR DELETE TO authenticated
  USING (public.is_owner(owner_id) OR public.is_admin());

-- ── سياسات withdrawal_requests ──
CREATE POLICY "wr_select" ON public.withdrawal_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "wr_insert_own" ON public.withdrawal_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "wr_update_admin" ON public.withdrawal_requests FOR UPDATE TO authenticated
  USING (public.is_admin());

-- ── سياسات rentals ──
CREATE POLICY "rentals_select" ON public.rentals FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR renter_id = auth.uid() OR public.is_admin());
CREATE POLICY "rentals_insert" ON public.rentals FOR INSERT TO authenticated
  WITH CHECK (renter_id = auth.uid());
CREATE POLICY "rentals_update" ON public.rentals FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR renter_id = auth.uid() OR public.is_admin());

-- ── سياسات disputes ──
CREATE POLICY "disputes_select" ON public.disputes FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR other_party_id = auth.uid() OR public.is_admin());
CREATE POLICY "disputes_insert" ON public.disputes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "disputes_update_admin" ON public.disputes FOR UPDATE TO authenticated
  USING (public.is_admin());

-- ── Trigger: إنشاء profile عند تسجيل مستخدم جديد ──
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles(id, name, phone, wilaya_code, wilaya_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE((NEW.raw_user_meta_data->>'wilaya_code')::integer, 16),
    COALESCE(NEW.raw_user_meta_data->>'wilaya_name', 'الجزائر')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── تفعيل Realtime ──
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.kyc_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rentals;

-- ── Storage: bucket لوثائق التوثيق ──
INSERT INTO storage.buckets(id, name, public) VALUES ('kyc-docs', 'kyc-docs', false);
INSERT INTO storage.buckets(id, name, public) VALUES ('avatars', 'avatars', true);
INSERT INTO storage.buckets(id, name, public) VALUES ('products', 'products', true);

-- ── سياسات Storage ──
CREATE POLICY "kyc_upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'kyc-docs' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "kyc_read_own_or_admin" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'kyc-docs' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin()));
CREATE POLICY "avatars_public" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "avatars_upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "products_public" ON storage.objects FOR SELECT USING (bucket_id = 'products');
CREATE POLICY "products_upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'products');
