const router = require('express').Router();
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, async (req, res) => {
  try {
    const query = req.isAdmin
      ? `SELECT * FROM disputes ORDER BY created_at DESC`
      : `SELECT * FROM disputes WHERE user_id=$1 OR other_party_id=$1 ORDER BY created_at DESC`;
    const args = req.isAdmin ? [] : [req.userId];
    const { rows } = await pool.query(query, args);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', requireAuth, async (req, res) => {
  const d = req.body;
  try {
    const { rows: [row] } = await pool.query(`
      INSERT INTO disputes (rental_id, product_title, filed_by, user_id, user_name, user_phone, title, description)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [d.rental_id, d.product_title || '', d.filed_by, d.user_id, d.user_name, d.user_phone, d.title, d.description]
    );
    res.json(row);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', requireAuth, async (req, res) => {
  const { status, admin_notes } = req.body;
  try {
    const resolvedAt = ['resolved','rejected'].includes(status) ? new Date().toISOString() : null;
    const { rows: [row] } = await pool.query(
      `UPDATE disputes SET status=$1, admin_notes=$2, resolved_at=$3 WHERE id=$4 RETURNING *`,
      [status, admin_notes || null, resolvedAt, req.params.id]
    );
    res.json(row);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
