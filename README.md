# 🏠 MOSTAJIR — دليل النشر الكامل للإنتاج

منصة تأجير **MOSTAJIR** مبنية باستخدام:
- **Frontend:** React + Vite + Tailwind CSS + shadcn/ui
- **Backend:** Supabase (PostgreSQL + Edge Functions + Auth + Storage + Realtime)
- **الدفع:** Chargily Pay (دفع إلكتروني جزائري)

---

## 🗂️ هيكل المشروع

```
MOSTAJIR_Production/
├── frontend/           ← كود الواجهة الأمامية (React)
│   ├── src/
│   ├── public/
│   ├── index.html
│   ├── vite.config.ts  ← إعداد البناء الإنتاجي
│   ├── vercel.json     ← إعداد Vercel (SPA routing)
│   ├── .env.example    ← نموذج متغيرات البيئة
│   ├── package.json
│   └── ...
└── backend/            ← كود الباكاند (Supabase)
    ├── functions/      ← Edge Functions (Deno)
    │   ├── chargily-create-checkout/
    │   ├── chargily-webhook/
    │   ├── rental-handover-scan/
    │   ├── rental-return-scan/
    │   └── rental-24h-notify/
    ├── migrations/     ← SQL migrations (قاعدة البيانات)
    └── .env.example    ← متغيرات Supabase Secrets
```

---

## 🚀 خطوات النشر

### الخطوة 1: إعداد Supabase

1. سجّل في [supabase.com](https://supabase.com) وأنشئ مشروعاً جديداً
2. **قاعدة البيانات:** شغّل ملفات الـ migration بالترتيب:
   ```bash
   # من لوحة Supabase → SQL Editor
   # الصق محتوى كل ملف بالترتيب من مجلد backend/migrations/
   00001_create_mostajir_schema.sql
   00002_admin_rls_policies_v2.sql
   00003_add_notifications_product_review.sql
   00004_add_top_up_transactions.sql
   00005_add_rental_qr_tokens.sql
   00006_add_owner_ratings_and_alert_flag.sql
   ```
3. **Edge Functions:** استخدم Supabase CLI لنشر الدوال:
   ```bash
   npm install -g supabase
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   supabase functions deploy chargily-create-checkout
   supabase functions deploy chargily-webhook
   supabase functions deploy rental-handover-scan
   supabase functions deploy rental-return-scan
   supabase functions deploy rental-24h-notify
   ```
4. **Secrets (متغيرات الباكاند):**
   ```bash
   supabase secrets set CHARGILY_SECRET_KEY=your_key_here
   ```
   أو من: Supabase Dashboard → Project Settings → Edge Functions → Secrets

5. **Storage:** أنشئ bucket باسم `product-images` من:
   Supabase Dashboard → Storage → New Bucket → `product-images` → Public

---

### الخطوة 2: نشر الفرونتند على Vercel

1. سجّل في [vercel.com](https://vercel.com)
2. اضغط **Add New Project** → **Import** → ارفع مجلد `frontend/`
   - أو ارفعه على GitHub أولاً ثم اربطه بـ Vercel
3. **إعدادات البناء في Vercel:**
   ```
   Framework Preset: Vite
   Build Command: npm run build
   Output Directory: dist
   Install Command: npm install
   ```
4. **متغيرات البيئة** (Settings → Environment Variables):
   ```
   VITE_SUPABASE_URL = https://YOUR_PROJECT_REF.supabase.co
   VITE_SUPABASE_ANON_KEY = your_anon_key_here
   ```
   احصل عليهما من: Supabase Dashboard → Settings → API

5. اضغط **Deploy** ✅

---

### الخطوة 3: إعداد Chargily Pay

1. سجّل في [chargily.com](https://chargily.com)
2. من لوحة التحكم احصل على **Secret Key**
3. في Supabase Secrets:
   ```bash
   supabase secrets set CHARGILY_SECRET_KEY=ck_live_xxxxx
   ```
4. في إعدادات Chargily، أضف **Webhook URL**:
   ```
   https://YOUR_PROJECT_REF.supabase.co/functions/v1/chargily-webhook
   ```

---

### الخطوة 4: إعداد حساب الأدمن

1. سجّل في التطبيق بأي بريد إلكتروني
2. من Supabase → Table Editor → `profiles`
3. ابحث عن سجلك وغيّر حقل `role` إلى `admin`

---

## 🔒 ملاحظات أمنية

- ❌ **لا تضع** قيم `.env` الحقيقية في الكود أو GitHub
- ✅ **استخدم دائماً** متغيرات البيئة على Vercel و Supabase Secrets
- ✅ **CORS:** Edge Functions تقبل طلبات من أي أصل (`*`) — يمكن تضييقه لاحقاً لـ domain محدد
- ✅ **RLS:** جميع جداول قاعدة البيانات محمية بـ Row Level Security

---

## 📞 المتغيرات المطلوبة — ملخص

| المتغير | أين يوضع | كيف تحصل عليه |
|---------|----------|----------------|
| `VITE_SUPABASE_URL` | Vercel Env Vars | Supabase → Settings → API |
| `VITE_SUPABASE_ANON_KEY` | Vercel Env Vars | Supabase → Settings → API |
| `CHARGILY_SECRET_KEY` | Supabase Secrets | chargily.com → Dashboard |

---

## ⚠️ ملاحظة مهمة حول البنية

هذا المشروع **لا يستخدم Neon PostgreSQL ولا Render** — يستخدم **Supabase** كباكاند متكامل يتضمن:
- PostgreSQL مُدار
- Edge Functions (بديل Express/Node.js)
- Auth
- Storage
- Realtime

لذلك **لا حاجة لـ Render** — الباكاند كله على Supabase.

---

*تم بناء المشروع بـ MOSTAJIR v35 — 2026*
