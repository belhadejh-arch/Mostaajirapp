const router = require('express').Router();
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50`,
      [req.userId]
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/read-all', requireAuth, async (req, res) => {
  try {
    await pool.query(`UPDATE notifications SET read=true WHERE user_id=$1 AND read=false`, [req.userId]);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id/read', requireAuth, async (req, res) => {
  try {
    await pool.query(`UPDATE notifications SET read=true WHERE id=$1 AND user_id=$2`, [req.params.id, req.userId]);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', requireAuth, async (req, res) => {
  const { userId, title, body, type } = req.body;
  if (!userId || !title || !body) return res.status(400).json({ error: 'userId, title, body required' });
  try {
    const { rows: [row] } = await pool.query(
      `INSERT INTO notifications (user_id, title, body, type) VALUES ($1,$2,$3,$4) RETURNING *`,
      [userId, title, body, type || 'general']
    );
    res.json(row);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
