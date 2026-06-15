const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

const REPLIT_DOMAINS = process.env.REPLIT_DOMAINS || '';
const replitOrigins = REPLIT_DOMAINS
  ? REPLIT_DOMAINS.split(',').map(d => d.trim()).flatMap(d => [
      `https://${d}`,
      `https://${d.replace(/^[^.]+\./, '')}`,
    ])
  : [];

const STATIC_ORIGINS = [
  'http://localhost:5000',
  'http://localhost:5173',
  'http://localhost:3000',
  ...(process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
    : []),
];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (STATIC_ORIGINS.includes(origin)) return cb(null, true);
    if (replitOrigins.includes(origin)) return cb(null, true);
    if (/^https:\/\/.*\.replit\.app$/.test(origin)) return cb(null, true);
    if (/^https:\/\/.*\.replit\.dev$/.test(origin)) return cb(null, true);
    if (/^https:\/\/mostaajir.*\.vercel\.app$/.test(origin)) return cb(null, true);
    if (/^https:\/\/mostajir.*\.vercel\.app$/.test(origin)) return cb(null, true);
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
app.use('/api/ledger',        require('./routes/ledger'));
app.use('/api/pdf',           require('./routes/pdf'));

app.get('/api/health', (_, res) => res.json({ ok: true }));

/* ── Internal cron: runs every 10 minutes ── */
const CRON_SECRET = process.env.CRON_SECRET || 'mostajir_cron';
setInterval(async () => {
  try {
    const http = require('http');
    const options = {
      hostname: 'localhost',
      port: PORT,
      path: '/api/rentals/cron/auto-late',
      method: 'POST',
      headers: { 'x-cron-secret': CRON_SECRET, 'Content-Type': 'application/json' },
    };
    const req = http.request(options, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.lateMarked > 0 || result.depositsReleased > 0) {
            console.log(`[Cron] Late marked: ${result.lateMarked}, Deposits released: ${result.depositsReleased}`);
          }
        } catch {}
      });
    });
    req.on('error', () => {});
    req.end();
  } catch {}
}, 10 * 60 * 1000);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`MOSTAJIR API running on port ${PORT}`);
});
