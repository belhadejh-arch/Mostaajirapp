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

module.exports = router;
