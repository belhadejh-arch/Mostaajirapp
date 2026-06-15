const router = require('express').Router();
const { pool } = require('../db');
const { requireAdmin } = require('../middleware/auth');
const PDFDocument = require('pdfkit');

const PLATFORM_NAME = 'MOSTAJIR';
const DISCLAIMER = 'هذا التقرير سري ومخصص للإدارة فقط. جميع البيانات محمية بموجب سياسة الخصوصية.';

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('ar-DZ', { dateStyle: 'short', timeStyle: 'short' });
}

function formatAmount(n) {
  return (parseFloat(n) || 0).toLocaleString('ar-DZ') + ' دج';
}

function drawHeader(doc, title, reportNum) {
  doc.fontSize(18).font('Helvetica-Bold').text(PLATFORM_NAME, { align: 'center' });
  doc.fontSize(11).font('Helvetica').text(title, { align: 'center' });
  doc.fontSize(8).fillColor('#888').text(`رقم التقرير: ${reportNum}  |  تاريخ التصدير: ${new Date().toLocaleString('ar-DZ')}`, { align: 'center' });
  doc.fillColor('#000').moveDown(0.5);
  doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke();
  doc.moveDown(0.5);
}

function drawFooter(doc) {
  const bottom = doc.page.height - 40;
  doc.fontSize(7).fillColor('#aaa')
    .text(DISCLAIMER, 50, bottom, { width: doc.page.width - 100, align: 'center' });
  doc.fillColor('#000');
}

function addPageNumbers(doc) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.fontSize(7).fillColor('#aaa')
      .text(`${i + 1} / ${range.count}`, 0, doc.page.height - 30, { align: 'center', width: doc.page.width });
    drawFooter(doc);
  }
  doc.fillColor('#000');
}

/* ─────────────────────────────────────────────
   GET /api/pdf/wallet-ledger
   Wallet Ledger Report per user
───────────────────────────────────────────── */
router.get('/wallet-ledger', requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT l.*, p.name AS user_name, p.phone AS user_phone, u.email,
              r.product_title
       FROM ledger l
       LEFT JOIN profiles p ON p.id = l.user_id
       LEFT JOIN users u ON u.id = l.user_id
       LEFT JOIN rentals r ON r.id = l.rental_id
       ORDER BY l.user_id, l.created_at DESC
       LIMIT 1000`
    );

    const doc = new PDFDocument({ autoFirstPage: true, bufferPages: true, margin: 40 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="wallet-ledger.pdf"');
    doc.pipe(res);

    const reportNum = `WL-${Date.now()}`;
    drawHeader(doc, 'تقرير حركة المحافظ — Wallet Ledger', reportNum);

    if (rows.length === 0) {
      doc.fontSize(11).text('لا توجد معاملات بعد.', { align: 'center' });
    } else {
      const grouped = {};
      for (const row of rows) {
        const key = row.user_id;
        if (!grouped[key]) grouped[key] = { name: row.user_name, phone: row.user_phone, email: row.email, rows: [] };
        grouped[key].rows.push(row);
      }

      const TYPE_LABELS = {
        deposit_topup: 'إيداع',
        rental_payment: 'دفع إيجار',
        deposit_freeze: 'تجميد ضمان',
        deposit_unfreeze: 'فك تجميد',
        payout_owner: 'دخل مؤجر',
        late_penalty: 'غرامة تأخير',
        platform_fee: 'عمولة منصة',
        dispute_deduction: 'خصم نزاع',
        deposit_release: 'إفراج ضمان',
      };

      for (const [, user] of Object.entries(grouped)) {
        doc.fontSize(11).font('Helvetica-Bold').text(`${user.name} — ${user.phone}`, { underline: true });
        doc.fontSize(8).font('Helvetica').fillColor('#555').text(user.email || '').fillColor('#000');
        doc.moveDown(0.3);

        const cols = [50, 120, 200, 280, 380, 480];
        const headers = ['التاريخ', 'النوع', 'المنتج', 'المبلغ', 'الرصيد بعد', 'الوصف'];
        doc.fontSize(8).font('Helvetica-Bold');
        headers.forEach((h, i) => doc.text(h, cols[i], doc.y, { width: 80, continued: i < headers.length - 1 }));
        doc.font('Helvetica').moveDown(0.2);
        doc.moveTo(50, doc.y).lineTo(560, doc.y).lineWidth(0.5).stroke().lineWidth(1);
        doc.moveDown(0.2);

        for (const r of user.rows) {
          const isDebit = ['rental_payment','deposit_freeze','late_penalty','platform_fee','dispute_deduction'].includes(r.type);
          doc.fontSize(7).fillColor(isDebit ? '#c0392b' : '#27ae60');
          const vals = [
            formatDate(r.created_at),
            TYPE_LABELS[r.type] || r.type,
            (r.product_title || '').slice(0, 18),
            (isDebit ? '- ' : '+ ') + formatAmount(r.amount),
            formatAmount(r.balance_after),
            (r.description || '').slice(0, 25),
          ];
          vals.forEach((v, i) => doc.text(v, cols[i], doc.y, { width: 80, continued: i < vals.length - 1 }));
          doc.fillColor('#000').moveDown(0.15);
        }

        doc.moveDown(0.8);
        if (doc.y > doc.page.height - 150) doc.addPage();
      }
    }

    addPageNumbers(doc);
    doc.end();
  } catch (e) {
    console.error(e);
    if (!res.headersSent) res.status(500).json({ error: 'PDF generation failed' });
  }
});

/* ─────────────────────────────────────────────
   GET /api/pdf/operations
   Operations Report
───────────────────────────────────────────── */
router.get('/operations', requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT r.*,
              p_owner.name AS owner_full_name, p_owner.phone AS owner_phone_num,
              p_renter.name AS renter_full_name, p_renter.phone AS renter_phone_num
       FROM rentals r
       LEFT JOIN profiles p_owner ON p_owner.id = r.owner_id
       LEFT JOIN profiles p_renter ON p_renter.id = r.renter_id
       ORDER BY r.created_at DESC
       LIMIT 500`
    );

    const doc = new PDFDocument({ autoFirstPage: true, bufferPages: true, margin: 40, layout: 'landscape' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="operations-report.pdf"');
    doc.pipe(res);

    const reportNum = `OP-${Date.now()}`;
    drawHeader(doc, 'تقرير العمليات التشغيلية — Operations Report', reportNum);

    const STATUS_LABELS = {
      pending_owner: 'انتظار موافقة',
      accepted: 'مقبول',
      active: 'نشط',
      completed: 'مكتمل',
      cancelled: 'ملغى',
      late: 'متأخر',
      disputed: 'نزاع',
    };
    const STATUS_COLORS = {
      completed: '#27ae60',
      active: '#2980b9',
      late: '#e67e22',
      disputed: '#c0392b',
      cancelled: '#95a5a6',
    };

    const cols = [30, 130, 230, 310, 390, 460, 530, 610, 680];
    const headers = ['المنتج', 'المستأجر', 'المؤجر', 'المدة', 'إيجار', 'ضمان', 'عمولة', 'الحالة', 'التاريخ'];
    doc.fontSize(8).font('Helvetica-Bold');
    headers.forEach((h, i) => doc.text(h, cols[i], doc.y, { width: 90, continued: i < headers.length - 1 }));
    doc.moveDown(0.2);
    doc.moveTo(30, doc.y).lineTo(doc.page.width - 30, doc.y).lineWidth(0.5).stroke().lineWidth(1);
    doc.moveDown(0.2);

    for (const r of rows) {
      const color = STATUS_COLORS[r.status] || '#000';
      doc.fontSize(7).font('Helvetica').fillColor('#000');
      const vals = [
        (r.product_title || '').slice(0, 18),
        (r.renter_full_name || r.renter_name || '').slice(0, 14),
        (r.owner_full_name || r.owner_name || '').slice(0, 14),
        `${r.duration_hours || (r.duration_days || 1) * 24}س`,
        formatAmount(r.rental_fee || r.total_amount),
        formatAmount(r.deposit_amount || r.deposit),
        formatAmount(r.platform_fee || r.commission_amount),
        STATUS_LABELS[r.status] || r.status,
        formatDate(r.created_at),
      ];
      vals.forEach((v, i) => {
        if (i === 7) doc.fillColor(color);
        else doc.fillColor('#000');
        doc.text(v, cols[i], doc.y, { width: 90, continued: i < vals.length - 1 });
      });
      doc.fillColor('#000').moveDown(0.2);
      if (doc.y > doc.page.height - 80) doc.addPage();
    }

    addPageNumbers(doc);
    doc.end();
  } catch (e) {
    console.error(e);
    if (!res.headersSent) res.status(500).json({ error: 'PDF generation failed' });
  }
});

/* ─────────────────────────────────────────────
   GET /api/pdf/financial-summary
   Financial Summary Report
───────────────────────────────────────────── */
router.get('/financial-summary', requireAdmin, async (req, res) => {
  try {
    const [
      { rows: [totals] },
      { rows: monthly },
      { rows: byType },
    ] = await Promise.all([
      pool.query(`
        SELECT
          COALESCE(SUM(CASE WHEN type='platform_fee' THEN amount END),0) AS platform_fees,
          COALESCE(SUM(CASE WHEN type='late_penalty' THEN amount END),0) AS late_penalties,
          COALESCE(SUM(CASE WHEN type='rental_payment' THEN amount END),0) AS rental_volume,
          COALESCE(SUM(CASE WHEN type='deposit_freeze' THEN amount END),0) AS total_frozen,
          COALESCE(SUM(CASE WHEN type='deposit_release' THEN amount END),0) AS total_released
        FROM ledger`),
      pool.query(`
        SELECT
          DATE_TRUNC('month', created_at) AS month,
          COALESCE(SUM(CASE WHEN type='platform_fee' THEN amount END),0) AS fees,
          COALESCE(SUM(CASE WHEN type='rental_payment' THEN amount END),0) AS volume,
          COUNT(DISTINCT CASE WHEN type='rental_payment' THEN rental_id END) AS rentals
        FROM ledger
        WHERE created_at > now() - interval '6 months'
        GROUP BY 1 ORDER BY 1 DESC`),
      pool.query(`
        SELECT type, COUNT(*) AS count, SUM(amount) AS total
        FROM ledger GROUP BY type ORDER BY total DESC`),
    ]);

    const doc = new PDFDocument({ autoFirstPage: true, bufferPages: true, margin: 40 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="financial-summary.pdf"');
    doc.pipe(res);

    const reportNum = `FS-${Date.now()}`;
    drawHeader(doc, 'التقرير المالي العام — Financial Summary', reportNum);

    /* KPIs */
    doc.fontSize(11).font('Helvetica-Bold').text('المؤشرات الرئيسية:').moveDown(0.3);
    const kpis = [
      ['إجمالي أرباح المنصة (عمولات)', formatAmount(totals.platform_fees)],
      ['إجمالي حجم الإيجارات', formatAmount(totals.rental_volume)],
      ['إجمالي غرامات التأخير', formatAmount(totals.late_penalties)],
      ['إجمالي الضمانات المجمدة', formatAmount(totals.total_frozen)],
      ['إجمالي الضمانات المُفرج عنها', formatAmount(totals.total_released)],
    ];
    doc.font('Helvetica').fontSize(10);
    for (const [label, val] of kpis) {
      doc.text(`${label}: `, { continued: true }).font('Helvetica-Bold').text(val).font('Helvetica');
    }
    doc.moveDown(0.8);

    /* Monthly table */
    doc.fontSize(11).font('Helvetica-Bold').text('الأداء الشهري (آخر 6 أشهر):').moveDown(0.3);
    const cols = [50, 180, 310, 420];
    const headers = ['الشهر', 'حجم الإيجارات', 'أرباح المنصة', 'عدد العمليات'];
    doc.fontSize(9);
    headers.forEach((h, i) => doc.text(h, cols[i], doc.y, { width: 130, continued: i < headers.length - 1 }));
    doc.moveDown(0.2);
    doc.moveTo(50, doc.y).lineTo(560, doc.y).lineWidth(0.5).stroke().lineWidth(1);
    doc.moveDown(0.2);
    doc.font('Helvetica').fontSize(8);
    for (const m of monthly) {
      const row = [
        new Date(m.month).toLocaleDateString('ar-DZ', { month: 'long', year: 'numeric' }),
        formatAmount(m.volume),
        formatAmount(m.fees),
        m.rentals.toString(),
      ];
      row.forEach((v, i) => doc.text(v, cols[i], doc.y, { width: 130, continued: i < row.length - 1 }));
      doc.moveDown(0.25);
    }
    doc.moveDown(0.8);

    /* By type */
    doc.fontSize(11).font('Helvetica-Bold').text('توزيع العمليات حسب النوع:').moveDown(0.3);
    const TYPE_LABELS = {
      deposit_topup: 'إيداع رصيد',
      rental_payment: 'دفع إيجار',
      deposit_freeze: 'تجميد ضمان',
      deposit_unfreeze: 'فك تجميد',
      payout_owner: 'دخل المؤجر',
      late_penalty: 'غرامة تأخير',
      platform_fee: 'عمولة منصة',
      dispute_deduction: 'خصم نزاع',
      deposit_release: 'إفراج ضمان',
    };
    doc.font('Helvetica').fontSize(8);
    for (const t of byType) {
      doc.text(`${TYPE_LABELS[t.type] || t.type}: ${t.count} عملية — ${formatAmount(t.total)}`);
      doc.moveDown(0.2);
    }

    addPageNumbers(doc);
    doc.end();
  } catch (e) {
    console.error(e);
    if (!res.headersSent) res.status(500).json({ error: 'PDF generation failed' });
  }
});

module.exports = router;
