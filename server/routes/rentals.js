const router = require('express').Router();
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { calculateRentalDetails } = require('../utils/pricing');

/* ─────────────────────────────────────────────
   GET /api/rentals  — list rentals for current user
───────────────────────────────────────────── */
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

/* ─────────────────────────────────────────────
   GET /api/rentals/pricing  — dynamic price calculation
───────────────────────────────────────────── */
router.get('/pricing', requireAuth, async (req, res) => {
  const { productPrice, hours } = req.query;
  if (!productPrice || !hours) return res.status(400).json({ error: 'productPrice and hours required' });
  const details = calculateRentalDetails(Number(productPrice), Number(hours));
  res.json(details);
});

/* ─────────────────────────────────────────────
   POST /api/rentals — create rental
   • Deposit is paid ONLY by the RENTER
   • Deducts (rentalFee + depositAmount) from renter wallet atomically
   • Freezes depositAmount in renter's frozen_balance
   • Writes ledger entries
   • Owner pays NOTHING
───────────────────────────────────────────── */
router.post('/', requireAuth, async (req, res) => {
  const d = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    /* ── 1. Fetch product & recalculate pricing server-side ── */
    const { rows: [product] } = await client.query(`SELECT * FROM products WHERE id=$1`, [d.product_id]);
    if (!product) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Product not found' }); }

    const hours = d.duration_hours || (d.duration_days || 1) * 24;
    const pricing = calculateRentalDetails(Number(product.purchase_price), hours);

    /* Total renter charge = rental fee + deposit (deposit frozen, not spent) */
    const totalCharge = pricing.totalRentalFee + pricing.depositAmount;

    /* ── 2. Check RENTER balance only ── */
    const { rows: [renterProfile] } = await client.query(
      `SELECT wallet_balance, frozen_balance FROM profiles WHERE id=$1`, [d.renter_id]
    );
    if (!renterProfile || parseFloat(renterProfile.wallet_balance) < totalCharge) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `رصيد المستأجر غير كافٍ. المطلوب: ${totalCharge.toLocaleString('ar-DZ')} دج (إيجار ${pricing.totalRentalFee.toLocaleString('ar-DZ')} + ضمان ${pricing.depositAmount.toLocaleString('ar-DZ')})`
      });
    }

    /* ── 3. Deduct total from RENTER wallet + freeze deposit in RENTER's frozen_balance ── */
    await client.query(
      `UPDATE profiles SET
         wallet_balance  = wallet_balance  - $1,
         frozen_balance  = frozen_balance  + $2
       WHERE id=$3`,
      [totalCharge, pricing.depositAmount, d.renter_id]
    );

    /* ── 4. Insert rental ── */
    const rentalId      = d.id             || require('crypto').randomUUID();
    const handoverToken = d.handover_token || require('crypto').randomUUID();
    const returnToken   = d.return_token   || require('crypto').randomUUID();

    const { rows: [row] } = await client.query(`
      INSERT INTO rentals (
        id, product_id, product_title, product_image,
        owner_id, owner_name, renter_id, renter_name, renter_phone,
        renter_address, renter_wilaya, self_pickup,
        duration_hours, duration_days, daily_rate,
        rental_fee, platform_fee, deposit_amount,
        deposit, commission_amount, net_earnings,
        total_amount, escrow_amount,
        pickup_qr_code, return_qr_code,
        qr_code_delivery, qr_code_return,
        handover_token, return_token
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,
                $13,$14,$15,$16,$17,$18,$18,$17,$19,
                $20,$20,$21,$22,$21,$22,$21,$22)
      RETURNING *`,
      [
        rentalId,
        d.product_id, product.title, product.images?.[0] || null,
        product.owner_id, d.owner_name || product.owner_name,
        d.renter_id, d.renter_name, d.renter_phone,
        d.renter_address || '', d.renter_wilaya || '', d.self_pickup || false,
        hours, pricing.durationDays, pricing.rate24h,
        pricing.totalRentalFee, pricing.platformFee, pricing.depositAmount,
        pricing.ownerShare,
        totalCharge,
        handoverToken, returnToken,
      ]
    );

    /* ── 5. Reduce product availability ── */
    await client.query(
      `UPDATE products SET
         available_quantity = GREATEST(0, available_quantity - 1),
         status = CASE WHEN available_quantity - 1 <= 0 THEN 'rented' ELSE 'available' END
       WHERE id=$1`,
      [d.product_id]
    );

    /* ── 6. Ledger entries (renter side) ── */
    const balAfterRenter = parseFloat(renterProfile.wallet_balance) - totalCharge;
    await client.query(
      `INSERT INTO ledger (user_id, rental_id, type, amount, balance_after, description)
       VALUES
         ($1,$2,'rental_payment',$3,$4,$5),
         ($1,$2,'deposit_freeze',$6,$4,$7)`,
      [
        d.renter_id, rentalId,
        pricing.totalRentalFee, balAfterRenter,
        `دفع إيجار: ${product.title}`,
        pricing.depositAmount,
        `تجميد ضمان مستأجر: ${product.title} — يُعاد بعد انتهاء الإيجار`,
      ]
    );

    /* ── 7. Notify owner ── */
    await client.query(
      `INSERT INTO notifications (user_id, title, body, type) VALUES ($1,$2,$3,'rental')`,
      [
        product.owner_id,
        '📦 طلب استئجار جديد!',
        `${d.renter_name} يطلب استئجار "${product.title}" لمدة ${pricing.durationDays} يوم — إيجار ${pricing.totalRentalFee.toLocaleString('ar-DZ')} دج`,
      ]
    );

    await client.query('COMMIT');
    res.json(row);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

/* ─────────────────────────────────────────────
   PUT /api/rentals/:id/status — update status
───────────────────────────────────────────── */
router.put('/:id/status', requireAuth, async (req, res) => {
  const { status, start_time, end_time, late_penalty, escrow_amount,
          duration_days, duration_hours, total_amount,
          extension_requested, extension_days } = req.body;
  try {
    const updates = { status };
    if (start_time !== undefined)          updates.start_time = start_time;
    if (end_time !== undefined)            updates.end_time = end_time;
    if (late_penalty !== undefined)        updates.late_penalty = late_penalty;
    if (escrow_amount !== undefined)       updates.escrow_amount = escrow_amount;
    if (duration_days !== undefined)       updates.duration_days = duration_days;
    if (duration_hours !== undefined)      updates.duration_hours = duration_hours;
    if (total_amount !== undefined)        updates.total_amount = total_amount;
    if (extension_requested !== undefined) updates.extension_requested = extension_requested;
    if (extension_days !== undefined)      updates.extension_days = extension_days;

    const keys = Object.keys(updates);
    const vals = Object.values(updates);
    const set  = keys.map((k, i) => `${k}=$${i + 2}`).join(',');
    const { rows: [row] } = await pool.query(
      `UPDATE rentals SET ${set} WHERE id=$1 RETURNING *`, [req.params.id, ...vals]
    );
    res.json(row);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

/* ─────────────────────────────────────────────
   POST /api/rentals/handover-scan
   • Owner scans renter's pickup QR
   • Starts the timer (started_at + expected_end_at)
   • Transfers rentalFee → owner earnings
   • Writes ledger entries
───────────────────────────────────────────── */
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

    const startedAt    = new Date();
    const expectedEndAt = new Date(startedAt.getTime() + parseFloat(rental.duration_hours || rental.duration_days * 24) * 3600000);

    /* Transfer rental_fee to owner earnings */
    const ownerShare = parseFloat(rental.net_earnings) || 0;
    const { rows: [ownerProfile] } = await client.query(
      `SELECT wallet_balance, earnings_balance FROM profiles WHERE id=$1`, [rental.owner_id]
    );
    const newOwnerEarnings = (parseFloat(ownerProfile.earnings_balance) || 0) + ownerShare;
    const newOwnerWallet   = (parseFloat(ownerProfile.wallet_balance)   || 0) + ownerShare;

    await client.query(
      `UPDATE profiles SET earnings_balance=$1, wallet_balance=$2 WHERE id=$3`,
      [newOwnerEarnings, newOwnerWallet, rental.owner_id]
    );

    /* Log platform fee */
    await client.query(
      `INSERT INTO platform_ledger (rental_id, type, amount, description)
       VALUES ($1,'platform_fee',$2,$3)`,
      [rental.id, rental.platform_fee || rental.commission_amount, `عمولة منصة: ${rental.product_title}`]
    );

    /* Owner ledger */
    await client.query(
      `INSERT INTO ledger (user_id, rental_id, type, amount, balance_after, description)
       VALUES ($1,$2,'payout_owner',$3,$4,$5)`,
      [rental.owner_id, rental.id, ownerShare, newOwnerWallet, `دخل إيجار: ${rental.product_title}`]
    );

    /* Update rental */
    const { rows: [updated] } = await client.query(
      `UPDATE rentals SET
         status='active',
         started_at=$1,
         expected_end_at=$2,
         start_time=$1,
         handover_token=NULL,
         pickup_qr_code='',
         qr_code_delivery=''
       WHERE id=$3 RETURNING *`,
      [startedAt.toISOString(), expectedEndAt.toISOString(), rental.id]
    );

    /* Notifications */
    await client.query(
      `INSERT INTO notifications (user_id, title, body, type) VALUES
         ($1,$4,$5,'rental'),
         ($2,$4,$6,'rental')`,
      [
        rental.renter_id, rental.owner_id, rental.id,
        '✅ بدأ الإيجار!',
        `تم تسليم "${rental.product_title}" — ينتهي الإيجار في ${expectedEndAt.toLocaleString('ar-DZ')}. ضمانك مجمد وسيُعاد عند الإغلاق.`,
        `تم تأكيد استلام "${rental.product_title}". أرباحك ${ownerShare.toLocaleString('ar-DZ')} دج أُضيفت لمحفظتك.`,
      ]
    );

    await client.query('COMMIT');
    res.json({ success: true, message: 'تم مسح الكود بنجاح! بدأ الإيجار والعداد يعمل', rental: updated });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

/* ─────────────────────────────────────────────
   POST /api/rentals/return-scan
   • Owner scans renter's return QR
   • Sets actual_end_at + status=completed
   • Checks for late penalty (deducted from deposit)
   • Does NOT release deposit yet — 48h window for renter
   • Notifies renter to withdraw deposit or it auto-releases after 48h
───────────────────────────────────────────── */
router.post('/return-scan', requireAuth, async (req, res) => {
  const { token, lessorId } = req.body;
  if (!token || !lessorId) return res.status(400).json({ error: 'Missing token or lessorId' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [rental] } = await client.query(
      `SELECT * FROM rentals WHERE return_token=$1 AND owner_id=$2 AND status IN ('active','late')`,
      [token, lessorId]
    );
    if (!rental) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'كود إعادة غير صالح أو العملية غير نشطة' });
    }

    const actualEndAt = new Date();
    let latePenalty = 0;

    /* Compute late penalty if returned after expected_end */
    if (rental.expected_end_at) {
      const overdue = actualEndAt.getTime() - new Date(rental.expected_end_at).getTime();
      if (overdue > 0) {
        const overdueHours = Math.ceil(overdue / 3600000);
        latePenalty = overdueHours * 150;

        /* Deduct late penalty from renter's frozen_balance (deposit) */
        await client.query(
          `UPDATE profiles SET
             frozen_balance = GREATEST(0, frozen_balance - $1)
           WHERE id=$2`,
          [latePenalty, rental.renter_id]
        );
        await client.query(
          `INSERT INTO ledger (user_id, rental_id, type, amount, balance_after, description)
           SELECT $1, $2, 'late_penalty', $3, frozen_balance, $4
           FROM profiles WHERE id=$1`,
          [rental.renter_id, rental.id, latePenalty, `غرامة تأخير: ${rental.product_title}`]
        );
      }
    }

    const { rows: [updated] } = await client.query(
      `UPDATE rentals SET
         status='completed',
         actual_end_at=$1,
         end_time=$1,
         return_token=NULL,
         return_qr_code='',
         qr_code_return='',
         late_penalty=$2
       WHERE id=$3 RETURNING *`,
      [actualEndAt.toISOString(), latePenalty, rental.id]
    );

    /* Restore product availability */
    await client.query(
      `UPDATE products SET
         available_quantity = LEAST(stock_quantity, available_quantity + 1),
         status = 'available'
       WHERE id=$1`,
      [rental.product_id]
    );

    const depositAmount = parseFloat(rental.deposit_amount || rental.deposit || 0);
    const depositAfterPenalty = Math.max(0, depositAmount - latePenalty);
    const deadline = new Date(actualEndAt.getTime() + 48 * 3600000);

    /* Notify renter — deposit ready, 48h window to withdraw */
    await client.query(
      `INSERT INTO notifications (user_id, title, body, type) VALUES ($1,$2,$3,'rental')`,
      [
        rental.renter_id,
        '💰 الإيجار مكتمل — ضمانك جاهز للسحب',
        `تم إغلاق إيجار "${rental.product_title}" بنجاح${latePenalty > 0 ? ` (غرامة تأخير: ${latePenalty.toLocaleString('ar-DZ')} دج)` : ''}. ` +
        `ضمانك ${depositAfterPenalty.toLocaleString('ar-DZ')} دج متاح الآن — يمكنك سحبه خلال 48 ساعة (قبل ${deadline.toLocaleString('ar-DZ')}) أو سيُضاف تلقائياً لرصيدك.`,
      ]
    );

    /* Notify owner */
    await client.query(
      `INSERT INTO notifications (user_id, title, body, type) VALUES ($1,$2,$3,'rental')`,
      [
        rental.owner_id,
        '✅ استلمت الشيء المؤجر',
        `استلمت "${rental.product_title}" وأُغلقت العملية بنجاح.`,
      ]
    );

    await client.query('COMMIT');
    res.json({
      success: true,
      message: latePenalty > 0
        ? `تمت الإعادة. غرامة تأخير: ${latePenalty.toLocaleString('ar-DZ')} دج. الضمان المتبقي ${depositAfterPenalty.toLocaleString('ar-DZ')} دج متاح للسحب خلال 48 ساعة.`
        : `تمت إعادة الشيء بنجاح. ضمانك ${depositAfterPenalty.toLocaleString('ar-DZ')} دج متاح للسحب خلال 48 ساعة.`,
      rental: updated,
    });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

/* ─────────────────────────────────────────────
   POST /api/rentals/:id/release-deposit
   • Renter manually requests deposit release after completion (within 48h)
   • Moves deposit from frozen_balance → wallet_balance (available for rent or withdrawal)
───────────────────────────────────────────── */
router.post('/:id/release-deposit', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [rental] } = await client.query(
      `SELECT * FROM rentals WHERE id=$1 AND renter_id=$2 AND status='completed'`,
      [req.params.id, req.userId]
    );
    if (!rental) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'الإيجار غير مكتمل أو غير موجود' });
    }
    const deposit = parseFloat(rental.deposit_amount || rental.deposit || 0);
    if (deposit <= 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'لا يوجد ضمان مجمد لهذا الإيجار' });
    }

    /* Check no open disputes */
    const { rows: openDisputes } = await client.query(
      `SELECT id FROM disputes WHERE rental_id=$1 AND status IN ('open','under_review')`,
      [rental.id]
    );
    if (openDisputes.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'يوجد نزاع مفتوح. يتعذر الإفراج عن الضمان حتى حل النزاع' });
    }

    /* Move deposit: frozen_balance → wallet_balance (renter can then use or withdraw) */
    await client.query(
      `UPDATE profiles SET
         wallet_balance = wallet_balance + $1,
         frozen_balance = GREATEST(0, frozen_balance - $1)
       WHERE id=$2`,
      [deposit, rental.renter_id]
    );
    await client.query(
      `INSERT INTO ledger (user_id, rental_id, type, amount, balance_after, description)
       SELECT $1, $2, 'deposit_release', $3, wallet_balance, $4
       FROM profiles WHERE id=$1`,
      [rental.renter_id, rental.id, deposit, `إفراج ضمان مستأجر: ${rental.product_title}`]
    );
    /* Zero out deposit on rental */
    await client.query(
      `UPDATE rentals SET deposit_amount=0, deposit=0, escrow_amount=0 WHERE id=$1`,
      [rental.id]
    );
    await client.query('COMMIT');
    res.json({
      success: true,
      message: `تم تحويل ${deposit.toLocaleString('ar-DZ')} دج من الضمان إلى رصيدك — يمكنك الآن استخدامه أو سحبه`,
    });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

/* ─────────────────────────────────────────────
   POST /api/rentals/cron/auto-late
   • Mark overdue active rentals as 'late'
   • Auto-release deposits to renter wallet after 48h window (no open disputes)
   (called by internal scheduler every 10 minutes)
───────────────────────────────────────────── */
router.post('/cron/auto-late', async (req, res) => {
  const secret = req.headers['x-cron-secret'];
  if (secret !== (process.env.CRON_SECRET || 'mostajir_cron')) return res.status(403).json({ error: 'Forbidden' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    /* Mark active rentals past expected_end as 'late' */
    const { rows: lateRentals } = await client.query(
      `UPDATE rentals SET status='late'
       WHERE status='active' AND expected_end_at < now()
       RETURNING id, renter_id, product_title`
    );
    for (const r of lateRentals) {
      await client.query(
        `INSERT INTO notifications (user_id, title, body, type) VALUES ($1,$2,$3,'rental')`,
        [r.renter_id, '⚠️ الإيجار تأخر عن موعده', `إيجار "${r.product_title}" تجاوز مدته المحددة. يُرجى إعادة الشيء فوراً لتجنب غرامات التأخير.`]
      );
    }

    /* Auto-release deposits to renter wallet for completed rentals past 48h with no open disputes */
    const { rows: toRelease } = await client.query(
      `SELECT r.id, r.renter_id, r.deposit_amount, r.deposit, r.product_title
       FROM rentals r
       WHERE r.status='completed'
         AND COALESCE(r.deposit_amount, r.deposit, 0) > 0
         AND r.actual_end_at < now() - interval '48 hours'
         AND NOT EXISTS (
           SELECT 1 FROM disputes d
           WHERE d.rental_id = r.id AND d.status IN ('open','under_review')
         )`
    );

    for (const r of toRelease) {
      const deposit = parseFloat(r.deposit_amount || r.deposit || 0);
      if (deposit <= 0) continue;
      /* Move deposit: frozen_balance → wallet_balance */
      await client.query(
        `UPDATE profiles SET
           wallet_balance = wallet_balance + $1,
           frozen_balance = GREATEST(0, frozen_balance - $1)
         WHERE id=$2`,
        [deposit, r.renter_id]
      );
      await client.query(
        `INSERT INTO ledger (user_id, rental_id, type, amount, balance_after, description)
         SELECT $1, $2, 'deposit_release', $3, wallet_balance, $4
         FROM profiles WHERE id=$1`,
        [r.renter_id, r.id, deposit, `إفراج تلقائي للضمان: ${r.product_title}`]
      );
      await client.query(
        `UPDATE rentals SET deposit_amount=0, deposit=0, escrow_amount=0 WHERE id=$1`, [r.id]
      );
      await client.query(
        `INSERT INTO notifications (user_id, title, body, type) VALUES ($1,$2,$3,'rental')`,
        [
          r.renter_id,
          '💰 تم إضافة ضمانك لرصيدك تلقائياً',
          `انتهت مدة 48 ساعة — تم تحويل ضمان "${r.product_title}" (${deposit.toLocaleString('ar-DZ')} دج) إلى رصيدك. يمكنك استخدامه للإيجار أو سحبه.`,
        ]
      );
    }

    /* Auto-cancel pending_owner rentals older than 12 hours + refund renter */
    const { rows: autoCancelled } = await client.query(
      `UPDATE rentals SET status='cancelled'
       WHERE status='pending_owner'
         AND created_at < now() - interval '12 hours'
       RETURNING id, renter_id, owner_id, product_title, total_amount, deposit_amount, deposit, rental_fee`
    );

    for (const r of autoCancelled) {
      const refund  = parseFloat(r.total_amount || 0);
      const deposit = parseFloat(r.deposit_amount || r.deposit || 0);
      if (refund > 0) {
        /* Full refund: restore wallet + unfreeze deposit */
        await client.query(
          `UPDATE profiles SET
             wallet_balance = wallet_balance + $1,
             frozen_balance = GREATEST(0, frozen_balance - $2)
           WHERE id=$3`,
          [refund, deposit, r.renter_id]
        );
        await client.query(
          `INSERT INTO ledger (user_id, rental_id, type, amount, balance_after, description)
           SELECT $1, $2, 'refund', $3, wallet_balance, $4
           FROM profiles WHERE id=$1`,
          [r.renter_id, r.id, refund, `إلغاء تلقائي + استرداد كامل: ${r.product_title}`]
        );
      }
      await client.query(
        `UPDATE products SET
           available_quantity = LEAST(stock_quantity, available_quantity + 1),
           status = 'available'
         WHERE id = (SELECT product_id FROM rentals WHERE id=$1)`,
        [r.id]
      );
      await client.query(
        `INSERT INTO notifications (user_id, title, body, type) VALUES
           ($1,$3,$4,'rental'),
           ($2,$3,$5,'rental')`,
        [
          r.renter_id, r.owner_id,
          '❌ تم إلغاء الطلب تلقائياً',
          `لم يقبل المؤجر طلب "${r.product_title}" خلال 12 ساعة. تم استرداد ${refund.toLocaleString('ar-DZ')} دج (إيجار + ضمان) إلى محفظتك.`,
          `انتهت مهلة قبول طلب "${r.product_title}" (12 ساعة) وتم إلغاؤه تلقائياً.`,
        ]
      );
    }

    await client.query('COMMIT');
    res.json({
      lateMarked: lateRentals.length,
      depositsReleased: toRelease.length,
      autoCancelled: autoCancelled.length,
    });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

module.exports = router;
