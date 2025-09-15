const express = require('express');
const router = express.Router();
const sql = require('mssql');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { poolPromise } = require('../config/db');
const { sendEmail, buildAdminNewRequestEmail, buildUserStatusEmail } = require('../utils/mailer');

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

// PUT /api/requests/:id/intercompany - Approve with intercompany transfer
router.put('/:id/intercompany', async (req, res) => {
  try {
    const { id } = req.params;
    const { company, performedByEmail, performedByName, note } = req.body || {};
    if (!company || !String(company).trim()) {
      return res.status(400).json({ message: 'Target company is required' });
    }

    const pool = await poolPromise;
    // Read previous company before update for audit trail
    const prev = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT company_name FROM petty_cash_requests WHERE id = @id');
    const previousCompany = prev.recordset?.[0]?.company_name || null;

    // Update request to intercompany
    await pool.request()
      .input('id', sql.Int, id)
      .input('company', sql.NVarChar(200), String(company).trim())
      .query(`
        UPDATE petty_cash_requests
        SET status = 'intercompany',
            company_name = @company,
            approved_at = SYSUTCDATETIME(),
            rejected_at = NULL,
            date_of_approve_reject = SYSUTCDATETIME()
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
          r.reason              AS description,
          r.status,
          r.created_at          AS createdAt,
          r.date_of_purchase    AS dateOfPurchase,
          r.approved_at         AS approvedAt,
          r.rejected_at         AS rejectedAt,
          r.rejection_reason    AS rejectionReason,
          r.attachments
        FROM petty_cash_requests r
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
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// GET /api/requests
router.get('/', async (req, res) => {
  const { status, q, company, category, range, email, location } = req.query;

  // Build dynamic WHERE clause safely
  const where = [];
  const params = {};

  if (status) {
    where.push('LOWER(r.status) = LOWER(@status)');
    params.status = { type: sql.VarChar(20), value: String(status) };
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
      INSERT INTO petty_cash_requests (employee_name, employee_email, company_name, category_name, amount, location, status, reason, created_at, approved_at, rejected_at, attachments, date_of_purchase)
      OUTPUT INSERTED.*
      VALUES (@employeeName, @employeeEmail, @company, @category, @amount, @location, @status, @reason, SYSUTCDATETIME(), NULL, NULL, @attachments, @dateOfPurchase)
    `;

    const result = await request.query(insertSql);
    console.log('SQL insert successful:', result.recordset?.[0]);
    const newRequest = result.recordset?.[0] || null;
    
    if (newRequest) {
      // Optional: Add the uploaded file info to the response
      newRequest.uploadedFiles = attachmentPaths;
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

// POST /api/requests/:id/approve - mark a request as approved
router.post('/:id/approve', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: 'Invalid id' });
    const pool = await poolPromise;
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query(`
        UPDATE petty_cash_requests
        SET status = 'approved', approved_at = SYSUTCDATETIME()
        WHERE id = @id;
        SELECT * FROM petty_cash_requests WHERE id = @id;
      `);
    const row = result.recordset?.[0] || { id };
    // Notify requester
    try {
      if (row && row.employee_email) {
        const { subject, html } = buildUserStatusEmail(row);
        sendEmail({ to: row.employee_email, subject, html }).catch((e) => console.error('Failed sending user email:', e.message));
      }
    } catch (e) { console.error('User email error:', e); }
    return res.json(row);
  } catch (err) {
    console.error('Error approving request:', err);
    return res.status(500).json({ message: 'Failed to approve request' });
  }
});

// POST /api/requests/:id/reject - mark a request as rejected
router.post('/:id/reject', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: 'Invalid id' });
    const pool = await poolPromise;
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query(`
        UPDATE petty_cash_requests
        SET status = 'rejected', rejected_at = SYSUTCDATETIME()
        WHERE id = @id;
        SELECT * FROM petty_cash_requests WHERE id = @id;
      `);
    const row = result.recordset?.[0] || { id };
    // Notify requester
    try {
      if (row && row.employee_email) {
        const { subject, html } = buildUserStatusEmail(row);
        sendEmail({ to: row.employee_email, subject, html }).catch((e) => console.error('Failed sending user email:', e.message));
      }
    } catch (e) { console.error('User email error:', e); }
    return res.json(row);
  } catch (err) {
    console.error('Error rejecting request:', err);
    return res.status(500).json({ message: 'Failed to reject request' });
  }
});

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
    
    // Return the updated request
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT * FROM petty_cash_requests WHERE id = @id');
    const row = result.recordset[0];

    // Notify requester on status change (non-blocking)
    try {
      if (row && row.employee_email) {
        const { subject, html } = buildUserStatusEmail(row);
        sendEmail({ to: row.employee_email, subject, html }).catch((e) => console.error('Failed sending user email:', e.message));
      }
    } catch (e) { console.error('User email error:', e); }

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
      .query('SELECT * FROM petty_cash_requests WHERE status = @status ORDER BY created_at DESC');
    
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

module.exports = router;
