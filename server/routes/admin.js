const router = require('express').Router();
const { pool } = require('../db');
const { requireAdmin, requireAuth } = require('../middleware/auth');

const DEFAULT_SETTINGS = {
  logoUrl: '',
  commissionRates: { under20k:10, under50k:10, under100k:15, under300k:20, under500k:20, above500k:30 },
  dailyPrices: { under20k:800, under50k:1100, under100k:1500, under300k:2000, under500k:2500, above500k:3500 },
  deposits: { under50k:0, under200k:1000, above200k:4000 },
  latePenaltyPerHour: 150,
  minWithdrawal: 1000,
  topUpAmounts: [2000,4000,6000,8000,10000,14000,18000,20000,25000,30000,50000,60000,80000,100000,150000,200000,500000],
};

router.get('/users/:id/rentals', requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, product_title, product_image, owner_name, renter_name, duration_days, total_amount, status, created_at
       FROM rentals WHERE owner_id=$1 OR renter_id=$1 ORDER BY created_at DESC LIMIT 30`,
      [req.params.id]
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/users', requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.*, u.email FROM profiles p JOIN users u ON u.id=p.id ORDER BY p.created_at DESC`
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/users/ids', requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT id FROM profiles WHERE is_admin=false`);
    res.json(rows.map(r => r.id));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/users/:id/status', requireAdmin, async (req, res) => {
  const { account_status } = req.body;
  try {
    await pool.query(`UPDATE profiles SET account_status=$1 WHERE id=$2`, [account_status, req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/users/test', requireAdmin, async (req, res) => {
  try {
    const cutoff = new Date(Date.now() - 86400000 * 30).toISOString();
    await pool.query(
      `DELETE FROM users WHERE id IN (SELECT id FROM profiles WHERE is_admin=false AND total_rentals=0 AND created_at<$1)`,
      [cutoff]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/kyc', requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM kyc_requests ORDER BY created_at DESC`);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/kyc/:userId/approve', requireAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`UPDATE profiles SET verification_status='verified' WHERE id=$1`, [req.params.userId]);
    await client.query(
      `UPDATE kyc_requests SET status='approved', reviewed_at=now() WHERE user_id=$1 AND status='pending'`,
      [req.params.userId]
    );
    await client.query(
      `INSERT INTO notifications (user_id, title, body, type) VALUES ($1,$2,$3,'kyc')`,
      [req.params.userId, '✅ تم قبول توثيق هويتك', 'تهانينا! تم التحقق من هويتك بنجاح. يمكنك الآن إضافة منتجاتك وتأجيرها على موستأجر.']
    );
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

router.put('/kyc/:userId/reject', requireAdmin, async (req, res) => {
  const { reason } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE profiles SET verification_status='rejected', kyc_rejection_reason=$1 WHERE id=$2`,
      [reason, req.params.userId]
    );
    await client.query(
      `UPDATE kyc_requests SET status='rejected', rejection_reason=$1, reviewed_at=now() WHERE user_id=$2 AND status='pending'`,
      [reason, req.params.userId]
    );
    await client.query(
      `INSERT INTO notifications (user_id, title, body, type) VALUES ($1,$2,$3,'kyc')`,
      [req.params.userId, '❌ تم رفض طلب التوثيق', `تعذّر قبول طلب التوثيق الخاص بك. السبب: ${reason || 'لم يُحدد سبب'}. يمكنك إعادة تقديم الطلب مع وثائق واضحة.`]
    );
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

router.get('/withdrawals', requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM withdrawal_requests ORDER BY created_at DESC`);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/withdrawals/:id/process', requireAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [wr] } = await client.query(`SELECT * FROM withdrawal_requests WHERE id=$1`, [req.params.id]);
    await client.query(`UPDATE withdrawal_requests SET status='processed' WHERE id=$1`, [req.params.id]);
    if (wr) {
      await client.query(
        `INSERT INTO notifications (user_id, title, body, type) VALUES ($1,$2,$3,'admin')`,
        [wr.user_id, '✅ تمت معالجة طلب السحب', `تمت معالجة طلب سحب مبلغ ${(wr.amount || 0).toLocaleString('ar-DZ')} دج إلى حساب CCP رقم ${wr.ccp_number || ''}. يرجى التحقق من وصول المبلغ.`]
      );
    }
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

router.put('/withdrawals/:id/reject', requireAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [wr] } = await client.query(`SELECT * FROM withdrawal_requests WHERE id=$1`, [req.params.id]);
    if (wr && wr.status === 'pending') {
      await client.query(`UPDATE profiles SET earnings_balance=earnings_balance+$1 WHERE id=$2`, [wr.amount, wr.user_id]);
      await client.query(
        `INSERT INTO notifications (user_id, title, body, type) VALUES ($1,$2,$3,'admin')`,
        [wr.user_id, '❌ تم رفض طلب السحب', `تم رفض طلب سحب مبلغ ${(wr.amount || 0).toLocaleString('ar-DZ')} دج وأُعيد المبلغ إلى رصيد أرباحك.`]
      );
    }
    await client.query(`UPDATE withdrawal_requests SET status='rejected' WHERE id=$1`, [req.params.id]);
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

router.get('/settings', async (req, res) => {
  try {
    const { rows: [row] } = await pool.query(`SELECT settings FROM admin_settings WHERE id=1`);
    const settings = row ? { ...DEFAULT_SETTINGS, ...row.settings } : DEFAULT_SETTINGS;
    res.json(settings);
  } catch (e) {
    res.json(DEFAULT_SETTINGS);
  }
});

router.put('/settings', requireAdmin, async (req, res) => {
  try {
    await pool.query(
      `INSERT INTO admin_settings (id, settings, updated_at) VALUES (1,$1,now())
       ON CONFLICT (id) DO UPDATE SET settings=$1, updated_at=now()`,
      [JSON.stringify(req.body)]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/kyc-submit', requireAuth, async (req, res) => {
  const { user_id, user_name, user_email, user_phone, id_front_uri, id_back_uri, selfie_uri } = req.body;
  if (!user_id || !id_front_uri || !id_back_uri || !selfie_uri) return res.status(400).json({ error: 'Missing fields' });
  try {
    await pool.query(
      `INSERT INTO kyc_requests (user_id, user_name, user_email, user_phone, id_front_uri, id_back_uri, selfie_uri)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT DO NOTHING`,
      [user_id, user_name || '', user_email || '', user_phone || '', id_front_uri, id_back_uri, selfie_uri]
    );
    await pool.query(`UPDATE profiles SET verification_status='pending' WHERE id=$1`, [user_id]);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/notifications/broadcast', requireAdmin, async (req, res) => {
  const { notifications } = req.body;
  if (!Array.isArray(notifications) || notifications.length === 0) return res.status(400).json({ error: 'notifications array required' });
  try {
    const values = notifications.map((n, i) => `($${i*4+1},$${i*4+2},$${i*4+3},$${i*4+4})`).join(',');
    const params = notifications.flatMap(n => [n.user_id, n.title, n.body, n.type || 'general']);
    await pool.query(`INSERT INTO notifications (user_id, title, body, type) VALUES ${values}`, params);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

/* ─────────────────────────────────────────────
   GET /api/admin/financials — daily/weekly/monthly platform revenue
───────────────────────────────────────────── */
router.get('/financials', requireAdmin, async (req, res) => {
  try {
    const [
      { rows: daily },
      { rows: monthly },
      { rows: topOwners },
      { rows: rentalStats },
    ] = await Promise.all([
      pool.query(`
        SELECT
          date_trunc('day', created_at) AS day,
          SUM(CASE WHEN type='platform_fee' THEN amount ELSE 0 END) AS platform_fee,
          COUNT(*) AS count
        FROM platform_ledger
        WHERE created_at > now() - interval '30 days'
        GROUP BY 1 ORDER BY 1
      `),
      pool.query(`
        SELECT
          date_trunc('month', created_at) AS month,
          SUM(CASE WHEN type='platform_fee' THEN amount ELSE 0 END) AS platform_fee,
          COUNT(*) AS count
        FROM platform_ledger
        WHERE created_at > now() - interval '12 months'
        GROUP BY 1 ORDER BY 1
      `),
      pool.query(`
        SELECT p.name, p.id,
          SUM(r.net_earnings) AS total_earnings,
          COUNT(r.id) AS rentals_count
        FROM rentals r
        JOIN profiles p ON p.id = r.owner_id
        WHERE r.status = 'completed'
        GROUP BY p.id, p.name
        ORDER BY total_earnings DESC LIMIT 10
      `),
      pool.query(`
        SELECT
          status,
          COUNT(*) AS count,
          COALESCE(SUM(total_amount), 0) AS volume
        FROM rentals
        GROUP BY status
      `),
    ]);
    res.json({ daily, monthly, topOwners, rentalStats });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

/* ─────────────────────────────────────────────
   GET /api/admin/payout-alerts — owners with earnings ready to withdraw
───────────────────────────────────────────── */
router.get('/payout-alerts', requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        p.id, p.name, p.phone, u.email,
        p.earnings_balance,
        p.wallet_balance,
        p.verification_status,
        COUNT(r.id) AS completed_rentals,
        MAX(r.actual_end_at) AS last_completion
      FROM profiles p
      JOIN users u ON u.id = p.id
      LEFT JOIN rentals r ON r.owner_id = p.id AND r.status = 'completed'
      WHERE p.earnings_balance > 0 AND p.is_admin = false
      GROUP BY p.id, p.name, p.phone, u.email, p.earnings_balance, p.wallet_balance, p.verification_status
      ORDER BY p.earnings_balance DESC
    `);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

/* ─────────────────────────────────────────────
   GET /api/admin/public-profile/:id — public user profile for owner pages
───────────────────────────────────────────── */
router.get('/public-profile/:id', async (req, res) => {
  try {
    const { rows: [profile] } = await pool.query(
      `SELECT p.id, p.name, p.owner_avatar_uri, p.owner_wilaya_name, p.owner_wilaya_code,
              p.verification_status, p.owner_rating, p.owner_review_count, p.total_rentals,
              p.created_at, u.email
       FROM profiles p
       JOIN users u ON u.id = p.id
       WHERE p.id=$1`,
      [req.params.id]
    );
    if (!profile) return res.status(404).json({ error: 'Not found' });

    const { rows: ratings } = await pool.query(
      `SELECT or2.rating, or2.comment, or2.created_at,
              p.name AS renter_name
       FROM owner_ratings or2
       JOIN profiles p ON p.id = or2.renter_id
       WHERE or2.owner_id=$1
       ORDER BY or2.created_at DESC LIMIT 20`,
      [req.params.id]
    );

    const { rows: [completedStats] } = await pool.query(
      `SELECT COUNT(*) AS completed_count
       FROM rentals WHERE owner_id=$1 AND status='completed'`,
      [req.params.id]
    );

    res.json({ profile, ratings, completedRentals: parseInt(completedStats?.completed_count || 0) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

/* ─────────────────────────────────────────────
   GET /api/admin/backup — export all data as JSON
───────────────────────────────────────────── */
router.get('/backup', requireAdmin, async (req, res) => {
  try {
    const tables = ['users','profiles','products','rentals','ledger','platform_ledger','notifications','disputes','kyc_requests','withdrawal_requests','owner_ratings'];
    const backup = { exportedAt: new Date().toISOString(), tables: {} };
    for (const table of tables) {
      try {
        const { rows } = await pool.query(`SELECT * FROM ${table} ORDER BY created_at DESC LIMIT 5000`);
        backup.tables[table] = rows;
      } catch { backup.tables[table] = []; }
    }
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="mostajir-backup-${Date.now()}.json"`);
    res.json(backup);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

/* ─────────────────────────────────────────────
   POST /api/admin/restore — restore products/rentals from backup JSON
   Only restores safe non-auth tables
───────────────────────────────────────────── */
router.post('/restore', requireAdmin, async (req, res) => {
  const { tables } = req.body;
  if (!tables) return res.status(400).json({ error: 'tables object required' });
  const allowed = ['products', 'rentals', 'disputes', 'owner_ratings'];
  const restored = {};
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const table of allowed) {
      if (!tables[table] || !Array.isArray(tables[table])) continue;
      let count = 0;
      for (const row of tables[table]) {
        try {
          const keys = Object.keys(row);
          const vals = Object.values(row);
          const cols = keys.join(',');
          const placeholders = keys.map((_, i) => `$${i+1}`).join(',');
          const updates = keys.filter(k => k !== 'id').map((k, i) => `${k}=EXCLUDED.${k}`).join(',');
          await client.query(
            `INSERT INTO ${table} (${cols}) VALUES (${placeholders}) ON CONFLICT (id) DO UPDATE SET ${updates}`,
            vals
          );
          count++;
        } catch {}
      }
      restored[table] = count;
    }
    await client.query('COMMIT');
    res.json({ ok: true, restored });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

module.exports = router;
