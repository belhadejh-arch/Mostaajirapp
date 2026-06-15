const express = require('express');
const cors = require('cors');
const path = require('path');

/* ── Auto-seed: run schema + admin account on every cold start ── */
(async () => {
  try {
    const { pool } = require('./db');
    const bcrypt = require('bcrypt');
    const fs = require('fs');
    const schemaPath = path.join(__dirname, 'scripts', 'setup-db.js');

    // Apply schema via the setup script's SQL inline
    const schemaSql = fs.existsSync(path.join(__dirname, 'schema.sql'))
      ? fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8')
      : null;

    if (schemaSql) {
      await pool.query(schemaSql);
      console.log('[Seed] Schema applied');
    }

    // Ensure admin account exists
    const adminEmail = 'admin@mostajir.dz';
    const adminPassword = 'Admin@Mostajir2024!';
    const { rows: [existing] } = await pool.query(
      `SELECT id FROM users WHERE email=$1`, [adminEmail]
    );
    if (!existing) {
      const hash = await bcrypt.hash(adminPassword, 10);
      const { rows: [newUser] } = await pool.query(
        `INSERT INTO users (email, password_hash) VALUES ($1,$2) RETURNING id`,
        [adminEmail, hash]
      );
      await pool.query(
        `INSERT INTO profiles (id, name, is_admin, verification_status)
         VALUES ($1,'Admin MOSTAJIR',true,'verified')`,
        [newUser.id]
      );
      console.log('[Seed] Admin account created: admin@mostajir.dz');
    } else {
      await pool.query(`UPDATE profiles SET is_admin=true WHERE id=$1`, [existing.id]);
      console.log('[Seed] Admin account verified');
    }
  } catch (err) {
    console.error('[Seed] Error:', err.message);
  }
})();

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

/* ── Serve built frontend (production) ── */
const DIST = path.join(__dirname, '..', 'frontend', 'dist');
const fs = require('fs');
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) return res.status(404).json({ error: 'Not found' });
    res.sendFile(path.join(DIST, 'index.html'));
  });
}

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
