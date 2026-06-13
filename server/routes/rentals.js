const router = require('express').Router();
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, async (req, res) => {
  try {
    const query = req.isAdmin
      ? `SELECT * FROM rentals ORDER BY created_at DESC`
      : `SELECT * FROM rentals WHERE owner_id=$1 OR renter_id=$1 ORDER BY created_at DESC`;
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
      INSERT INTO rentals (
        id, product_id, product_title, product_image,
        owner_id, owner_name, renter_id, renter_name, renter_phone,
        renter_address, renter_wilaya, self_pickup,
        duration_days, daily_rate, deposit, commission_amount, net_earnings,
        total_amount, escrow_amount, qr_code_delivery, qr_code_return,
        handover_token, return_token
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$18,$19,$20,$19,$20)
      RETURNING *`,
      [
        d.id, d.product_id, d.product_title, d.product_image || null,
        d.owner_id, d.owner_name, d.renter_id, d.renter_name, d.renter_phone,
        d.renter_address || '', d.renter_wilaya || '', d.self_pickup || false,
        d.duration_days, d.daily_rate, d.deposit || 0, d.commission_amount || 0, d.net_earnings || 0,
        d.total_amount || 0, d.handover_token, d.return_token,
      ]
    );
    await pool.query(
      `UPDATE products SET available_quantity=GREATEST(0, available_quantity-1),
       status=CASE WHEN available_quantity-1<=0 THEN 'rented' ELSE 'available' END WHERE id=$1`,
      [d.product_id]
    );
    res.json(row);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id/status', requireAuth, async (req, res) => {
  const { status, start_time, end_time, late_penalty, escrow_amount, duration_days, total_amount, extension_requested, extension_days } = req.body;
  try {
    const updates = { status };
    if (start_time !== undefined) updates.start_time = start_time;
    if (end_time !== undefined) updates.end_time = end_time;
    if (late_penalty !== undefined) updates.late_penalty = late_penalty;
    if (escrow_amount !== undefined) updates.escrow_amount = escrow_amount;
    if (duration_days !== undefined) updates.duration_days = duration_days;
    if (total_amount !== undefined) updates.total_amount = total_amount;
    if (extension_requested !== undefined) updates.extension_requested = extension_requested;
    if (extension_days !== undefined) updates.extension_days = extension_days;

    const keys = Object.keys(updates);
    const vals = Object.values(updates);
    const set = keys.map((k, i) => `${k}=$${i + 2}`).join(',');
    const { rows: [row] } = await pool.query(
      `UPDATE rentals SET ${set} WHERE id=$1 RETURNING *`, [req.params.id, ...vals]
    );
    res.json(row);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/handover-scan', requireAuth, async (req, res) => {
  const { token, lessorId } = req.body;
  if (!token || !lessorId) return res.status(400).json({ error: 'Missing token or lessorId' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [rental] } = await client.query(
      `SELECT * FROM rentals WHERE handover_token=$1 AND owner_id=$2 AND status='accepted'`,
      [token, lessorId]
    );
    if (!rental) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'كود QR غير صالح أو العملية مكتملة مسبقاً' });
    }
    const { rows: [renterProfile] } = await client.query(`SELECT wallet_balance FROM profiles WHERE id=$1`, [rental.renter_id]);
    const { rows: [lessorProfile] } = await client.query(`SELECT wallet_balance, earnings_balance FROM profiles WHERE id=$1`, [rental.owner_id]);

    const newRenterBal = (renterProfile.wallet_balance || 0) - rental.total_amount;
    if (newRenterBal < 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'رصيد المستأجر غير كافٍ' });
    }
    const newLessorEarnings = (lessorProfile.earnings_balance || 0) + rental.net_earnings;
    const newLessorWallet = (lessorProfile.wallet_balance || 0) + rental.net_earnings;

    await client.query(`UPDATE profiles SET wallet_balance=$1 WHERE id=$2`, [newRenterBal, rental.renter_id]);
    await client.query(`UPDATE profiles SET earnings_balance=$1, wallet_balance=$2 WHERE id=$3`, [newLessorEarnings, newLessorWallet, rental.owner_id]);
    const { rows: [updated] } = await client.query(
      `UPDATE rentals SET status='active', start_time=now(), handover_token=NULL WHERE id=$1 RETURNING *`,
      [rental.id]
    );
    await client.query('COMMIT');
    res.json({ success: true, message: 'تم مسح الكود بنجاح! انتقل الرصيد للمؤجر وبدأ الإيجار', rental: updated });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

router.post('/return-scan', requireAuth, async (req, res) => {
  const { token, lessorId } = req.body;
  if (!token || !lessorId) return res.status(400).json({ error: 'Missing token or lessorId' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [rental] } = await client.query(
      `SELECT * FROM rentals WHERE return_token=$1 AND owner_id=$2 AND status='active'`,
      [token, lessorId]
    );
    if (!rental) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'كود إعادة غير صالح أو العملية غير نشطة' });
    }
    if (rental.deposit > 0) {
      const { rows: [renterProfile] } = await client.query(`SELECT wallet_balance FROM profiles WHERE id=$1`, [rental.renter_id]);
      const newBal = (renterProfile.wallet_balance || 0) + rental.deposit;
      await client.query(`UPDATE profiles SET wallet_balance=$1 WHERE id=$2`, [newBal, rental.renter_id]);
    }
    const { rows: [updated] } = await client.query(
      `UPDATE rentals SET status='completed', return_token=NULL, end_time=now() WHERE id=$1 RETURNING *`,
      [rental.id]
    );
    await client.query(
      `UPDATE products SET available_quantity=LEAST(stock_quantity, available_quantity+1), status='available' WHERE id=$1`,
      [rental.product_id]
    );
    await client.query('COMMIT');
    res.json({ success: true, message: 'تمت إعادة الشيء المؤجر بنجاح وإغلاق المعاملة', rental: updated });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

module.exports = router;
