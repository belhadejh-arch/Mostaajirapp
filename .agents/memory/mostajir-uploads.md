---
name: MOSTAJIR upload architecture
description: Images and video are stored as files on disk, not base64 in the database
---

## Rule
Images and video must NEVER be stored as base64 in the PostgreSQL database. They are uploaded as multipart form data, saved to `server/uploads/`, and stored as `/uploads/filename.ext` URL strings in the DB.

**Why:** Base64 encoding inflates file size by ~33%. With 5+ images and a video, a single product's JSON payload exceeded 50MB, causing timeouts, failed uploads, and extremely slow page loads (every product fetch included all image data).

## How to apply
- **Backend** (`server/routes/upload.js`): Uses `multer.diskStorage()` saving to `server/uploads/`. Endpoints: `POST /api/upload/images` (array, images), `POST /api/upload/video` (single, video). Returns `{ urls: ["/uploads/filename.jpg"] }` or `{ url: "/uploads/filename.mp4" }`.
- **Frontend** (`AddProductPage.tsx`): `compressImage(file)` uses Canvas API to resize to max 1200px at JPEG 0.82 quality BEFORE uploading. Images upload immediately on selection (not on submit). Submit only sends tiny URL strings.
- **Vite proxy** (`vite.config.ts`): `/uploads` proxied to `http://localhost:3001` alongside `/api`, so dev server serves files correctly.
- **Express** (`server/index.js`): JSON body limit reduced to 5MB (from 20MB) since no more base64 payloads.
- **KYC** still uses base64 from request body (small, 3 images) — acceptable exception.

## File paths
- Upload endpoint: `server/routes/upload.js`
- Upload directory: `server/uploads/` (served as static by express)
- Frontend uploader: `frontend/src/pages/AddProductPage.tsx` → `compressImage()` + `handleImageFiles()` + `handleVideoFile()`
