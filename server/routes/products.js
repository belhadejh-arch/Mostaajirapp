const router = require('express').Router();
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM products ORDER BY created_at DESC`);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows: [row] } = await pool.query(`SELECT * FROM products WHERE id=$1`, [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', requireAuth, async (req, res) => {
  const d = req.body;
  try {
    const { rows: [row] } = await pool.query(`
      INSERT INTO products (
        owner_id, owner_name, owner_avatar_uri, owner_phone, owner_address,
        owner_wilaya_code, owner_wilaya_name, title, description, images,
        video_uri, category_id, subcategory_id, wilaya_code, wilaya_name,
        purchase_price, purchase_year, rental_price, deposit, commission_rate,
        delivery_available, stock_quantity, available_quantity, review_status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$22,'pending')
      RETURNING *`,
      [
        d.owner_id, d.owner_name, d.owner_avatar_uri || null, d.owner_phone || null,
        d.owner_address || null, d.owner_wilaya_code || null, d.owner_wilaya_name || null,
        d.title, d.description || '', d.images || [], d.video_uri || null,
        d.category_id, d.subcategory_id || '', d.wilaya_code, d.wilaya_name,
        d.purchase_price, d.purchase_year || 2020, d.rental_price, d.deposit || 0,
        d.commission_rate || 10, d.delivery_available || false, d.stock_quantity || 1,
      ]
    );
    res.json(row);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', requireAuth, async (req, res) => {
  const allowed = [
    'title','description','images','delivery_available','is_hidden','is_frozen',
    'removal_reason','review_status','rejection_reason','status','available_quantity',
    'owner_avatar_uri','owner_rating','owner_review_count',
  ];
  const updates = {};
  for (const k of allowed) {
    if (req.body[k] !== undefined) updates[k] = req.body[k];
  }
  if (Object.keys(updates).length === 0) return res.json({ ok: true });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const keys = Object.keys(updates);
    const vals = Object.values(updates);
    const set = keys.map((k, i) => `${k}=$${i + 2}`).join(',');
    await client.query(`UPDATE products SET ${set} WHERE id=$1`, [req.params.id, ...vals]);
    const { rows: [row] } = await client.query(`SELECT * FROM products WHERE id=$1`, [req.params.id]);

    /* إشعار المالك عند قبول أو رفض المنتج */
    if (updates.review_status && row) {
      if (updates.review_status === 'approved') {
        await client.query(
          `INSERT INTO notifications (user_id, title, body, type) VALUES ($1,$2,$3,'product')`,
          [row.owner_id, '✅ تم نشر منتجك!', `تمت مراجعة منتجك "${row.title}" وتم قبوله ونشره على موستأجر. يمكن للمستأجرين الآن استئجاره.`]
        );
      } else if (updates.review_status === 'rejected') {
        await client.query(
          `INSERT INTO notifications (user_id, title, body, type) VALUES ($1,$2,$3,'product')`,
          [row.owner_id, '❌ تم رفض منتجك', `تعذّر نشر منتجك "${row.title}". السبب: ${updates.rejection_reason || 'لم يُحدد سبب'}. يمكنك تعديله وإعادة رفعه.`]
        );
      }
    }

    await client.query('COMMIT');
    res.json(row);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    await pool.query(`DELETE FROM products WHERE id=$1 AND (owner_id=$2 OR $3)`,
      [req.params.id, req.userId, req.isAdmin]);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
