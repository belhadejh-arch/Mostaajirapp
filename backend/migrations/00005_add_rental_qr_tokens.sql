
-- إضافة توكينات آمنة لمسح QR في جدول الإيجارات
ALTER TABLE rentals ADD COLUMN IF NOT EXISTS handover_token text;
ALTER TABLE rentals ADD COLUMN IF NOT EXISTS return_token text;

-- إنشاء فهرس للبحث السريع بالتوكين
CREATE INDEX IF NOT EXISTS idx_rentals_handover_token ON rentals(handover_token);
CREATE INDEX IF NOT EXISTS idx_rentals_return_token ON rentals(return_token);

-- تحديث الإيجارات الحالية بتوكينات آمنة (للاختبار)
UPDATE rentals SET handover_token = 'HANDOVER-' || id::text WHERE handover_token IS NULL;
UPDATE rentals SET return_token = 'RETURN-' || id::text WHERE return_token IS NULL;
