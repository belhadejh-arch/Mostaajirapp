const router = require('express').Router();
const { pool } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

/* ─────────────────────────────────────────────
   GET /api/ledger/me — current user's transactions
───────────────────────────────────────────── */
router.get('/me', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT l.*, r.product_title
       FROM ledger l
       LEFT JOIN rentals r ON r.id = l.rental_id
       WHERE l.user_id = $1
       ORDER BY l.created_at DESC
       LIMIT 100`,
      [req.userId]
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

/* ─────────────────────────────────────────────
   GET /api/ledger/admin/all — all transactions (admin audit log)
───────────────────────────────────────────── */
router.get('/admin/all', requireAdmin, async (req, res) => {
  const { limit = 200, offset = 0, type, userId } = req.query;
  try {
    let where = 'WHERE 1=1';
    const params = [];
    if (type) { params.push(type); where += ` AND l.type=$${params.length}`; }
    if (userId) { params.push(userId); where += ` AND l.user_id=$${params.length}`; }
    params.push(Number(limit), Number(offset));

    const { rows } = await pool.query(
      `SELECT
         l.*,
         p.name AS user_name, p.phone AS user_phone,
         u.email AS user_email,
         r.product_title, r.owner_name, r.renter_name,
         r.duration_hours, r.rental_fee, r.platform_fee, r.deposit_amount
       FROM ledger l
       LEFT JOIN profiles p ON p.id = l.user_id
       LEFT JOIN users u ON u.id = l.user_id
       LEFT JOIN rentals r ON r.id = l.rental_id
       ${where}
       ORDER BY l.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

/* ─────────────────────────────────────────────
   GET /api/ledger/admin/platform — platform earnings log
───────────────────────────────────────────── */
router.get('/admin/platform', requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT pl.*, r.product_title, r.owner_name, r.renter_name
       FROM platform_ledger pl
       LEFT JOIN rentals r ON r.id = pl.rental_id
       ORDER BY pl.created_at DESC
       LIMIT 200`
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

/* ─────────────────────────────────────────────
   GET /api/ledger/admin/summary — financial KPIs
───────────────────────────────────────────── */
router.get('/admin/summary', requireAdmin, async (req, res) => {
  try {
    const [
      { rows: [platformTotal] },
      { rows: [rentalTotal] },
      { rows: [penaltyTotal] },
      { rows: [frozenTotal] },
      { rows: [activeRentals] },
    ] = await Promise.all([
      pool.query(`SELECT COALESCE(SUM(amount),0) AS total FROM platform_ledger WHERE type='platform_fee'`),
      pool.query(`SELECT COALESCE(SUM(amount),0) AS total FROM ledger WHERE type='rental_payment'`),
      pool.query(`SELECT COALESCE(SUM(amount),0) AS total FROM ledger WHERE type='late_penalty'`),
      pool.query(`SELECT COALESCE(SUM(frozen_balance),0) AS total FROM profiles`),
      pool.query(`SELECT COUNT(*) AS total FROM rentals WHERE status IN ('active','late')`),
    ]);
    res.json({
      platformEarnings: parseFloat(platformTotal.total),
      totalRentalVolume: parseFloat(rentalTotal.total),
      totalPenalties: parseFloat(penaltyTotal.total),
      totalFrozenDeposits: parseFloat(frozenTotal.total),
      activeRentals: parseInt(activeRentals.total),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
