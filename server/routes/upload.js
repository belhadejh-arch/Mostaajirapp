const router = require('express').Router();
const multer = require('multer');
const { requireAuth } = require('../middleware/auth');

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only images allowed'));
  },
});

function bufferToDataUrl(buffer, mimetype) {
  return `data:${mimetype};base64,${buffer.toString('base64')}`;
}

router.post('/image', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const url = bufferToDataUrl(req.file.buffer, req.file.mimetype);
  res.json({ url });
});

router.post('/images', requireAuth, upload.array('files', 10), (req, res) => {
  if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files uploaded' });
  const urls = req.files.map(f => bufferToDataUrl(f.buffer, f.mimetype));
  res.json({ urls });
});

router.post('/kyc', requireAuth, (req, res) => {
  const { id_front, id_back, selfie } = req.body;
  if (!id_front || !id_back || !selfie) return res.status(400).json({ error: 'All three images required' });
  res.json({ id_front_uri: id_front, id_back_uri: id_back, selfie_uri: selfie });
});

module.exports = router;
