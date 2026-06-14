const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

const ALLOWED_ORIGINS = [
  // Vercel production & preview (double-a: mostaajir)
  'https://mostaajirapp.vercel.app',
  'https://mostaajir.vercel.app',
  // Vercel production & preview (single-a fallback: mostajir)
  'https://mostajirapp.vercel.app',
  'https://mostajir.vercel.app',
  // local dev
  'http://localhost:5000',
  'http://localhost:5173',
  'http://localhost:3000',
  // extra origins from env (comma-separated)
  ...(process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
    : []),
];

app.use(cors({
  origin: (origin, cb) => {
    // allow server-to-server (no origin) or any mostaajir/mostajir vercel preview
    if (
      !origin ||
      ALLOWED_ORIGINS.includes(origin) ||
      /^https:\/\/mostaajir.*\.vercel\.app$/.test(origin) ||
      /^https:\/\/mostajir.*\.vercel\.app$/.test(origin)
    ) {
      return cb(null, true);
    }
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth',          require('./routes/auth'));
app.use('/api/products',      require('./routes/products'));
app.use('/api/rentals',       require('./routes/rentals'));
app.use('/api/wallet',        require('./routes/wallet'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/admin',         require('./routes/admin'));
app.use('/api/upload',        require('./routes/upload'));
app.use('/api/messages',      require('./routes/messages'));
app.use('/api/disputes',      require('./routes/disputes'));
app.use('/api/ratings',       require('./routes/ratings'));

app.get('/api/health', (_, res) => res.json({ ok: true }));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`MOSTAJIR API running on port ${PORT}`);
});
