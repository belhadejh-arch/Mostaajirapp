-- جدول الرسائل بين المستخدمين (مرتبط بعقد الإيجار)
CREATE TABLE IF NOT EXISTS messages (
  id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id   uuid         NOT NULL REFERENCES rentals(id) ON DELETE CASCADE,
  sender_id   uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content     text         NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  read        boolean      NOT NULL DEFAULT false,
  created_at  timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS messages_rental_id_idx   ON messages(rental_id, created_at);
CREATE INDEX IF NOT EXISTS messages_receiver_id_idx ON messages(receiver_id) WHERE read = false;

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- المستخدم يرى الرسائل التي أرسلها أو استقبلها
CREATE POLICY "messages_select" ON messages
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- المستخدم يرسل باسمه فقط
CREATE POLICY "messages_insert" ON messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- المستلم يمكنه تحديث حالة القراءة
CREATE POLICY "messages_update_read" ON messages
  FOR UPDATE USING (auth.uid() = receiver_id)
  WITH CHECK (auth.uid() = receiver_id);

-- تمكين Realtime على هذا الجدول
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
