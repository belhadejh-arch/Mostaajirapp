
-- جدول معاملات الشحن
CREATE TABLE top_up_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  provider text NOT NULL DEFAULT 'chargily',
  checkout_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE top_up_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "top_up_select_own" ON top_up_transactions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "top_up_insert_admin" ON top_up_transactions FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

ALTER PUBLICATION supabase_realtime ADD TABLE top_up_transactions;
