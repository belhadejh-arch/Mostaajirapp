const router = require('express').Router();
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');

router.get('/transactions', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM top_up_transactions WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50`,
      [req.userId]
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/checkout', requireAuth, async (req, res) => {
  const { amount, userId, userEmail, returnUrl, cancelUrl } = req.body;
  if (!amount || amount < 100) return res.status(400).json({ error: 'Invalid amount' });
  const secretKey = process.env.CHARGILY_SECRET_KEY;
  if (!secretKey) return res.status(500).json({ error: 'Payment gateway not configured' });
  try {
    const appDomain = process.env.APP_DOMAIN || returnUrl?.split('/wallet')[0] || '';
    const webhookUrl = `${process.env.SERVER_URL || appDomain}/api/wallet/chargily-webhook`;

    const response = await fetch('https://pay.chargily.net/api/v2/checkouts', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${secretKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: Number(amount),
        currency: 'dzd',
        customer_email: userEmail,
        metadata: { user_id: userId },
        success_url: returnUrl || `${appDomain}/wallet?status=success`,
        failure_url: cancelUrl || `${appDomain}/wallet?status=cancel`,
        webhook_endpoint: webhookUrl,
      }),
    });
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data.message || 'Payment failed' });

    await pool.query(
      `INSERT INTO top_up_transactions (user_id, amount, status, provider, checkout_id) VALUES ($1,$2,'pending','chargily',$3)`,
      [userId, amount, data.id]
    );
    res.json({ checkoutUrl: data.checkout_url, checkoutId: data.id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

router.post('/chargily-webhook', async (req, res) => {
  try {
    const { type, data: checkout } = req.body;
    if (type === 'checkout.paid' && checkout?.metadata?.user_id) {
      const userId = checkout.metadata.user_id;
      const amount = checkout.amount;
      const { rows: [profile] } = await pool.query(`SELECT wallet_balance FROM profiles WHERE id=$1`, [userId]);
      if (profile) {
        const newBalance = (profile.wallet_balance || 0) + amount;
        await pool.query(`UPDATE profiles SET wallet_balance=$1 WHERE id=$2`, [newBalance, userId]);
        await pool.query(
          `UPDATE top_up_transactions SET status='completed', completed_at=now() WHERE checkout_id=$1`,
          [checkout.id]
        );
      }
    }
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.json({ ok: true });
  }
});

router.post('/withdraw', requireAuth, async (req, res) => {
  const { userName, phone, ccpNumber, amount } = req.body;
  if (!userName || !phone || !ccpNumber || !amount) return res.status(400).json({ error: 'All fields required' });
  try {
    const { rows: [profile] } = await pool.query(`SELECT earnings_balance FROM profiles WHERE id=$1`, [req.userId]);
    if (!profile || profile.earnings_balance < amount) return res.status(400).json({ error: 'Insufficient earnings' });
    await pool.query(
      `INSERT INTO withdrawal_requests (user_id, user_name, phone, ccp_number, amount) VALUES ($1,$2,$3,$4,$5)`,
      [req.userId, userName, phone, ccpNumber, amount]
    );
    await pool.query(`UPDATE profiles SET earnings_balance=earnings_balance-$1 WHERE id=$2`, [amount, req.userId]);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
