---
name: Product review flow
description: How product moderation works in MOSTAJIR
---
- Products inserted with review_status='pending' (server/routes/products.js)
- DataContext fetches ALL products from /api/products but filters reviewStatus==='approved' for public display
- Admin sees all products including pending ones in AdminPage "مراجعة المنتجات" tab
- updateProduct({reviewStatus:'approved'/'rejected'}) sends PUT /products/:id with review_status field
- On review_status change, server automatically sends notification to product owner

**Why:** Allows admin to moderate before public listing, owners notified of decisions.
