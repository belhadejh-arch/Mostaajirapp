
-- ═══════════════════════════════════════════════
-- دوال المساعدة للـ RLS
-- ═══════════════════════════════════════════════

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT COALESCE((SELECT is_admin FROM public.profiles WHERE id = auth.uid()), false);
$$;

CREATE OR REPLACE FUNCTION is_authenticated()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT auth.uid() IS NOT NULL;
$$;

-- ═══════════════════════════════════════════════
-- RLS على جدول profiles
-- ═══════════════════════════════════════════════
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_all" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;

CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT TO authenticated USING (id = auth.uid() OR is_admin());

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid() OR is_admin());

CREATE POLICY "profiles_admin_all" ON public.profiles
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ═══════════════════════════════════════════════
-- RLS على جدول products
-- ═══════════════════════════════════════════════
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "products_select_public" ON public.products;
DROP POLICY IF EXISTS "products_insert_owner" ON public.products;
DROP POLICY IF EXISTS "products_update_owner" ON public.products;
DROP POLICY IF EXISTS "products_delete_owner" ON public.products;
DROP POLICY IF EXISTS "products_admin_all" ON public.products;

CREATE POLICY "products_select_public" ON public.products
  FOR SELECT USING (true);

CREATE POLICY "products_insert_owner" ON public.products
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());

CREATE POLICY "products_update_owner" ON public.products
  FOR UPDATE TO authenticated USING (owner_id = auth.uid() OR is_admin());

CREATE POLICY "products_delete_owner" ON public.products
  FOR DELETE TO authenticated USING (owner_id = auth.uid() OR is_admin());

-- ═══════════════════════════════════════════════
-- RLS على جدول rentals
-- ═══════════════════════════════════════════════
ALTER TABLE public.rentals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rentals_select_parties" ON public.rentals;
DROP POLICY IF EXISTS "rentals_insert_renter" ON public.rentals;
DROP POLICY IF EXISTS "rentals_update_parties" ON public.rentals;

CREATE POLICY "rentals_select_parties" ON public.rentals
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR renter_id = auth.uid() OR is_admin());

CREATE POLICY "rentals_insert_renter" ON public.rentals
  FOR INSERT TO authenticated WITH CHECK (renter_id = auth.uid());

CREATE POLICY "rentals_update_parties" ON public.rentals
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR renter_id = auth.uid() OR is_admin());

-- ═══════════════════════════════════════════════
-- RLS على جدول kyc_requests
-- ═══════════════════════════════════════════════
ALTER TABLE public.kyc_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kyc_select_own" ON public.kyc_requests;
DROP POLICY IF EXISTS "kyc_insert_own" ON public.kyc_requests;
DROP POLICY IF EXISTS "kyc_update_admin" ON public.kyc_requests;

CREATE POLICY "kyc_select_own" ON public.kyc_requests
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "kyc_insert_own" ON public.kyc_requests
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "kyc_update_admin" ON public.kyc_requests
  FOR UPDATE TO authenticated USING (is_admin());

-- ═══════════════════════════════════════════════
-- RLS على جدول disputes
-- ═══════════════════════════════════════════════
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "disputes_select_parties" ON public.disputes;
DROP POLICY IF EXISTS "disputes_insert_party" ON public.disputes;
DROP POLICY IF EXISTS "disputes_update_admin" ON public.disputes;

CREATE POLICY "disputes_select_parties" ON public.disputes
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "disputes_insert_party" ON public.disputes
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "disputes_update_admin" ON public.disputes
  FOR UPDATE TO authenticated USING (is_admin());

-- ═══════════════════════════════════════════════
-- RLS على جدول withdrawal_requests
-- ═══════════════════════════════════════════════
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "withdrawals_select_own" ON public.withdrawal_requests;
DROP POLICY IF EXISTS "withdrawals_insert_own" ON public.withdrawal_requests;
DROP POLICY IF EXISTS "withdrawals_update_admin" ON public.withdrawal_requests;

CREATE POLICY "withdrawals_select_own" ON public.withdrawal_requests
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "withdrawals_insert_own" ON public.withdrawal_requests
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "withdrawals_update_admin" ON public.withdrawal_requests
  FOR UPDATE TO authenticated USING (is_admin());

-- ═══════════════════════════════════════════════
-- تفعيل Realtime للجداول الجديدة فقط
-- ═══════════════════════════════════════════════
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'rentals'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.rentals;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'disputes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.disputes;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'withdrawal_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.withdrawal_requests;
  END IF;
END $$;
