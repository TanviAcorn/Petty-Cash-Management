const express = require('express');
const router = express.Router();
const sql = require('mssql');
const multer = require('multer');
const path = require('path');
const { getExchangeRate } = require('../utils/exchangeRates');
const fs = require('fs');
const { poolPromise } = require('../config/db');
const { sendEmail, buildAdminNewRequestEmail, buildUserStatusEmail, buildPaymentInitiatedEmail } = require('../utils/mailer');
const { getUserById } = require('../utils/userUtils');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// GET payments for a request
router.get('/:id/payments', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: 'Invalid id' });
    const pool = await poolPromise;
    await ensurePaymentsSchema(pool);
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query(`SELECT * FROM petty_cash_payments WHERE request_id = @id ORDER BY created_at DESC`);
    return res.json({ data: result.recordset || [] });
  } catch (err) {
    console.error('Error fetching payments by request:', err);
    return res.status(500).json({ message: 'Failed to fetch payments' });
  }
});

// GET all payments (list for Payments tab)
router.get('/payments/list', async (_req, res) => {
  try {
    const pool = await poolPromise;
    await ensurePaymentsSchema(pool);
    const result = await pool.request().query(`
      SELECT 
        p.id AS paymentId,
        p.request_id AS requestId,
        p.method,
        p.reference,
        p.paid_amount AS paidAmount,
        p.paid_date AS paidDate,
        p.notes,
        p.status,
        p.receipt_filename AS receiptFilename,
        p.created_at AS createdAt,
        p.created_by_email AS createdByEmail,
        p.sent_to_payment AS sentToPayment,
        r.employee_name AS employeeName,
        r.employee_email AS employeeEmail,
        r.company_name AS company,
        r.category_name AS category,
        r.location,
        r.amount,
        r.status AS requestStatus
      FROM petty_cash_payments p
      JOIN petty_cash_requests r ON r.id = p.request_id
      ORDER BY p.created_at DESC`);
    // Return the recordset directly as an array
    return res.json(result.recordset || []);
  } catch (err) {
    console.error('Error fetching payments list:', err);
    return res.status(500).json({ message: 'Failed to fetch payments list' });
  }
});

// Mark payment as done with optional receipt upload
const receiptUpload = multer({ storage });
router.post('/:id/payment-done', receiptUpload.array('receipts', 5), async (req, res) => {
  const pool = await poolPromise;
  const txn = new sql.Transaction(pool);
  
  try {
    const id = Number(req.params.id);
    console.log(`Processing payment completion for request ID: ${id}`);
    if (!id) return res.status(400).json({ message: 'Invalid id' });
    
    await txn.begin();
    
    // First, get the request details including location and amount
    const requestResult = await new sql.Request(txn)
      .input('id', sql.Int, id)
      .query(`
        SELECT r.amount, r.currency, r.location, l.id as locationId 
        FROM petty_cash_requests r
        LEFT JOIN petty_Locations l ON r.location = l.location
        WHERE r.id = @id
      `);
      
    if (requestResult.recordset.length === 0) {
      await txn.rollback();
      return res.status(404).json({ message: 'Request not found' });
    }
    
    const request = requestResult.recordset[0];
    const receiptFilenames = req.files && req.files.length > 0 ? JSON.stringify(req.files.map(f => f.filename)) : null;
    
    // Update the payment record
    await new sql.Request(txn)
      .input('id', sql.Int, id)
      .input('receipt', sql.NVarChar(sql.MAX), receiptFilenames)
      .query(`
        UPDATE p 
        SET status = 'payment done', 
            receipt_filename = @receipt
        FROM petty_cash_payments p
        WHERE p.id = (
          SELECT TOP 1 id FROM petty_cash_payments WHERE request_id = @id ORDER BY created_at DESC
        )
      `);
    
    // Update the request status
    await new sql.Request(txn)
      .input('id', sql.Int, id)
      .query(`
        UPDATE petty_cash_requests
        SET status = 'payment done'
        WHERE id = @id
      `);
    
    // Update the location's used amount if location exists
    if (request.locationId) {
      const exchangeRate = await getExchangeRate(request.currency || 'GBP', 'GBP');
      const amountInGBP = parseFloat(request.amount) / exchangeRate;
      
      await new sql.Request(txn)
        .input('id', sql.Int, request.locationId)
        .input('amount', sql.Decimal(10, 2), amountInGBP)
        .query(`
          UPDATE petty_Locations 
          SET used_amount = ISNULL(used_amount, 0) + @amount,
              remaining_amount = 30 - (ISNULL(used_amount, 0) + @amount)
          WHERE id = @id
          AND (30 - (ISNULL(used_amount, 0) + @amount)) >= 0;
          
          IF @@ROWCOUNT = 0
          BEGIN
            THROW 50001, 'Insufficient budget for this location', 1;
          END
        `);
        
      console.log(`Updated budget for location ${request.location} (ID: ${request.locationId})`);
    }
    
    await txn.commit();
    return res.json({ message: 'Payment marked as done', receipts: receiptFilenames ? JSON.parse(receiptFilenames) : [] });
    
  } catch (err) {
    console.error('Error marking payment done:', err);
    try {
      await txn.rollback();
    } catch (rollbackErr) {
      console.error('Error rolling back transaction:', rollbackErr);
    }
    
    if (err.number === 50001) {
      return res.status(400).json({ message: err.message || 'Insufficient budget for this location' });
    }
    return res.status(500).json({ message: 'Failed to mark payment done' });
  }
});

// PUT /api/requests/:id - Update a request (only when pending)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { company, category, location, amount, description, dateOfPurchase } = req.body || {};

    const pool = await poolPromise;
    // Ensure request is pending
    const statusCheck = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT status FROM petty_cash_requests WHERE id = @id');
    const curStatus = (statusCheck.recordset?.[0]?.status || '').toLowerCase();
    if (curStatus !== 'pending') {
      return res.status(400).json({ message: 'Request can only be edited while pending' });
    }

    const reqUpd = pool.request()
      .input('id', sql.Int, id)
      .input('company', sql.NVarChar(200), company ?? null)
      .input('category', sql.NVarChar(200), category ?? null)
      .input('location', sql.NVarChar(200), location ?? null)
      .input('amount', sql.Decimal(18,2), amount != null ? Number(amount) : null)
      .input('reason', sql.NVarChar(sql.MAX), description ?? null)
      .input('dateOfPurchase', sql.Date, dateOfPurchase ? new Date(dateOfPurchase) : null);

    await reqUpd.query(`
      UPDATE petty_cash_requests
      SET 
        company_name = COALESCE(@company, company_name),
        category_name = COALESCE(@category, category_name),
        location = COALESCE(@location, location),
        amount = COALESCE(@amount, amount),
        reason = COALESCE(@reason, reason),
        date_of_purchase = COALESCE(@dateOfPurchase, date_of_purchase)
      WHERE id = @id;
    `);

    const result = await pool.request().input('id', sql.Int, id).query('SELECT * FROM petty_cash_requests WHERE id = @id');
    return res.json({ message: 'Request updated', data: result.recordset?.[0] });
  } catch (err) {
    console.error('Error updating request:', err);
    return res.status(500).json({ message: 'Failed to update request' });
  }
});

// DELETE /api/requests/:id - Delete a request (only when pending)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await poolPromise;
    // Only delete if pending
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query(`
        DELETE FROM petty_cash_requests WHERE id = @id AND LOWER(status) = 'pending';
        SELECT @@ROWCOUNT AS affected;
      `);
    const affected = result.recordset?.[0]?.affected || 0;
    if (!affected) return res.status(400).json({ message: 'Only pending requests can be deleted or request not found' });
    return res.json({ message: 'Request deleted' });
  } catch (err) {
    console.error('Error deleting request:', err);
    return res.status(500).json({ message: 'Failed to delete request' });
  }
});

// PUT /api/requests/:id/intercompany - Transfer to another company (only after payment done)
router.put('/:id/intercompany', async (req, res) => {
  try {
    const { id } = req.params;
    const { company, performedByEmail, performedByName, note } = req.body || {};
    if (!company || !String(company).trim()) {
      return res.status(400).json({ message: 'Target company is required' });
    }

    const pool = await poolPromise;

    // Validate request exists and that payment has been completed
    const reqRow = await pool.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT r.status AS requestStatus
        FROM petty_cash_requests r
        WHERE r.id = @id
      `);

    const requestStatus = (reqRow.recordset?.[0]?.requestStatus || '').toLowerCase();

    // Check latest payment status if payments table exists
    let latestPaymentStatus = null;
    try {
      const pay = await pool.request()
        .input('id', sql.Int, id)
        .query(`
          IF OBJECT_ID('dbo.petty_cash_payments','U') IS NOT NULL
          BEGIN
            SELECT TOP 1 status FROM petty_cash_payments WHERE request_id = @id ORDER BY created_at DESC
          END
          ELSE BEGIN
            SELECT CAST(NULL AS NVARCHAR(20)) AS status
          END
        `);
      latestPaymentStatus = (pay.recordset?.[0]?.status || '').toLowerCase();
    } catch {}

    if (requestStatus !== 'payment done' && latestPaymentStatus !== 'payment done') {
      return res.status(400).json({ message: 'Intercompany transfer is only allowed after payment has been marked as done by the original company' });
    }

    // Read previous company before update for audit trail
    const prev = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT company_name FROM petty_cash_requests WHERE id = @id');
    const previousCompany = prev.recordset?.[0]?.company_name || null;

    // Update request: change company and mark status as 'intercompany' so admins can find it easily
    await pool.request()
      .input('id', sql.Int, id)
      .input('company', sql.NVarChar(200), String(company).trim())
      .query(`
        UPDATE petty_cash_requests
        SET company_name = @company,
            status = 'intercompany'
        WHERE id = @id;
      `);

    // Ensure audit table exists
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='petty_cash_request_audits' AND xtype='U')
      BEGIN
        CREATE TABLE petty_cash_request_audits (
          id INT IDENTITY(1,1) PRIMARY KEY,
          request_id INT NOT NULL,
          action VARCHAR(50) NOT NULL,
          previous_company NVARCHAR(200) NULL,
          new_company NVARCHAR(200) NULL,
          performed_by_email NVARCHAR(320) NULL,
          performed_by_name NVARCHAR(200) NULL,
          note NVARCHAR(MAX) NULL,
          created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
        );
      END
    `);

    // Insert audit record
    await pool.request()
      .input('requestId', sql.Int, id)
      .input('previousCompany', sql.NVarChar(200), previousCompany)
      .input('newCompany', sql.NVarChar(200), String(company).trim())
      .input('performedByEmail', sql.NVarChar(320), performedByEmail || null)
      .input('performedByName', sql.NVarChar(200), performedByName || null)
      .input('note', sql.NVarChar(sql.MAX), note || null)
      .query(`
        INSERT INTO petty_cash_request_audits (request_id, action, previous_company, new_company, performed_by_email, performed_by_name, note)
        VALUES (@requestId, 'intercompany_transfer', @previousCompany, @newCompany, @performedByEmail, @performedByName, @note);
      `);

    const result = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT * FROM petty_cash_requests WHERE id = @id');

    return res.json({ message: 'Request approved with intercompany transfer', data: result.recordset?.[0] });
  } catch (err) {
    console.error('Error approving with intercompany transfer:', err);
    return res.status(500).json({ message: 'Failed to approve with intercompany transfer' });
  }
});

// GET /api/requests/:id - get single request by ID with full details
router.get('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: 'Invalid id' });

    const pool = await poolPromise;
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT 
          r.id,
          r.employee_name       AS employeeName,
          r.employee_email      AS employeeEmail,
          r.company_name        AS company,
          r.category_name       AS category,
          r.location            AS location,
          r.amount,
          r.currency,
          r.reason              AS description,
          COALESCE(p.status, r.status) AS status,
          r.created_at          AS createdAt,
          r.date_of_purchase    AS dateOfPurchase,
          r.approved_at         AS approvedAt,
          r.rejected_at         AS rejectedAt,
          r.rejection_reason    AS rejectionReason,
          r.attachments,
          p.status AS payment_status
        FROM petty_cash_requests r
        LEFT JOIN (
          SELECT request_id, status,
                 ROW_NUMBER() OVER (PARTITION BY request_id ORDER BY created_at DESC) as rn
          FROM petty_cash_payments
        ) p ON r.id = p.request_id AND (p.rn = 1 OR p.rn IS NULL)
        WHERE r.id = @id
      `);

    const row = result.recordset?.[0];
    if (!row) return res.status(404).json({ message: 'Request not found' });

    // Try to parse attachments JSON if present
    try {
      row.attachments = row.attachments ? JSON.parse(row.attachments) : [];
    } catch {
      row.attachments = [];
    }

    // Try to attach previous/new company from latest audit record (if audit table exists)
    try {
      const audit = await pool.request()
        .input('id', sql.Int, id)
        .query(`
          IF OBJECT_ID('dbo.petty_cash_request_audits','U') IS NOT NULL
          BEGIN
            SELECT TOP 1 previous_company AS previousCompany, new_company AS newCompany
            FROM petty_cash_request_audits
            WHERE request_id = @id AND action = 'intercompany_transfer'
            ORDER BY created_at DESC
          END
          ELSE
          BEGIN
            SELECT CAST(NULL AS NVARCHAR(200)) AS previousCompany, CAST(NULL AS NVARCHAR(200)) AS newCompany
          END
        `);
      const latest = audit.recordset?.[0];
      if (latest) {
        row.previousCompany = latest.previousCompany;
        row.newCompany = latest.newCompany;
      }
    } catch (e) {
      // ignore if table not present or other non-critical errors
    }

    return res.json({ data: row });
  } catch (err) {
    console.error('Error fetching request by id:', err);
    return res.status(500).json({ message: 'Failed to fetch request' });
  }
});

// File filter to allow only specific file types
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'application/pdf',
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/zip'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, JPG, PNG, DOC, DOCX, and ZIP files are allowed.'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit per file
    files: 5 // Maximum 5 files per upload
  }
});

// Ensure petty_cash_payments table and required columns exist
async function ensurePaymentsSchema(pool) {
  const sqlText = `
    IF OBJECT_ID('dbo.petty_cash_payments','U') IS NULL
    BEGIN
      CREATE TABLE dbo.petty_cash_payments (
        id INT IDENTITY(1,1) PRIMARY KEY,
        request_id INT NOT NULL,
        method NVARCHAR(100) NOT NULL,
        reference NVARCHAR(200) NULL,
        paid_amount DECIMAL(18,2) NULL,
        paid_date DATETIME2 NULL,
        notes NVARCHAR(MAX) NULL,
        status NVARCHAR(20) NOT NULL DEFAULT 'pending',
        receipt_filename NVARCHAR(500) NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        created_by_email NVARCHAR(320) NULL
      );
    END;
    -- Add missing columns if table already existed
    IF COL_LENGTH('dbo.petty_cash_payments', 'status') IS NULL
    BEGIN
      ALTER TABLE dbo.petty_cash_payments ADD status NVARCHAR(20) NULL;
      UPDATE dbo.petty_cash_payments SET status = 'pending' WHERE status IS NULL;
      ALTER TABLE dbo.petty_cash_payments ALTER COLUMN status NVARCHAR(20) NOT NULL;
    END;
    IF COL_LENGTH('dbo.petty_cash_payments', 'receipt_filename') IS NULL
    BEGIN
      ALTER TABLE dbo.petty_cash_payments ADD receipt_filename NVARCHAR(MAX) NULL;
    END;
    IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'petty_cash_payments' AND COLUMN_NAME = 'receipt_filename' AND DATA_TYPE = 'nvarchar' AND CHARACTER_MAXIMUM_LENGTH = 500)
    BEGIN
        ALTER TABLE dbo.petty_cash_payments ALTER COLUMN receipt_filename NVARCHAR(MAX) NULL;
    END;
  `;
  await pool.request().query(sqlText);
}

// GET /api/requests
router.get('/', async (req, res) => {
  const { status, q, company, category, range, email, location } = req.query;

  // Build dynamic WHERE clause safely
  const where = [];
  const params = {};

  if (status) {
    if (Array.isArray(status)) {
      const statusParams = status.map((s, i) => {
        const param = `status${i}`;
        params[param] = { type: sql.VarChar(20), value: String(s) };
        return `LOWER(r.status) = LOWER(@${param})`;
      });
      where.push(`(${statusParams.join(' OR ')})`);
    } else {
      where.push('LOWER(r.status) = LOWER(@status)');
      params.status = { type: sql.VarChar(20), value: String(status) };
    }
  }
  if (company) {
    where.push('r.company_name = @company');
    params.company = { type: sql.NVarChar(200), value: String(company) };
  }
  if (category) {
    where.push('r.category_name = @category');
    params.category = { type: sql.NVarChar(200), value: String(category) };
  }
  if (location) {
    where.push('r.location = @location');
    params.location = { type: sql.NVarChar(200), value: String(location) };
  }
  if (email) {
    where.push('LOWER(LTRIM(RTRIM(r.employee_email))) = LOWER(LTRIM(RTRIM(@email)))');
    params.email = { type: sql.NVarChar(320), value: String(email) };
  }
  if (q) {
    where.push("(LOWER(r.employee_name) LIKE @q OR LOWER(r.employee_email) LIKE @q OR LOWER(r.company_name) LIKE @q OR LOWER(r.category_name) LIKE @q OR LOWER(ISNULL(r.reason, '')) LIKE @q)");
    params.q = { type: sql.NVarChar(400), value: `%${String(q).toLowerCase()}%` };
  }
  // pick date column for date range and ordering
  const dateCol = status === 'rejected' ? 'r.rejected_at' : status === 'approved' ? 'r.approved_at' : 'r.created_at';
  if (range && range !== 'all') {
    if (range === '7d') where.push(`${dateCol} >= DATEADD(day, -7, SYSUTCDATETIME())`);
    else if (range === '30d') where.push(`${dateCol} >= DATEADD(day, -30, SYSUTCDATETIME())`);
    else if (range === 'year') where.push(`YEAR(${dateCol}) = YEAR(SYSUTCDATETIME())`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  // Build ORDER BY avoiding duplicate columns when dateCol is r.created_at
  const orderParts = [
    `CASE WHEN ${dateCol} IS NULL THEN 1 ELSE 0 END`,
    `${dateCol} DESC`,
  ];
  if (dateCol !== 'r.created_at') {
    orderParts.push('r.created_at DESC');
  }

  const query = `
    SELECT 
      r.id,
      r.employee_name AS employeeName,
      r.employee_email AS employeeEmail,
      r.company_name AS company,
      r.category_name AS category,
      r.location AS location,
      r.amount,
      r.currency,
      r.date_of_purchase AS dateOfPurchase,
      r.created_at AS date, -- original request date
      r.approved_at AS approvedAt,
      r.rejected_at AS rejectedAt,
      r.status,
      r.reason
    FROM petty_cash_requests r
    ${whereSql}
    ORDER BY ${orderParts.join(', ')}
  `;

  try {
    const pool = await poolPromise;
    const request = pool.request();
    Object.entries(params).forEach(([key, { type, value }]) => request.input(key, type, value));
    const result = await request.query(query);
    return res.json({ data: result.recordset || [] });
  } catch (err) {
    console.error('Error fetching requests:', err);
    return res.status(500).json({ message: 'Failed to fetch requests' });
  }
});

// POST /api/requests/:id/proceed-payment - capture payment details and notify payments team
router.post('/:id/proceed-payment', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: 'Invalid id' });

    const { method, reference, paidAmount, paidDate, notes, adminEmail } = req.body || {};
    if (!method) return res.status(400).json({ message: 'Payment method is required' });

    const pool = await poolPromise;

    // Ensure the request exists and is approved
    const { recordset } = await pool.request().input('id', sql.Int, id).query('SELECT * FROM petty_cash_requests WHERE id = @id');
    const row = recordset?.[0];
    if (!row) return res.status(404).json({ message: 'Request not found' });
    if (String(row.status).toLowerCase() !== 'approved' && String(row.status).toLowerCase() !== 'intercompany') {
      return res.status(400).json({ message: 'Proceed to Payment is only allowed for approved requests' });
    }

    // Ensure payments schema is present
    await ensurePaymentsSchema(pool);

    // Insert payment record and update sent_to_payment flag
    await pool.request()
      .input('requestId', sql.Int, id)
      .input('method', sql.NVarChar(100), String(method))
      .input('reference', sql.NVarChar(200), reference || null)
      .input('paidAmount', sql.Decimal(18,2), paidAmount != null ? Number(paidAmount) : null)
      .input('paidDate', sql.DateTime2, paidDate ? new Date(paidDate) : null)
      .input('notes', sql.NVarChar(sql.MAX), notes || null)
      .input('adminEmail', sql.NVarChar(320), adminEmail || null)
      .query(`
        BEGIN TRANSACTION;
        
        -- Insert payment record
        INSERT INTO petty_cash_payments (request_id, method, reference, paid_amount, paid_date, notes, status, created_by_email, sent_to_payment)
        VALUES (@requestId, @method, @reference, @paidAmount, @paidDate, @notes, 'processing', @adminEmail, 1);
        
        -- Update the request to mark it as sent to payment
        UPDATE petty_cash_requests 
        SET status = 'processing'
        WHERE id = @requestId;
        
        COMMIT TRANSACTION;
      `);

    // NOTE: Do NOT change request status; keep as 'approved' so it remains in Approved tab

    // Send a single email with multiple recipients
    try {
      const toRecipients = [
        'Payment@acornuniversalconsultancy.com',
        'posting@acornuniversalconsultancy.com'
      ];
      const ccRecipients = ['ishika.gupta@astutehealthcare.co.uk'];

      // Build the email content
      const email = buildPaymentInitiatedEmail({ 
        request: row, 
        payment: { 
          method, 
          reference, 
          paidAmount, 
          paidDate, 
          notes,
          processedBy: adminEmail || 'System'
        } 
      });

      await sendEmail({
        to: toRecipients,
        cc: ccRecipients,
        subject: email.subject,
        html: email.html,
        replyTo: adminEmail || process.env.ADMIN_EMAIL
      });

      console.log('Payment notification email sent to all recipients in a single message');
    } catch (e) {
      console.error('Error sending payment notification emails:', e);
      // Don't fail the request if email sending fails
    }

    return res.json({ message: 'Payment initiated and team notified' });
  } catch (err) {
    console.error('Error in proceed-payment:', err);
    return res.status(500).json({ message: 'Failed to proceed payment', error: err.message });
  }
});

// POST /api/requests - create a new petty cash request with file uploads
router.post('/', upload.array('attachments', 5), async (req, res) => {
  try {
    console.log('=== NEW REQUEST SUBMISSION ===');
    console.log('Request body:', req.body);
    console.log('Files received:', req.files ? req.files.length : 0);
    
    const {
      employeeName,
      employeeEmail,
      company,
      category,
      amount,
      currency,
      description,
      dateOfPurchase,
      location
    } = req.body || {};

    console.log('Extracted fields:', {
      employeeName,
      employeeEmail,
      company,
      category,
      amount,
      currency,
      description,
      dateOfPurchase,
      location
    });

    if (!employeeName || !employeeEmail || !category || !amount) {
      console.log('Validation failed - missing required fields');
      return res.status(400).json({ message: 'Missing required fields: employeeName, employeeEmail, category, or amount' });
    }

    const pool = await poolPromise;
    const request = pool.request()
      .input('employeeName', sql.NVarChar(200), String(employeeName))
      .input('employeeEmail', sql.NVarChar(320), String(employeeEmail))
      .input('company', sql.NVarChar(200), company ? String(company) : null)
      .input('category', sql.NVarChar(200), String(category))
      .input('amount', sql.Decimal(18, 2), Number(amount))
      .input('currency', sql.NVarChar(10), String(currency))
      .input('dateOfPurchase', sql.Date, dateOfPurchase ? new Date(dateOfPurchase) : null)
      .input('location', sql.NVarChar(200), location ? String(location) : null)
      // FIX: Map description field from frontend to reason field in the database
      .input('reason', sql.NVarChar(sql.MAX), description ? String(description) : null)
      .input('status', sql.VarChar(20), 'pending');

    let attachmentPaths = [];
    if (req.files && req.files.length > 0) {
      attachmentPaths = req.files.map(file => ({
        originalName: file.originalname,
        filename: file.filename,
        path: file.path,
        size: file.size,
        mimetype: file.mimetype
      }));
    }

    const attachmentsJson = JSON.stringify(attachmentPaths);
    request.input('attachments', sql.NVarChar(sql.MAX), attachmentsJson);

    console.log('About to execute SQL insert...');
    const insertSql = `
      INSERT INTO petty_cash_requests (employee_name, employee_email, company_name, category_name, amount, currency, location, status, reason, created_at, approved_at, rejected_at, attachments, date_of_purchase)
      OUTPUT INSERTED.*
      VALUES (@employeeName, @employeeEmail, @company, @category, @amount, @currency, @location, @status, @reason, SYSUTCDATETIME(), NULL, NULL, @attachments, @dateOfPurchase)
    `;

    const result = await request.query(insertSql);
    console.log('SQL insert successful:', result.recordset?.[0]);
    const newRequest = result.recordset?.[0] || null;
    
    if (newRequest) {
      // Optional: Add the uploaded file info to the response
      newRequest.uploadedFiles = attachmentPaths;
      
      // Update location budget if location is provided
      if (location) {
        try {
          // First, find the location ID
          const locationResult = await pool.request()
            .input('location', sql.NVarChar(200), location)
            .query('SELECT id FROM petty_Locations WHERE location = @location');
            
          if (locationResult.recordset.length > 0) {
            const locationId = locationResult.recordset[0].id;
            // We'll update the budget when payment is marked as done
            console.log(`Location ID ${locationId} will be updated when payment is completed`);
          }
        } catch (error) {
          console.error('Error updating location budget:', error);
          // Don't fail the request if budget update fails
        }
      }
    }
    // Send admin notification email (non-blocking)
    try {
      const adminTo = process.env.ADMIN_EMAIL;
      if (adminTo) {
        const { subject, html } = buildAdminNewRequestEmail(newRequest);
        // Office 365 typically requires From to be the authenticated mailbox.
        // Use configured sender as From and employee as Reply-To.
        const replyTo = newRequest?.employee_email || employeeEmail;
        sendEmail({ to: adminTo, subject, html, replyTo })
          .catch((e) => console.error('Failed sending admin email:', e.message));
      } else {
        console.warn('ADMIN_EMAIL is not set; skipping admin notification');
      }
    } catch (e) {
      console.error('Admin email error:', e);
    }

    return res.status(201).json(newRequest);
  } catch (err) {
    console.error('Error creating request:', err);
    
    if (req.files) {
      req.files.forEach(file => {
        try {
          fs.unlinkSync(file.path);
        } catch (unlinkErr) {
          console.error('Error deleting file:', unlinkErr);
        }
      });
    }
    
    return res.status(500).json({ message: 'Failed to create request' });
  }
});

// The approve and reject functionality has been consolidated into the PUT /:id/status endpoint

// PUT /api/requests/:id/status - Update request status (approve/reject)
router.put('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, rejectionReason, approvalReason } = req.body;
    
    if (!['approved', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status. Must be one of: approved, rejected, pending' });
    }

    const pool = await poolPromise;
    const request = pool.request()
      .input('id', sql.Int, id)
      .input('status', sql.VarChar(20), status);

    let updateSql = 'UPDATE petty_cash_requests SET status = @status';
    
    // Set approved_at, rejected_at, and date_of_approve_reject based on status
    if (status === 'approved') {
      updateSql += ', approved_at = SYSUTCDATETIME(), rejected_at = NULL, date_of_approve_reject = SYSUTCDATETIME()';
      if (approvalReason) {
        updateSql += ', reason = @approvalReason';
        request.input('approvalReason', sql.NVarChar(sql.MAX), approvalReason);
      }
    } else if (status === 'rejected') {
      updateSql += ', rejected_at = SYSUTCDATETIME(), approved_at = NULL, date_of_approve_reject = SYSUTCDATETIME()';
      if (rejectionReason) {
        updateSql += ', rejection_reason = @rejectionReason';
        request.input('rejectionReason', sql.NVarChar(sql.MAX), rejectionReason);
      }
    } else {
      updateSql += ', approved_at = NULL, rejected_at = NULL, date_of_approve_reject = NULL';
    }

    updateSql += ' WHERE id = @id;';
    
    await request.query(updateSql);
    
    // Return the updated request with all fields including the rejection reason
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT 
          r.*,
          CASE 
            WHEN r.status = 'rejected' THEN r.rejection_reason 
            WHEN r.status = 'approved' AND r.reason IS NOT NULL THEN r.reason
            ELSE NULL 
          END as reason
        FROM petty_cash_requests r 
        WHERE r.id = @id
      `);
    const row = result.recordset[0];

    // Notify requester on status change
    try {
      const recipient = row?.employee_email || row?.employeeEmail || null;
      console.log('[MAIL][status] to:', recipient, 'status:', row?.status, 'id:', id, 'reason:', row?.rejection_reason || row?.reason || 'none');
      if (recipient) {
        const { subject, html } = buildUserStatusEmail(row);
        await sendEmail({ to: recipient, subject, html });
      } else {
        console.warn('[MAIL][status] missing employee email for request id', id);
      }
    } catch (e) { 
      console.error('[MAIL][status] error:', e);
    }

    return res.json({ 
      message: `Request ${status} successfully`,
      data: row 
    });
    
  } catch (err) {
    console.error('Error updating request status:', err);
    return res.status(500).json({ 
      message: 'Failed to update request status',
      error: err.message 
    });
  }
});

// GET /api/requests/status/:status - Get requests by status
router.get('/status/:status', async (req, res) => {
  try {
    const { status } = req.params;
    
    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status. Must be one of: pending, approved, rejected' });
    }

    const pool = await poolPromise;
    const result = await pool.request()
      .input('status', sql.VarChar(20), status)
      .query(`
        SELECT 
          r.*,
          p.status AS payment_status,
          p.status AS display_status
        FROM petty_cash_requests r
        LEFT JOIN (
          SELECT request_id, status, 
                 ROW_NUMBER() OVER (PARTITION BY request_id ORDER BY created_at DESC) as rn
          FROM petty_cash_payments
        ) p ON r.id = p.request_id AND (p.rn = 1 OR p.rn IS NULL)
        WHERE r.status = @status 
        ORDER BY r.created_at DESC
      `);
    
    return res.json({ data: result.recordset });
  } catch (err) {
    console.error('Error fetching requests by status:', err);
    return res.status(500).json({ message: 'Failed to fetch requests' });
  }
});

// GET /api/categories - Fetches all categories from the petty_Categories table
router.get('/categories', async (req, res) => {
  try {
    await sql.connect(sqlConfig);
    const result = await sql.query`SELECT id, name FROM petty_Categories ORDER BY name`;
    res.status(200).json(result.recordset);
  } catch (err) {
    console.error('Database query failed: ', err);
    res.status(500).json({ message: 'Error fetching categories.' });
  } finally {
    sql.close();
  }
});

// GET /api/companies - Fetches all companies from the petty_Companies table
router.get('/companies', async (req, res) => {
  try {
    await sql.connect(sqlConfig);
    const result = await sql.query`SELECT id, name FROM petty_Companies ORDER BY name`;
    res.status(200).json(result.recordset);
  } catch (err) {
    console.error('Database query failed: ', err);
    res.status(500).json({ message: 'Error fetching companies.' });
  } finally {
    sql.close();
  }
});

// POST /api/requests/:id/upload-receipts - Upload payment receipts and update request status
router.post('/:id/upload-receipts', upload.array('receipts', 5), async (req, res) => {  
  const pool = await poolPromise;
  const txn = new sql.Transaction(pool);

  try {
    await txn.begin();  // Start the transaction
    const request = new sql.Request(txn);

    const id = Number(req.params.id);
    if (!id) {
      await txn.rollback();
      return res.status(400).json({ message: 'Invalid request ID' });
    }

    if (!req.files || req.files.length === 0) {
      await txn.rollback();
      return res.status(400).json({ message: 'No files uploaded' });
    }
    
    // First, get the request details including location and amount
    const requestResult = await request
      .input('id', sql.Int, id)
      .query(`
        SELECT r.amount, r.currency, r.location, l.id as locationId, r.status
        FROM petty_cash_requests r
        LEFT JOIN petty_Locations l ON r.location = l.location
        WHERE r.id = @id
      `);
      
    if (requestResult.recordset.length === 0) {
      await txn.rollback();
      return res.status(404).json({ message: 'Request not found' });
    }
    
    const requestData = requestResult.recordset[0];
    
    // Get the uploaded filenames as a single string
    const receiptFilenames = req.files.map(file => file.filename).join(', ');

    // Update the petty_cash_payments table
    await request
      .input('request_id', sql.Int, id)
      .input('receipt_filename', sql.NVarChar(sql.MAX), receiptFilenames)
      .query(`
        -- Update payment record with receipt and mark as done
        UPDATE petty_cash_payments 
        SET receipt_filename = @receipt_filename,
            status = 'payment done'
        WHERE request_id = @request_id;
        
        -- Also update the main request status to 'payment done'
        UPDATE petty_cash_requests
        SET status = 'payment done'
        WHERE id = @request_id;
      `);
    
    // Update the location's used amount if location exists
    if (requestData.locationId) {
      const exchangeRate = await getExchangeRate(requestData.currency || 'GBP', 'GBP');
      const amountInGBP = parseFloat(requestData.amount) / exchangeRate;
      
      console.log(`Updating budget for location ${requestData.location} (ID: ${requestData.locationId}) with amount:`, {
        amount: requestData.amount,
        currency: requestData.currency,
        exchangeRate,
        amountInGBP
      });
      
      const budgetUpdateResult = await new sql.Request(txn)
        .input('id', sql.Int, requestData.locationId)
        .input('amount', sql.Decimal(10, 2), amountInGBP)
        .query(`
          DECLARE @currentUsed DECIMAL(10,2) = ISNULL((SELECT used_amount FROM petty_Locations WHERE id = @id), 0);
          DECLARE @newUsed DECIMAL(10,2) = @currentUsed + @amount;
          DECLARE @budget DECIMAL(10,2) = ISNULL((SELECT budget FROM petty_Locations WHERE id = @id), 30);
          
          IF (@budget - @newUsed) < 0
          BEGIN
            THROW 50001, 'Insufficient budget for this location', 1;
          END
          
          UPDATE petty_Locations 
          SET used_amount = @newUsed,
              remaining_amount = @budget - @newUsed
          WHERE id = @id;
          
          SELECT @newUsed as newUsed, @budget as budget, (@budget - @newUsed) as newRemaining;
        `);
        
      console.log('Budget update result:', {
        locationId: requestData.locationId,
        newUsed: budgetUpdateResult.recordset[0].newUsed,
        budget: budgetUpdateResult.recordset[0].budget,
        newRemaining: budgetUpdateResult.recordset[0].newRemaining
      });
    } else {
      console.warn('No location ID found for request ID:', id);
    }

    await txn.commit();  // Commit the transaction

    // Return the uploaded files info
    const fileInfo = req.files.map(file => ({
      filename: file.filename,
      originalname: file.originalname,
      size: file.size
    }));

    return res.status(200).json({ 
      message: 'Receipts uploaded and payment processed successfully',
      files: fileInfo
    });

  } catch (error) {
    console.error('Error uploading receipts:', error);
    try {
      if (txn._aborted === false) {
        await txn.rollback();
      }
    } catch (rollbackErr) {
      console.error('Error rolling back transaction:', rollbackErr);
    }
    
    if (error.number === 50001) {
      return res.status(400).json({ 
        success: false,
        message: error.message || 'Insufficient budget for this location'
      });
    }
    
    return res.status(500).json({ 
      success: false,
      message: 'Failed to process payment receipt',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
