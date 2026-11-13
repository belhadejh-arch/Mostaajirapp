# MOSTAJIR

منصة تأجير مبنية بواجهة React وVite وخادم API مستقل بـ Express وقاعدة PostgreSQL.

## نشر الواجهة على Netlify

ملف `netlify.toml` مضبوط للبناء من مجلد `frontend`، ونشر `dist`، وإعادة توجيه مسارات React إلى `index.html`.

### الإعداد في Netlify

اربط مستودع GitHub بالموقع. تُقرأ إعدادات البناء من `netlify.toml`:

| الإعداد | القيمة |
| --- | --- |
| Base directory | `frontend` |
| Build command | `pnpm run build` |
| Publish directory | `dist` |
| Node.js | `20` |

أضف متغير البيئة التالي في إعدادات الموقع قبل البناء:

| المتغير | القيمة |
| --- | --- |
| `VITE_API_URL` | عنوان خادم Express المنشور، مثل `https://api.example.com`، من دون `/` في النهاية |
| `VITE_APP_DOMAIN` | رابط الموقع المنشور على Netlify أو نطاقك الخاص |

تُضمّن متغيرات `VITE_` في ملفات الواجهة أثناء البناء؛ لا تضع فيها كلمات مرور أو مفاتيح سرية.

### أوامر التطوير والبناء محليًا

من جذر المشروع:

```bash
cd frontend
pnpm install --frozen-lockfile
pnpm run dev -- --host 0.0.0.0 --port 5000
```

لإنشاء نسخة الإنتاج والتحقق منها:

```bash
cd frontend
pnpm install --frozen-lockfile
pnpm run build
pnpm run preview -- --host 0.0.0.0
```

نجاح `pnpm run build` يعني أن ملفات الموقع أُنشئت في `frontend/dist`. وفي Netlify تكون الأوامر المكافئة هي:

```bash
pnpm install --frozen-lockfile
pnpm run build
```

مع مجلد البناء الأساسي `frontend` ومجلد النشر `dist`.

## خادم API وقاعدة البيانات

Netlify ينشر الواجهة الثابتة فقط؛ لا يشغّل خادم Express هذا كخدمة دائمة. انشر مجلد `server` على استضافة تدعم Node.js، وأعد توجيه `VITE_API_URL` إلى عنوانه. يحتاج الخادم إلى قاعدة PostgreSQL مضبوطة عبر `DATABASE_URL` أو `NEON_DB_URL`، وإلى سر JWT عبر `JWT_SECRET` أو `SESSION_SECRET`.

في إعدادات الخادم، أضف عنوان موقع Netlify والنطاق الخاص، إن وجد، إلى `ALLOWED_ORIGINS` مفصولين بفواصل، مثل:

```text
https://your-site.netlify.app,https://mostajir.dz
```

للرفع في الإنتاج، اضبط متغيرات Cloudinary (`CLOUDINARY_CLOUD_NAME` و`CLOUDINARY_API_KEY` و`CLOUDINARY_API_SECRET`). من دونها يحفظ الخادم الملفات محليًا، وقد لا تبقى متاحة بعد إعادة تشغيل أو نقل الخادم.

ابدأ الخادم محليًا في طرفية منفصلة:

```bash
cd server
npm ci
npm start
```

في التطوير المحلي، تقدر الواجهة على `http://localhost:5000` على استخدام وسيط Vite إلى الخادم المحلي على المنفذ `3001`. لتجربة واجهة منشورة على Netlify، يجب أن يكون خادم API متاحًا على الإنترنت وأن يسمح بعنوان الموقع عبر `ALLOWED_ORIGINS`.
