const router = require('express').Router();
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
  const { amount, userId, userEmail, returnUrl, cancelUrl } = req.body;

  // --- 1. التحقق من المبلغ ---
  const amountInt = Math.floor(Number(amount));
  if (!amountInt || amountInt < 100) {
    return res.status(400).json({ error: 'المبلغ غير صالح (الحد الأدنى 100 دج)' });
  }

  // --- 2. قراءة المفتاح: يجب أن يكون secret key (يبدأ بـ live_sk_ أو test_sk_) ---
  const envKey = process.env.CHARGILY_SECRET_KEY || '';
  const isLiveKey = envKey.startsWith('live_sk_');
  const isTestKey = envKey.startsWith('test_sk_');

  if (!isLiveKey && !isTestKey) {
    console.error('[Chargily] CHARGILY_SECRET_KEY غير مضبوط أو غير صحيح في متغيرات البيئة');
    return res.status(500).json({ error: 'بوابة الدفع غير مهيأة. يرجى التواصل مع الدعم.' });
  }

  const secretKey = envKey;

  // Live endpoint vs Test endpoint — يجب مطابقة نوع المفتاح مع الـ endpoint الصحيح
  const chargilyBaseUrl = isLiveKey
    ? 'https://pay.chargily.net/api/v2'
    : 'https://pay.chargily.net/test/api/v2';

  // --- 3. Logs للتشخيص ---
  console.log('=== [Chargily Checkout] ===');
  console.log('  ENV key prefix    :', envKey.substring(0, 15) + '...');
  console.log('  Mode              :', isLiveKey ? '🟢 LIVE' : '🧪 TEST');
  console.log('  Endpoint          :', chargilyBaseUrl);
  console.log('  amount            :', amountInt);
  console.log('  userId            :', userId);
  console.log('  returnUrl         :', returnUrl);
  console.log('  cancelUrl         :', cancelUrl);

  // --- 4. بناء الـ payload وفق توثيق Chargily V2 ---
  const appDomain = returnUrl?.split('/wallet')[0] || '';
  const payload = {
    amount   : amountInt,
    currency : 'dzd',
    success_url: returnUrl  || `${appDomain}/wallet?status=success`,
    back_url   : cancelUrl  || `${appDomain}/wallet?status=cancel`,
  };

  console.log('  payload           :', JSON.stringify(payload));

  try {
    // --- 5. إرسال الطلب إلى Chargily V2 ---
    const response = await fetch(`${chargilyBaseUrl}/checkouts`, {
      method : 'POST',
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type' : 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const rawText = await response.text();
    console.log('  Chargily HTTP status :', response.status);
    console.log('  Chargily raw response:', rawText);

    let data;
    try { data = JSON.parse(rawText); } catch { data = { raw: rawText }; }

    if (!response.ok) {
      console.error('[Chargily] FAILED —', response.status, data);
      return res.status(response.status).json({
        error  : data.message || data.error || 'فشل الدفع',
        details: data,
      });
    }

    // --- 6. حفظ المعاملة في قاعدة البيانات ---
    await pool.query(
      `INSERT INTO top_up_transactions
         (user_id, amount, status, provider, checkout_id)
       VALUES ($1, $2, 'pending', 'chargily', $3)`,
      [userId, amountInt, data.id]
    );

    console.log('[Chargily] SUCCESS — checkout_url:', data.checkout_url);
    res.json({ checkoutUrl: data.checkout_url, checkoutId: data.id });

  } catch (e) {
    console.error('[Chargily] Exception:', e.message);
    res.status(500).json({ error: e.message });
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
