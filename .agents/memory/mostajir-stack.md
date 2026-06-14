---
name: MOSTAJIR stack
description: Full stack config for the MOSTAJIR Algerian rental platform
---
- Frontend: React+Vite on port 5000 (pnpm dev), src in frontend/src/
- Backend: Express.js on port 3001, src in server/
- DB: Neon PostgreSQL, connected via NEON_DB_URL env var (server/db.js)
- Auth token: localStorage key 'mostajir_token', 401 auto-clears it
- Admin credentials: admin@mostajir.dz / Admin@Mostajir2024!
- Logo: /public/logo.png (served as static, referenced as /logo.png)
- Notifications: polled every 15s via NotificationsContext, all stored in notifications table
