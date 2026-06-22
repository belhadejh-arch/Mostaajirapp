const router = require('express').Router();
const multer = require('multer');
const { requireAuth } = require('../middleware/auth');

const USE_CLOUDINARY = !!(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

let cloudinary;
if (USE_CLOUDINARY) {
  cloudinary = require('cloudinary').v2;
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  console.log('[Upload] Cloudinary storage enabled');
} else {
  console.log('[Upload] Cloudinary not configured — falling back to local storage');
}

/* ── Local disk fallback ── */
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const diskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() ||
      (file.mimetype.startsWith('video/') ? '.mp4' : '.jpg');
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
  },
});

/* ── Multer: memory when Cloudinary is on, disk when not ── */
const memStorage = multer.memoryStorage();

const imageUpload = multer({
  storage: USE_CLOUDINARY ? memStorage : diskStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Images only'));
  },
});

const videoUpload = multer({
  storage: USE_CLOUDINARY ? memStorage : diskStorage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('video/')) cb(null, true);
    else cb(new Error('Video only'));
  },
});

/* ── Upload helper: Cloudinary or local ── */
async function uploadToCloudinary(file, folder, resourceType = 'image') {
  const b64 = Buffer.from(file.buffer).toString('base64');
  const dataURI = `data:${file.mimetype};base64,${b64}`;
  const result = await cloudinary.uploader.upload(dataURI, {
    resource_type: resourceType,
    folder,
  });
  return result.secure_url;
}

function localUrl(file) {
  return `/uploads/${file.filename}`;
}

/* ── POST /api/upload/image — single image ── */
router.post('/image', requireAuth, imageUpload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  try {
    const url = USE_CLOUDINARY
      ? await uploadToCloudinary(req.file, 'mostajir/images')
      : localUrl(req.file);
    res.json({ url });
  } catch (e) {
    console.error('[Upload] image error:', e.message);
    res.status(500).json({ error: 'Upload failed' });
  }
});

/* ── POST /api/upload/images — multiple images (up to 30) ── */
router.post('/images', requireAuth, imageUpload.array('files', 30), async (req, res) => {
  if (!req.files?.length) return res.status(400).json({ error: 'No files uploaded' });
  try {
    const urls = USE_CLOUDINARY
      ? await Promise.all(req.files.map(f => uploadToCloudinary(f, 'mostajir/images')))
      : req.files.map(localUrl);
    res.json({ urls });
  } catch (e) {
    console.error('[Upload] images error:', e.message);
    res.status(500).json({ error: 'Upload failed' });
  }
});

/* ── POST /api/upload/video — single video ── */
router.post('/video', requireAuth, videoUpload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  try {
    const url = USE_CLOUDINARY
      ? await uploadToCloudinary(req.file, 'mostajir/videos', 'video')
      : localUrl(req.file);
    res.json({ url });
  } catch (e) {
    console.error('[Upload] video error:', e.message);
    res.status(500).json({ error: 'Upload failed' });
  }
});

/* ── POST /api/upload/kyc — base64 from body (no file) ── */
router.post('/kyc', requireAuth, (req, res) => {
  const { id_front, id_back, selfie } = req.body;
  if (!id_front || !id_back || !selfie) return res.status(400).json({ error: 'All three images required' });
  res.json({ id_front_uri: id_front, id_back_uri: id_back, selfie_uri: selfie });
});

module.exports = router;
