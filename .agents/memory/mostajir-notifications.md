---
name: Notification pattern
description: How to send notifications in MOSTAJIR
---
All notifications are sent server-side via direct INSERT into the notifications table.
Never send notifications from the frontend via api.post('/notifications').

**Why:** Keeps notification logic atomic with the main transaction (e.g., rental creation + notification in one DB transaction).

**How to apply:** In any Express route that needs to notify, use:
  await client.query(`INSERT INTO notifications (user_id, title, body, type) VALUES ($1,$2,$3,$4)`, [...])
Supported types: 'general' | 'rental' | 'kyc' | 'product' | 'admin' | 'reminder'
