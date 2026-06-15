const router = require('express').Router();
const bcrypt = require('bcrypt');
const { pool } = require('../db');
const { signToken, requireAuth } = require('../middleware/auth');

router.post('/register', async (req, res) => {
  const { email, password, name, phone, wilayaCode, wilayaName } = req.body;
  if (!email || !password || !name) return res.status(400).json({ error: 'email, password, name required' });
  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows: [user] } = await pool.query(
      `INSERT INTO users (email, password_hash) VALUES ($1,$2) RETURNING id, email, created_at`,
      [email.toLowerCase().trim(), hash]
    );
    await pool.query(
      `INSERT INTO profiles (id, name, phone, wilaya_code, wilaya_name, terms_accepted_at) VALUES ($1,$2,$3,$4,$5, NOW())`,
      [user.id, name || '', phone || '', wilayaCode || 16, wilayaName || 'الجزائر']
    );
    const { rows: [profile] } = await pool.query(`SELECT * FROM profiles WHERE id=$1`, [user.id]);
    const token = signToken({ userId: user.id, isAdmin: false });
    res.json({ token, user: { ...profile, email: user.email } });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Email already registered' });
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  try {
    const { rows: [user] } = await pool.query(
      `SELECT * FROM users WHERE email=$1`, [email.toLowerCase().trim()]
    );
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const { rows: [profile] } = await pool.query(`SELECT * FROM profiles WHERE id=$1`, [user.id]);
    if (!profile) return res.status(401).json({ error: 'Profile not found' });
    if (profile.account_status === 'banned') return res.status(403).json({ error: 'Account banned' });
    const token = signToken({ userId: user.id, isAdmin: profile.is_admin });
    res.json({ token, user: { ...profile, email: user.email } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const { rows: [row] } = await pool.query(
      `SELECT p.*, u.email FROM profiles p JOIN users u ON u.id=p.id WHERE p.id=$1`,
      [req.userId]
    );
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/profile', requireAuth, async (req, res) => {
  const allowed = ['name','phone','wilaya_code','wilaya_name','avatar_uri','verification_status','kyc_rejection_reason','wallet_balance','earnings_balance','frozen_balance'];
  const updates = {};
  for (const k of allowed) {
    if (req.body[k] !== undefined) updates[k] = req.body[k];
  }
  if (Object.keys(updates).length === 0) return res.json({ ok: true });
  try {
    const keys = Object.keys(updates);
    const vals = Object.values(updates);
    const set = keys.map((k, i) => `${k}=$${i + 2}`).join(',');
    await pool.query(`UPDATE profiles SET ${set} WHERE id=$1`, [req.userId, ...vals]);
    const { rows: [row] } = await pool.query(
      `SELECT p.*, u.email FROM profiles p JOIN users u ON u.id=p.id WHERE p.id=$1`, [req.userId]
    );
    res.json(row);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/password', requireAuth, async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!newPassword) return res.status(400).json({ error: 'newPassword required' });
  try {
    const { rows: [user] } = await pool.query(`SELECT * FROM users WHERE id=$1`, [req.userId]);
    if (oldPassword) {
      const ok = await bcrypt.compare(oldPassword, user.password_hash);
      if (!ok) return res.status(401).json({ error: 'Old password incorrect' });
    }
    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query(`UPDATE users SET password_hash=$1 WHERE id=$2`, [hash, req.userId]);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
