const router = require('express').Router();
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');

router.get('/:rentalId', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM messages WHERE rental_id=$1 ORDER BY created_at ASC`,
      [req.params.rentalId]
    );
    await pool.query(
      `UPDATE messages SET read=true WHERE rental_id=$1 AND receiver_id=$2 AND read=false`,
      [req.params.rentalId, req.userId]
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:rentalId', requireAuth, async (req, res) => {
  const { content, receiverId } = req.body;
  if (!content || !receiverId) return res.status(400).json({ error: 'content and receiverId required' });
  try {
    const { rows: [row] } = await pool.query(
      `INSERT INTO messages (rental_id, sender_id, receiver_id, content) VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.params.rentalId, req.userId, receiverId, content]
    );
    res.json(row);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
