const router = require('express').Router();
const axios = require('axios');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');

router.get('/transactions', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, amount, status, provider, checkout_id, created_at, completed_at
       FROM top_up_transactions WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50`,
      [req.userId]
    );
    res.json(rows);
  } catch (e) {
    console.error('[Wallet] transactions error:', e.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/checkout', requireAuth, async (req, res) => {
  const { amount, userId } = req.body;

  // --- 1. التحقق من المبلغ ---
  const amountInt = Math.floor(Number(amount));
  if (!amountInt || amountInt < 100) {
    return res.status(400).json({ error: 'المبلغ غير صالح (الحد الأدنى 100 دج)' });
  }

  // --- 2. قراءة المفتاح من متغيرات البيئة فقط ---
  const CHARGILY_SECRET_KEY = process.env.CHARGILY_SECRET_KEY || '';
  const isLiveKey = CHARGILY_SECRET_KEY.startsWith('live_sk_');
  const isTestKey = CHARGILY_SECRET_KEY.startsWith('test_sk_');

  if (!isLiveKey && !isTestKey) {
    console.error('[Chargily] CHARGILY_SECRET_KEY غير مضبوط في متغيرات البيئة');
    return res.status(500).json({ error: 'بوابة الدفع غير مهيأة.' });
  }

  // Live endpoint vs Test endpoint تلقائياً حسب نوع المفتاح
  const chargilyApiUrl = isLiveKey
    ? 'https://pay.chargily.net/api/v2/checkouts'
    : 'https://pay.chargily.net/test/api/v2/checkouts';

  console.log('=== [Chargily Checkout] ===');
  console.log('  Mode    :', isLiveKey ? '🟢 LIVE' : '🧪 TEST');
  console.log('  Amount  :', amountInt);
  console.log('  UserId  :', userId);

  // --- 3. البيانات المطابقة تماماً لـ Chargily V2 ---
  const payload = {
    amount: amountInt,
    currency: 'dzd',
    success_url: 'https://mostaajirapp-orpin.vercel.app/wallet?status=success',
  };

  try {
    const response = await axios.post(chargilyApiUrl, payload, {
      headers: {
        'Authorization': `Bearer ${CHARGILY_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    const data = response.data;

    // --- 4. حفظ المعاملة في قاعدة البيانات ---
    await pool.query(
      `INSERT INTO top_up_transactions
         (user_id, amount, status, provider, checkout_id)
       VALUES ($1, $2, 'pending', 'chargily', $3)`,
      [userId, amountInt, data.id]
    );

    console.log('[Chargily] SUCCESS — checkout_url:', data.checkout_url);
    res.json({ checkout_url: data.checkout_url, checkoutId: data.id });

  } catch (error) {
    const status = error.response?.status || 500;
    const details = error.response?.data || error.message;
    console.error('[Chargily] FAILED —', status, details);
    res.status(status).json({ error: 'فشل إنشاء رابط الدفع', details });
  }
});

router.post('/chargily-webhook', async (req, res) => {
  try {
    const { type, data: checkout } = req.body;
    console.log('[Webhook] type:', type, '| checkout id:', checkout?.id);

    if (type === 'checkout.paid' && checkout?.metadata?.user_id) {
      const userId = checkout.metadata.user_id;
      const amount = Number(checkout.amount);

      if (!amount || isNaN(amount)) {
        console.error('[Webhook] Invalid amount:', checkout.amount);
        return res.json({ ok: true });
      }

      const { rows: [profile] } = await pool.query(
        `SELECT wallet_balance FROM profiles WHERE id=$1`, [userId]
      );
      if (profile) {
        const currentBalance = parseFloat(profile.wallet_balance) || 0;
        const newBalance = currentBalance + amount;
        console.log(`[Webhook] userId=${userId} | ${currentBalance} + ${amount} = ${newBalance}`);

        await pool.query(
          `UPDATE profiles SET wallet_balance=$1 WHERE id=$2`,
          [newBalance, userId]
        );
        await pool.query(
          `UPDATE top_up_transactions SET status='completed', completed_at=now()
           WHERE checkout_id=$1`,
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

  const amountNum = Number(amount);
  if (!amountNum || isNaN(amountNum) || amountNum <= 0) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  try {
    const { rows: [profile] } = await pool.query(
      `SELECT earnings_balance FROM profiles WHERE id=$1`, [req.userId]
    );
    const earnings = parseFloat(profile?.earnings_balance) || 0;
    if (!profile || earnings < amountNum) {
      return res.status(400).json({ error: 'Insufficient earnings' });
    }
    await pool.query(
      `INSERT INTO withdrawal_requests (user_id, user_name, phone, ccp_number, amount)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.userId, userName, phone, ccpNumber, amountNum]
    );
    await pool.query(
      `UPDATE profiles SET earnings_balance=earnings_balance-$1 WHERE id=$2`,
      [amountNum, req.userId]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('[Withdraw] Error:', e.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
