
-- إضافة أعمدة مراجعة المنتجات
ALTER TABLE products ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'pending';
ALTER TABLE products ADD COLUMN IF NOT EXISTS rejection_reason text;

-- جدول الإشعارات
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  type text NOT NULL DEFAULT 'general',
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- تفعيل RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- سياسات RLS للإشعارات
CREATE POLICY "notifications_select_own" ON notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "notifications_insert_admin" ON notifications FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "notifications_update_own" ON notifications FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "notifications_delete_own" ON notifications FOR DELETE
  USING (user_id = auth.uid());

-- تفعيل Realtime للإشعارات
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
