
-- جدول تقييمات المؤجرين
CREATE TABLE IF NOT EXISTS owner_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  renter_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rental_id uuid NOT NULL,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (rental_id, renter_id)
);

ALTER TABLE owner_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_ratings_select" ON owner_ratings FOR SELECT USING (true);
CREATE POLICY "owner_ratings_insert" ON owner_ratings FOR INSERT WITH CHECK (auth.uid() = renter_id);

-- حقل لتتبع إرسال إشعار 24 ساعة
ALTER TABLE rentals ADD COLUMN IF NOT EXISTS alert_48h_sent boolean DEFAULT false;

-- إضافة حقول مالك إلى products إن لم تكن موجودة
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS owner_phone text,
  ADD COLUMN IF NOT EXISTS owner_address text,
  ADD COLUMN IF NOT EXISTS owner_wilaya_code integer,
  ADD COLUMN IF NOT EXISTS owner_wilaya_name text;

-- دالة تحديث متوسط تقييم المؤجر تلقائياً
CREATE OR REPLACE FUNCTION update_owner_rating()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  avg_rating numeric;
  total_count integer;
BEGIN
  SELECT ROUND(AVG(rating)::numeric, 1), COUNT(*)
  INTO avg_rating, total_count
  FROM owner_ratings
  WHERE owner_id = NEW.owner_id;

  UPDATE profiles
  SET owner_rating = avg_rating,
      owner_review_count = total_count
  WHERE id = NEW.owner_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_owner_rating ON owner_ratings;
CREATE TRIGGER trg_update_owner_rating
AFTER INSERT ON owner_ratings
FOR EACH ROW EXECUTE FUNCTION update_owner_rating();

-- إضافة حقلي التقييم إلى profiles إن لم تكن موجودة
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS owner_rating numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS owner_review_count integer DEFAULT 0;
