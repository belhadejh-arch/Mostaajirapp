const router = require('express').Router();
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');

router.post('/', requireAuth, async (req, res) => {
  const { ownerId, renterId, rentalId, rating, comment } = req.body;
  try {
    await pool.query(`
      INSERT INTO owner_ratings (owner_id, renter_id, rental_id, rating, comment)
      VALUES ($1,$2,$3,$4,$5)
      ON CONFLICT (rental_id, renter_id) DO UPDATE SET rating=$4, comment=$5`,
      [ownerId, renterId, rentalId, rating, comment || null]
    );
    const { rows: [profile] } = await pool.query(
      `SELECT owner_rating, owner_review_count FROM profiles WHERE id=$1`, [ownerId]
    );
    res.json(profile || {});
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
