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

  // ✅ Force integer — Chargily requires integer DZD, no decimals
  const amountInt = Math.floor(Number(amount));
  if (!amountInt || amountInt < 100) return res.status(400).json({ error: 'Invalid amount (min 100 DZD)' });

  const secretKey = 'live_sk_DbJMghBN6ql75nN3C3QNRfk2Rrfy2nBdcoo2EqcT';
  console.log("API Key exists:", !!secretKey);

  try {
    const appDomain = returnUrl?.split('/wallet')[0] || '';

    const payload = {
      amount: amountInt,
      currency: 'dzd',
      success_url: returnUrl || `${appDomain}/wallet?status=success`,
      back_url: cancelUrl || `${appDomain}/wallet?status=cancel`,
    };

    console.log('[Chargily] POST payload:', JSON.stringify(payload));

    const response = await fetch('https://pay.chargily.net/api/v2/checkouts', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer live_sk_DbJMghBN6ql75nN3C3QNRfk2Rrfy2nBdcoo2EqcT',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json();

    console.log('[Chargily] Response status:', response.status, '| body:', JSON.stringify(data));

    if (!response.ok) return res.status(response.status).json({ error: data.message || data.errors || 'Payment failed' });

    await pool.query(
      `INSERT INTO top_up_transactions (user_id, amount, status, provider, checkout_id) VALUES ($1,$2,'pending','chargily',$3)`,
      [userId, amountInt, data.id]
    );
    res.json({ checkoutUrl: data.checkout_url, checkoutId: data.id });
  } catch (e) {
    console.error('[Chargily] Error:', e.message);
    console.error('خطأ Chargily المباشر:', e.response?.data);
    res.status(500).json({ error: e.message });
  }
});

router.post('/chargily-webhook', async (req, res) => {
  try {
    const { type, data: checkout } = req.body;
    console.log('[Webhook] type:', type, '| checkout id:', checkout?.id);

    if (type === 'checkout.paid' && checkout?.metadata?.user_id) {
      const userId = checkout.metadata.user_id;

      // ✅ Parse amount as number — Chargily may send string or number
      const amount = Number(checkout.amount);
      if (!amount || isNaN(amount)) {
        console.error('[Webhook] Invalid amount:', checkout.amount);
        return res.json({ ok: true });
      }

      const { rows: [profile] } = await pool.query(
        `SELECT wallet_balance FROM profiles WHERE id=$1`, [userId]
      );
      if (profile) {
        // ✅ Parse wallet_balance as number — PostgreSQL NUMERIC returns as string in pg
        const currentBalance = parseFloat(profile.wallet_balance) || 0;
        const newBalance = currentBalance + amount;

        console.log(`[Webhook] userId=${userId} balance: ${currentBalance} + ${amount} = ${newBalance}`);

        await pool.query(`UPDATE profiles SET wallet_balance=$1 WHERE id=$2`, [newBalance, userId]);
        await pool.query(
          `UPDATE top_up_transactions SET status='completed', completed_at=now() WHERE checkout_id=$1`,
          [checkout.id]
        );
      }
    }
    res.json({ ok: true });
  } catch (e) {
    console.error('[Webhook] Error:', e.message);
    res.json({ ok: true });
  }
});

router.post('/withdraw', requireAuth, async (req, res) => {
  const { userName, phone, ccpNumber, amount } = req.body;
  if (!userName || !phone || !ccpNumber || !amount) {
    return res.status(400).json({ error: 'All fields required' });
  }

  // ✅ Parse as number
  const amountNum = Number(amount);
  if (!amountNum || isNaN(amountNum) || amountNum <= 0) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  try {
    const { rows: [profile] } = await pool.query(
      `SELECT earnings_balance FROM profiles WHERE id=$1`, [req.userId]
    );
    // ✅ Parse earnings_balance as number — PostgreSQL NUMERIC returns as string
    const earnings = parseFloat(profile?.earnings_balance) || 0;
    if (!profile || earnings < amountNum) {
      return res.status(400).json({ error: 'Insufficient earnings' });
    }
    await pool.query(
      `INSERT INTO withdrawal_requests (user_id, user_name, phone, ccp_number, amount) VALUES ($1,$2,$3,$4,$5)`,
      [req.userId, userName, phone, ccpNumber, amountNum]
    );
    await pool.query(
      `UPDATE profiles SET earnings_balance=earnings_balance-$1 WHERE id=$2`,
      [amountNum, req.userId]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
