const express = require('express');
const router = express.Router();
const sql = require('mssql');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getExchangeRate } = require('../utils/exchangeRates');
const { poolPromise } = require('../config/db');
const { sendEmail, buildAdminNewRequestEmail, buildUserStatusEmail, buildPaymentInitiatedEmail, buildBulkPaymentEmail, buildL1ManagerApprovalEmail, buildApprovedRequestPaymentEmail, getAdminEmailsByCompany } = require('../utils/mailer');
const { getUserById } = require('../utils/userUtils');

// Define uploads directory
const UPLOADS_DIR = path.join(__dirname, '../../uploads');

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
    // Keep original filename but add a unique prefix to prevent collisions
    const uniquePrefix = Date.now() + '-' + Math.round(Math.random() * 1E9) + '-';
    const safeFilename = file.originalname.replace(/[^\w\d.-]/g, '_'); // Replace special chars
    cb(null, uniquePrefix + safeFilename);
  }
});

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

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
router.get('/payments/list', async (req, res) => {
  const { page = 1, limit = 10, search, userRole, assignedCompany } = req.query;
  
  // Convert pagination parameters to numbers
  const currentPage = parseInt(page, 10);
  const itemsPerPage = parseInt(limit, 10);
  const offset = (currentPage - 1) * itemsPerPage;

  // Build WHERE clause for search and company filtering
  const whereClauses = [];
  // Always exclude Travel Requests from normal request flow
  whereClauses.push("r.category_name NOT IN ('Travel Request', 'Travel')");
  const params = {};
  
  // Filter by company for Payment role users
  if (userRole === 'Payment' && assignedCompany) {
    whereClauses.push('r.company_name = @assignedCompany');
    params.assignedCompany = assignedCompany;
    console.log(`Filtering payments for Payment user with company: ${assignedCompany}`);
  }
  
  if (search) {
    // If search starts with '#' or is a pure integer, search by request ID
    const idSearch = String(search).replace(/^#/, '').trim();
    if (/^\d+$/.test(idSearch)) {
      whereClauses.push('r.id = @searchId');
      params.searchId = parseInt(idSearch, 10);
    } else {
      whereClauses.push("(LOWER(r.employee_name) LIKE @search OR LOWER(r.employee_email) LIKE @search OR LOWER(r.company_name) LIKE @search OR LOWER(r.category_name) LIKE @search OR LOWER(p.status) LIKE @search)");
      params.search = `%${search.toLowerCase()}%`;
    }
  }
  
  const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : "";

  try {
    const pool = await poolPromise;
    await ensurePaymentsSchema(pool);
    
    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM petty_cash_payments p
      JOIN petty_cash_requests r ON r.id = p.request_id
      ${whereClause}
    `;
    const countRequest = pool.request();
    if (params.assignedCompany) {
      countRequest.input('assignedCompany', sql.NVarChar, params.assignedCompany);
    }
    if (params.searchId !== undefined) {
      countRequest.input('searchId', sql.Int, params.searchId);
    } else if (params.search) {
      countRequest.input('search', sql.NVarChar, params.search);
    }
    const countResult = await countRequest.query(countQuery);
    const totalItems = countResult.recordset[0].total;
    
    // Get paginated data
    const dataQuery = `
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
        r.currency,
        r.status AS requestStatus
      FROM petty_cash_payments p
      JOIN petty_cash_requests r ON r.id = p.request_id
      ${whereClause}
      ORDER BY p.created_at DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `;
    
    const dataRequest = pool.request();
    if (params.assignedCompany) {
      dataRequest.input('assignedCompany', sql.NVarChar, params.assignedCompany);
    }
    if (params.searchId !== undefined) {
      dataRequest.input('searchId', sql.Int, params.searchId);
    } else if (params.search) {
      dataRequest.input('search', sql.NVarChar, params.search);
    }
    dataRequest.input('offset', sql.Int, offset);
    dataRequest.input('limit', sql.Int, itemsPerPage);
    const result = await dataRequest.query(dataQuery);
    
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    
    return res.json({
      data: result.recordset || [],
      pagination: {
        currentPage,
        itemsPerPage,
        totalItems,
        totalPages,
        hasNextPage: currentPage < totalPages,
        hasPreviousPage: currentPage > 1
      }
    });
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
    const { paidAmount } = req.body;
    
    console.log(`Processing payment completion for request ID: ${id}`);
    console.log('Paid amount from form:', paidAmount);
    
    if (!id) return res.status(400).json({ message: 'Invalid id' });
    
    await txn.begin();
    
    // First, get the request details
    const requestResult = await new sql.Request(txn)
      .input('id', sql.Int, id)
      .query(`
        SELECT r.amount, r.currency
        FROM petty_cash_requests r
        WHERE r.id = @id
      `);
      
    if (requestResult.recordset.length === 0) {
      await txn.rollback();
      return res.status(404).json({ message: 'Request not found' });
    }
    
    const request = requestResult.recordset[0];
    const receiptFilenames = req.files && req.files.length > 0 
      ? req.files.map(f => f.filename).join(',') 
      : null;
    
    console.log('Payment done - Receipt upload:', {
      requestId: id,
      filesUploaded: req.files ? req.files.length : 0,
      receiptFilenames,
      paidAmount: paidAmount || 'not provided'
    });
    
    // Update the payment record with receipt and paid amount
    const updateResult = await new sql.Request(txn)
      .input('id', sql.Int, id)
      .input('receipt', sql.NVarChar(sql.MAX), receiptFilenames)
      .input('paidAmount', sql.Decimal(18, 2), paidAmount ? Number(paidAmount) : null)
      .query(`
        UPDATE petty_cash_payments
        SET status = 'payment done', 
            receipt_filename = @receipt,
            paid_amount = COALESCE(@paidAmount, paid_amount)
        WHERE request_id = @id
      `);
    
    console.log('Payment record updated:', {
      rowsAffected: updateResult.rowsAffected[0],
      receiptFilenames,
      paidAmount: paidAmount || 'not updated'
    });
    
    // Update the request status
    await new sql.Request(txn)
      .input('id', sql.Int, id)
      .query(`
        UPDATE petty_cash_requests
        SET status = 'payment done'
        WHERE id = @id
      `);
    
    await txn.commit();
    
    return res.json({ 
      message: 'Payment marked as done', 
      receipts: receiptFilenames ? receiptFilenames.split(',') : [],
    });
    
  } catch (err) {
    console.error('Error marking payment done:', err);
    try {
      await txn.rollback();
    } catch (rollbackErr) {
      console.error('Error rolling back transaction:', rollbackErr);
    }
    
    return res.status(500).json({ message: 'Failed to mark payment done' });
  }
});

// PUT /api/requests/:id - Update a request (only when pending)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { company, category, location, amount, description, dateOfPurchase, travelDetails } = req.body || {};

    const pool = await poolPromise;
    
    // Ensure travel_details column exists
    await ensureTravelDetailsColumn(pool);
    
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

    // Handle travel details update with validation
    let travelDetailsJson = null;
    if (travelDetails !== undefined) {
      if (travelDetails === null || travelDetails === '') {
        // Allow clearing travel details
        travelDetailsJson = null;
      } else {
        try {
          // If travelDetails is a string, parse it first to validate JSON
          const travelDetailsObj = typeof travelDetails === 'string' 
            ? JSON.parse(travelDetails) 
            : travelDetails;
          
          // Validate travel details structure
          if (travelDetailsObj && typeof travelDetailsObj === 'object') {
            // Check if it has at least one of flight or accommodation
            const hasValidStructure = 
              (travelDetailsObj.flight && typeof travelDetailsObj.flight === 'object') ||
              (travelDetailsObj.accommodation && typeof travelDetailsObj.accommodation === 'object');
            
            if (!hasValidStructure) {
              return res.status(400).json({ 
                message: 'Invalid travel details structure. Must contain at least flight or accommodation data.' 
              });
            }
          }
          
          travelDetailsJson = JSON.stringify(travelDetailsObj);
        } catch (e) {
          console.error('Error parsing travel details:', e);
          return res.status(400).json({ message: 'Invalid travel details format. Must be valid JSON.' });
        }
      }
      reqUpd.input('travelDetails', sql.NVarChar(sql.MAX), travelDetailsJson);
    }

    let updateQuery = `
      UPDATE petty_cash_requests
      SET 
        company_name = COALESCE(@company, company_name),
        category_name = COALESCE(@category, category_name),
        location = COALESCE(@location, location),
        amount = COALESCE(@amount, amount),
        reason = COALESCE(@reason, reason),
        date_of_purchase = COALESCE(@dateOfPurchase, date_of_purchase)`;
    
    // Only update travel_details if it was provided in the request
    if (travelDetails !== undefined) {
      updateQuery += `,
        travel_details = @travelDetails`;
    }
    
    updateQuery += `
      WHERE id = @id;
    `;

    await reqUpd.query(updateQuery);

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

// PUT /api/requests/:id/intercompany - Transfer to another company (after approval)
router.put('/:id/intercompany', async (req, res) => {
  try {
    const { id } = req.params;
    const { company, performedByEmail, performedByName, note } = req.body || {};
    if (!company || !String(company).trim()) {
      return res.status(400).json({ message: 'Target company is required' });
    }

    const pool = await poolPromise;

    // Validate request exists and is approved
    const reqRow = await pool.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT r.status AS requestStatus
        FROM petty_cash_requests r
        WHERE r.id = @id
      `);

    const requestStatus = (reqRow.recordset?.[0]?.requestStatus || '').toLowerCase();

    // Allow intercompany transfer only for approved requests (not pending or rejected)
    if (requestStatus !== 'approved' && requestStatus !== 'intercompany') {
      return res.status(400).json({ message: 'Intercompany transfer is only allowed for approved requests' });
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

    return res.json({ message: 'Request transferred to another company', data: result.recordset?.[0] });
  } catch (err) {
    console.error('Error with intercompany transfer:', err);
    return res.status(500).json({ message: 'Failed to complete intercompany transfer' });
  }
});

// ── POST /api/requests/:id/attachments ─────────────────────────────────────
// ── GET /api/requests/missing-attachments ─────────────────────────────────
// Admin-only: returns all requests that have attachment metadata in the DB
// but whose files are missing from disk. Used for the admin report page.
router.get('/missing-attachments', async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT id, employee_name, employee_email, company_name, category_name,
             amount, currency, status, created_at, attachments
      FROM petty_cash_requests
      WHERE attachments IS NOT NULL
        AND attachments != '[]'
        AND attachments != ''
      ORDER BY id DESC
    `);

    const missing = [];
    for (const row of result.recordset) {
      let atts = [];
      try { atts = JSON.parse(row.attachments); } catch {}
      if (!Array.isArray(atts)) continue;

      const missingAtts = atts.filter(a => {
        if (!a.filename) return false;
        const filePath = path.join(UPLOADS_DIR, path.basename(a.filename));
        return !fs.existsSync(filePath);
      });

      if (missingAtts.length > 0) {
        missing.push({
          id: row.id,
          employeeName: row.employee_name,
          employeeEmail: row.employee_email,
          company: row.company_name,
          category: row.category_name,
          amount: row.amount,
          currency: row.currency,
          status: row.status,
          submittedAt: row.created_at,
          missingFiles: missingAtts.map(a => ({
            originalName: a.originalName || a.filename,
            filename: a.filename,
            size: a.size,
            mimetype: a.mimetype,
          })),
          totalAttachments: atts.length,
          missingCount: missingAtts.length,
        });
      }
    }

    return res.json({
      data: missing,
      summary: {
        affectedRequests: missing.length,
        totalMissingFiles: missing.reduce((s, r) => s + r.missingCount, 0),
      },
    });
  } catch (err) {
    console.error('Error fetching missing attachments report:', err);
    return res.status(500).json({ message: 'Failed to generate report' });
  }
});

// ── POST /api/requests/send-reupload-reminder ─────────────────────────────
// Admin sends a re-upload reminder email to an employee for a specific request.
router.post('/send-reupload-reminder', async (req, res) => {
  try {
    const { requestId, employeeEmail, employeeName, missingFiles } = req.body;
    if (!requestId || !employeeEmail) {
      return res.status(400).json({ message: 'requestId and employeeEmail are required' });
    }

    const frontendBase = (process.env.FRONTEND_URL || '').split(',')[0].trim().replace(/\/$/, '');
    const requestUrl = `${frontendBase}/my-requests/${requestId}`;

    const fileList = Array.isArray(missingFiles) && missingFiles.length > 0
      ? missingFiles.map(f => `<li style="margin:6px 0;color:#374151;font-size:14px;">📄 ${f}</li>`).join('')
      : '<li style="color:#374151;font-size:14px;">One or more attachments</li>';

    const subject = `Action Required: Please Re-upload Attachments for Request #${requestId}`;
    const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;background:#f3f4f6;">
  <div style="max-width:600px;margin:0 auto;padding:20px;">
    <div style="background:#2563EB;padding:32px 28px;border-radius:12px 12px 0 0;text-align:center;">
      <div style="font-size:40px;margin-bottom:10px;">📎</div>
      <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">Attachment Re-upload Required</h1>
      <p style="margin:8px 0 0;color:#dbeafe;font-size:14px;">Request #${requestId}</p>
    </div>
    <div style="background:#fff;padding:32px 28px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
      <p style="margin:0 0 16px;color:#111827;font-size:15px;line-height:1.6;">
        Hi <strong>${employeeName || employeeEmail.split('@')[0]}</strong>,
      </p>
      <p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.6;">
        We noticed that the following attachment(s) for your expense request <strong>#${requestId}</strong> are no longer available on our server due to a system migration. We kindly ask you to re-upload them at your earliest convenience.
      </p>
      <div style="background:#FEF2F2;border-left:4px solid #DC2626;border-radius:6px;padding:16px 20px;margin:20px 0;">
        <p style="margin:0 0 10px;color:#991B1B;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Missing Files</p>
        <ul style="margin:0;padding-left:20px;">${fileList}</ul>
      </div>
      <p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.6;">
        Please log in to PocketPro HR and re-upload the files directly on your request page.
      </p>
      <div style="text-align:center;margin:28px 0;">
        <a href="${requestUrl}"
           style="display:inline-block;background:#2563EB;color:#ffffff;padding:14px 36px;text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;">
          Re-upload Attachments
        </a>
      </div>
      <p style="margin:20px 0 0;color:#9ca3af;font-size:12px;text-align:center;line-height:1.5;">
        If you have any questions, please contact your HR administrator.<br>
        PocketPro HR — Automated Notification · Request #${requestId}
      </p>
    </div>
  </div>
</body>
</html>`;

    await sendEmail({ to: employeeEmail, subject, html });

    return res.json({ message: `Reminder sent to ${employeeEmail}` });
  } catch (err) {
    console.error('Error sending re-upload reminder:', err);
    return res.status(500).json({ message: 'Failed to send reminder email' });
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
          r.travel_details      AS travelDetails,
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

    // Enrich each attachment with a ready-to-use fileUrl that works in all environments.
    // This avoids the frontend needing to construct URLs — it just uses attachment.fileUrl directly.
    const frontendBase = (process.env.FRONTEND_URL || '').split(',')[0].trim().replace(/\/$/, '')
      || `${req.protocol}://${req.get('host')}`;
    if (Array.isArray(row.attachments)) {
      row.attachments = row.attachments.map(att => {
        const fname = att.filename || att.originalName || att;
        const filePath = path.join(UPLOADS_DIR, path.basename(String(fname)));
        return {
          ...att,
          isMissing: !fs.existsSync(filePath),
          fileUrl: `${frontendBase}/api/file/${path.basename(String(fname))}`,
        };
      });
    }

    // Try to parse travel_details JSON if present
    try {
      row.travelDetails = row.travelDetails ? JSON.parse(row.travelDetails) : null;
    } catch {
      row.travelDetails = null;
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
    files: 10 // Maximum 5 files per upload
  }
});

// ── POST /api/requests/:id/attachments ────────────────────────────────────
// Employee re-uploads missing or adds new attachments to an existing request.
// Updates the attachments array in the DB and marks status as "Attachment Reuploaded".
router.post('/:id/attachments', upload.array('attachments', 10), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: 'Invalid request ID' });

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No files uploaded' });
    }

    const pool = await poolPromise;

    // Get the current request and its existing attachments
    const currentResult = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT id, attachments, status FROM petty_cash_requests WHERE id = @id');

    if (!currentResult.recordset || currentResult.recordset.length === 0) {
      return res.status(404).json({ message: 'Request not found' });
    }

    const currentRequest = currentResult.recordset[0];
    let existingAttachments = [];
    try {
      if (currentRequest.attachments && currentRequest.attachments !== '[]' && currentRequest.attachments !== '') {
        existingAttachments = JSON.parse(currentRequest.attachments);
      }
    } catch (e) {
      existingAttachments = [];
    }

    // Build new attachment objects
    const newAttachments = req.files.map((file) => ({
      originalName: file.originalname,
      filename: file.filename,
      size: file.size,
      mimetype: file.mimetype,
    }));

    // Merge: replace any existing entry with the same originalName, append the rest
    const merged = [...existingAttachments];
    const replaceIndexStr = req.body.replaceIndex;

    if (replaceIndexStr !== undefined && replaceIndexStr !== null) {
      const replaceIndex = parseInt(replaceIndexStr, 10);
      if (replaceIndex >= 0 && replaceIndex < merged.length && newAttachments.length > 0) {
        // Replace the specific index
        merged[replaceIndex] = newAttachments[0];
        // If there are more new attachments (shouldn't happen for single replace), append them
        for (let i = 1; i < newAttachments.length; i++) {
          merged.push(newAttachments[i]);
        }
      } else {
        merged.push(...newAttachments);
      }
    } else {
      for (const newAtt of newAttachments) {
        const existingIdx = merged.findIndex(
          a => (a.originalName || '').toLowerCase() === newAtt.originalName.toLowerCase()
        );
        if (existingIdx >= 0) {
          merged[existingIdx] = newAtt; // replace the missing entry
        } else {
          merged.push(newAtt);
        }
      }
    }

    // Update DB — set attachments and mark status as "Attachment Reuploaded"
    await pool.request()
      .input('id', sql.Int, id)
      .input('attachments', sql.NVarChar(sql.MAX), JSON.stringify(merged))
      .input('status', sql.VarChar(50), 'Attachment Reuploaded')
      .query(`
        UPDATE petty_cash_requests
        SET attachments = @attachments, status = @status
        WHERE id = @id
      `);

    // Build enriched response with full fileUrls
    const frontendBase = (process.env.FRONTEND_URL || '').split(',')[0].trim().replace(/\/$/, '')
      || `${req.protocol}://${req.get('host')}`;

    const enriched = merged.map(att => ({
      ...att,
      fileUrl: `${frontendBase}/api/file/${path.basename(String(att.filename))}`,
    }));

    console.log(`[ATTACHMENTS] Request #${id}: ${newAttachments.length} file(s) uploaded. Status → Attachment Reuploaded`);

    return res.json({
      message: `${newAttachments.length} file(s) uploaded successfully`,
      attachments: enriched,
    });
  } catch (err) {
    console.error('Error uploading attachments:', err);
    if (req.files) req.files.forEach(f => { try { fs.unlinkSync(f.path); } catch {} });
    return res.status(500).json({ message: 'Failed to upload attachments', error: err.message });
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
        created_by_email NVARCHAR(320) NULL,
        sent_to_payment BIT NULL DEFAULT 0,
        attachments NVARCHAR(MAX) NULL
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
    -- Add sent_to_payment column if missing
    IF COL_LENGTH('dbo.petty_cash_payments', 'sent_to_payment') IS NULL
    BEGIN
      ALTER TABLE dbo.petty_cash_payments ADD sent_to_payment BIT NULL DEFAULT 0;
    END;
    -- Add attachments column if missing
    IF COL_LENGTH('dbo.petty_cash_payments', 'attachments') IS NULL
    BEGIN
      ALTER TABLE dbo.petty_cash_payments ADD attachments NVARCHAR(MAX) NULL;
    END;
  `;
  await pool.request().query(sqlText);
}

// Ensure travel_details column exists in petty_cash_requests table
async function ensureTravelDetailsColumn(pool) {
  const sqlText = `
    IF COL_LENGTH('dbo.petty_cash_requests', 'travel_details') IS NULL
    BEGIN
      ALTER TABLE dbo.petty_cash_requests ADD travel_details NVARCHAR(MAX) NULL;
    END;
  `;
  await pool.request().query(sqlText);
}

// GET /api/requests
router.get('/', async (req, res) => {
  const { status, q, company, category, range, email, location, page = 1, limit = 10, userRole, assignedCompany } = req.query;
  
  // Convert pagination parameters to numbers
  const currentPage = parseInt(page, 10);
  const itemsPerPage = parseInt(limit, 10);
  const offset = (currentPage - 1) * itemsPerPage;

  // Build dynamic WHERE clause safely
  const where = [];
  // Always exclude Travel Requests — they have their own dedicated flow
  where.push("r.category_name NOT IN ('Travel Request', 'Travel')");
  const params = {};

  // Filter by company for Payment role users
  if (userRole === 'Payment' && assignedCompany) {
    where.push('r.company_name = @assignedCompany');
    params.assignedCompany = { type: sql.NVarChar(200), value: String(assignedCompany) };
    console.log(`Filtering requests for Payment user with company: ${assignedCompany}`);
  }

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
    // If query starts with '#' or is a pure integer, search by request ID
    const idSearch = String(q).replace(/^#/, '').trim();
    if (/^\d+$/.test(idSearch)) {
      where.push('r.id = @requestId');
      params.requestId = { type: sql.Int, value: parseInt(idSearch, 10) };
    } else {
      where.push("(LOWER(r.employee_name) LIKE @q OR LOWER(r.employee_email) LIKE @q OR LOWER(r.company_name) LIKE @q OR LOWER(r.category_name) LIKE @q OR LOWER(ISNULL(r.reason, '')) LIKE @q)");
      params.q = { type: sql.NVarChar(400), value: `%${String(q).toLowerCase()}%` };
    }
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
      r.reason,
      (
        SELECT TOP 1 previous_company
        FROM petty_cash_request_audits
        WHERE request_id = r.id AND action = 'intercompany_transfer'
        ORDER BY created_at DESC
      ) AS transferFrom,
      (
        SELECT TOP 1 new_company
        FROM petty_cash_request_audits
        WHERE request_id = r.id AND action = 'intercompany_transfer'
        ORDER BY created_at DESC
      ) AS transferTo
    FROM petty_cash_requests r
    ${whereSql}
    ORDER BY ${orderParts.join(', ')}
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
  `;

  // Count query for total items
  const countQuery = `
    SELECT COUNT(*) as total
    FROM petty_cash_requests r
    ${whereSql}
  `;

  try {
    const pool = await poolPromise;
    
    // Execute count query first
    const countRequest = pool.request();
    Object.entries(params).forEach(([key, { type, value }]) => countRequest.input(key, type, value));
    countRequest.input('offset', sql.Int, offset);
    countRequest.input('limit', sql.Int, itemsPerPage);
    const countResult = await countRequest.query(countQuery);
    const totalItems = countResult.recordset[0].total;
    
    // Execute main query with pagination
    const dataRequest = pool.request();
    Object.entries(params).forEach(([key, { type, value }]) => dataRequest.input(key, type, value));
    dataRequest.input('offset', sql.Int, offset);
    dataRequest.input('limit', sql.Int, itemsPerPage);
    const result = await dataRequest.query(query);
    
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    
    return res.json({ 
      data: result.recordset || [],
      pagination: {
        currentPage,
        itemsPerPage,
        totalItems,
        totalPages,
        hasNextPage: currentPage < totalPages,
        hasPreviousPage: currentPage > 1
      }
    });
  } catch (err) {
    console.error('Error fetching requests:', err);
    return res.status(500).json({ message: 'Failed to fetch requests' });
  }
});

// Create a separate multer instance for payment attachments
const paymentAttachmentUpload = multer({
  storage: storage,
  fileFilter: fileFilter, // Assuming fileFilter is defined elsewhere
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
    files: 5 // Max 5 files
  }
});  

// POST /api/requests/:id/proceed-payment - capture payment details and notify payments team
router.post('/:id/proceed-payment', paymentAttachmentUpload.array('attachments', 5), async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!id) return res.status(400).json({ message: 'Invalid id' });
  
      const { method, reference, paidAmount, paidDate, notes, adminEmail } = req.body || {};
      if (!method) return res.status(400).json({ message: 'Payment method is required' });
      
      // Get uploaded files (payment proof attachments)
      const uploadedFiles = req.files || [];
  
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
  
      // --- ATTACHMENT PROCESSING LOGIC ---
      const paymentProofAttachments = [];
      const dbAttachmentFilenames = [];
  
      for (const file of uploadedFiles) {
        try {
          const filePath = path.join(UPLOADS_DIR, file.filename);
          const fileContent = await fs.promises.readFile(filePath);
          
          if (fileContent.byteLength === 0) {
            console.warn(`Attachment file is empty: ${file.filename}. Skipping.`);
            continue;
          }

          // For database
          dbAttachmentFilenames.push(file.filename);
          
          // For email
          paymentProofAttachments.push({
            filename: file.originalname,
            content: fileContent,
            contentType: file.mimetype || 'application/octet-stream'
          });
        } catch (err) {
          console.error(`Error processing file ${file.filename}:`, err);
        }
      }
  
      const attachmentFilenames = dbAttachmentFilenames.join(',');
      // --- END ATTACHMENT PROCESSING LOGIC ---
      
      // Insert payment record and update sent_to_payment flag
      await pool.request()
        .input('requestId', sql.Int, id)
        .input('method', sql.NVarChar(100), String(method))
        .input('reference', sql.NVarChar(200), reference || null)
        .input('paidAmount', sql.Decimal(18,2), paidAmount != null ? Number(paidAmount) : null)
        .input('paidDate', sql.DateTime2, paidDate ? new Date(paidDate) : null)
        .input('notes', sql.NVarChar(sql.MAX), notes || null)
        .input('adminEmail', sql.NVarChar(320), adminEmail || null)
        .input('attachments', sql.NVarChar(sql.MAX), attachmentFilenames || null)
        .query(`
          BEGIN TRANSACTION;
          INSERT INTO petty_cash_payments 
            (request_id, method, reference, paid_amount, paid_date, notes, status, created_by_email, sent_to_payment, attachments)
          VALUES 
            (@requestId, @method, @reference, @paidAmount, @paidDate, @notes, 'processed', @adminEmail, 1, @attachments);
          UPDATE petty_cash_requests 
          SET status = 'processed'
          WHERE id = @requestId;
          COMMIT TRANSACTION;
        `);
  
      // Send email to payment team with specified recipients
      try {
        // Company-specific accounts email mapping
        // Keys MUST match company_name exactly as stored in petty_cash_requests
        const companyAccountsEmails = {
          'Docpharm GmbH':                        'account@docpharm.de',
          'Docpharm':                             'account@docpharm.de',
          'Lifexa BV':                            'accounts@lifexa.eu',
          'Acme Pharma Ltd':                      'accounts@acmepharma.co.uk',
          'Acme':                                 'accounts@acmepharma.co.uk',
          'Jambo BV':                             'accounts@jambobv.nl',
          'Jambo Supplies Ltd':                   'accounts@jambobv.nl',
          'Beauty Care Global Sp Zoo':            'accounts.bcg@beautycareglobal.com',
          'Beauty Magasin Ltd':                   'payment@acornuniversalconsultancy.com',
          'Astute Healthcare Ltd':                null, // uses default payment team
          'Future Centre Storage and Distribution': null,
          'Global Brand Storage and Distribution': null,
        };

        // Get company name from request
        const companyRaw = row.company_name || row.company || '';
        const companyName = (typeof companyRaw === 'string' ? companyRaw : String(companyRaw || '')).trim();
        
        console.log(`[PAYMENT ROUTING] Request ID: ${id}, Company from DB: "${companyName}"`);
        console.log(`[PAYMENT ROUTING] Available company mappings:`, Object.keys(companyAccountsEmails));
        
        // Determine recipient based on company
        let toRecipients = [];
        const companyAccountEmail = companyAccountsEmails[companyName];
        
        console.log(`[PAYMENT ROUTING] Matched email for "${companyName}":`, companyAccountEmail || 'NOT FOUND');
        
        if (companyAccountEmail) {
          // Send to company-specific accounts email
          toRecipients = [companyAccountEmail];
          console.log(`[PAYMENT ROUTING] ✓ Routing to company-specific account: ${companyAccountEmail}`);
        } else {
          // Send to default payment team
          toRecipients = [
            'Payment@acornuniversalconsultancy.com',
            'posting@acornuniversalconsultancy.com'
          ];
          console.log(`[PAYMENT ROUTING] ✗ No match found, routing to default payment team`);
        }
        
        const ccRecipients = ['ishika.gupta@astutehealthcare.co.uk'];

        const { subject, html } = buildPaymentInitiatedEmail({ 
          request: row, 
          payment: { 
            method,
            reference,
            paidAmount: paidAmount || row.amount,
            paidDate: paidDate || new Date().toISOString(),
            notes,
            processedBy: adminEmail || 'System',
            receiptAttachments: paymentProofAttachments
          } 
        });

        // Debug log for attachments
        console.log('Preparing to send email with attachments:', {
          attachmentCount: paymentProofAttachments.length,
          attachmentDetails: paymentProofAttachments.map(a => ({
            filename: a.filename,
            size: a.content ? a.content.length : 'no content',
            type: a.contentType
          }))
        });

        try {
          // Send email with attachments and CC
          await sendEmail({
            to: toRecipients,
            cc: ccRecipients,
            subject,
            html,
            attachments: paymentProofAttachments,
            user: {
              firstName: 'Payment',
              lastName: 'System',
              email: process.env.FROM_EMAIL || process.env.SMTP_USER
            }
          });
          console.log(`Payment notification sent to ${toRecipients.join(', ')} (CC: ${ccRecipients.join(', ')}) with ${paymentProofAttachments.length} attachments`);
        } catch (emailError) {
          console.error('Error sending email:', emailError);
          throw emailError;
        }
  
      } catch (e) {
        console.error('Error sending payment notification email:', e);
        // Don't fail the whole request if email fails
      }
  
      // Fetch the updated request to return to frontend
      const updatedRequest = await pool.request()
        .input('id', sql.Int, id)
        .query('SELECT * FROM petty_cash_requests WHERE id = @id');
  
      return res.json({ 
        success: true,
        message: 'Payment initiated and team notified',
        attachmentsProcessed: paymentProofAttachments.length,
        data: updatedRequest.recordset?.[0]
      });
    } catch (err) {
      console.error('Error in proceed-payment:', err);
      return res.status(500).json({ 
        success: false,
        message: 'Failed to process payment',
        error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
      });
    }
});

// POST /api/requests/bulk-payment - Send multiple approved requests to payment team
router.post('/bulk-payment', async (req, res) => {
  try {
    const { requestIds } = req.body;
    
    if (!requestIds || !Array.isArray(requestIds) || requestIds.length === 0) {
      return res.status(400).json({ message: 'Request IDs array is required' });
    }

    const pool = await poolPromise;
    
    // Ensure payments schema is present
    await ensurePaymentsSchema(pool);
    
    // Fetch all requests
    const placeholders = requestIds.map((_, i) => `@id${i}`).join(',');
    const request = pool.request();
    requestIds.forEach((id, i) => request.input(`id${i}`, sql.Int, id));
    
    const result = await request.query(`
      SELECT 
        r.*,
        r.employee_name,
        r.employee_email,
        r.company_name,
        r.category_name
      FROM petty_cash_requests r
      WHERE r.id IN (${placeholders})
      AND r.status IN ('approved', 'intercompany')
    `);
    
    const requests = result.recordset;
    
    if (requests.length === 0) {
      return res.status(404).json({ message: 'No approved requests found' });
    }
    
    // Group requests by company
    const groupedByCompany = requests.reduce((acc, req) => {
      const companyRaw = req.company_name || req.company || 'Unknown';
      const company = (typeof companyRaw === 'string' ? companyRaw : String(companyRaw || 'Unknown')).trim();
      if (!acc[company]) {
        acc[company] = [];
      }
      acc[company].push(req);
      return acc;
    }, {});
    
    // Company-specific accounts email mapping
    // Keys MUST match company_name exactly as stored in petty_cash_requests
    const companyAccountsEmails = {
      'Docpharm GmbH':                        'account@docpharm.de',
      'Lifexa BV':                            'accounts@lifexa.eu',
      'Acme Pharma Ltd':                      'accounts@acmepharma.co.uk',
      'Jambo BV':                             'accounts@jambobv.nl',
      'Jambo Supplies Ltd':                   'accounts@jambobv.nl',
      'Beauty Care Global Sp Zoo':            'accounts.bcg@beautycareglobal.com',
      'Beauty Magasin Ltd':                   'accounts.bcg@beautycareglobal.com',
      'Astute Healthcare Ltd':                null, // uses default payment team
      'Future Centre Storage and Distribution': null,
      'Global Brand Storage and Distribution': null,
    };
    
    // Determine recipients based on companies involved
    const companies = Object.keys(groupedByCompany);
    console.log(`[BULK PAYMENT ROUTING] Companies in bulk payment:`, companies);
    console.log(`[BULK PAYMENT ROUTING] Available company mappings:`, Object.keys(companyAccountsEmails));
    
    let toRecipients = [];
    
    // If all requests are from companies with specific emails, send to those
    const companyEmails = companies
      .map(c => {
        const email = companyAccountsEmails[c];
        console.log(`[BULK PAYMENT ROUTING] Company "${c}" -> Email: ${email || 'NOT FOUND'}`);
        return email;
      })
      .filter(Boolean);
    
    console.log(`[BULK PAYMENT ROUTING] Matched ${companyEmails.length} out of ${companies.length} companies`);
    
    if (companyEmails.length === companies.length) {
      // All companies have specific emails
      toRecipients = [...new Set(companyEmails)]; // Remove duplicates
      console.log(`[BULK PAYMENT ROUTING] ✓ All companies matched, sending to:`, toRecipients);
    } else {
      // Some companies don't have specific emails, send to default
      toRecipients = [
        'Payment@acornuniversalconsultancy.com',
        'posting@acornuniversalconsultancy.com'
      ];
      console.log(`[BULK PAYMENT ROUTING] ✗ Not all companies matched, sending to default payment team`);
    }
    
    const ccRecipients = ['ishika.gupta@astutehealthcare.co.uk'];
    
    // Collect all attachments from all requests
    const allAttachments = [];
    console.log(`Processing attachments for ${requests.length} request(s)...`);
    
    for (const req of requests) {
      console.log(`Request ${req.id}: attachments field =`, req.attachments);
      
      if (req.attachments) {
        try {
          // Parse attachments - it's stored as JSON array of objects
          let attachmentsList = [];
          
          if (typeof req.attachments === 'string') {
            try {
              // Try to parse as JSON first
              const parsed = JSON.parse(req.attachments);
              if (Array.isArray(parsed)) {
                attachmentsList = parsed;
              } else {
                // Fallback: treat as comma-separated filenames
                attachmentsList = req.attachments.split(',').map(a => ({ filename: a.trim() })).filter(a => a.filename);
              }
            } catch {
              // If JSON parse fails, treat as comma-separated filenames
              attachmentsList = req.attachments.split(',').map(a => ({ filename: a.trim() })).filter(a => a.filename);
            }
          } else if (Array.isArray(req.attachments)) {
            attachmentsList = req.attachments;
          }
          
          console.log(`Request ${req.id}: parsed ${attachmentsList.length} attachment(s):`, attachmentsList);
          
          for (const attachment of attachmentsList) {
            try {
              // Get filename from attachment object or use as string
              const filename = attachment.filename || attachment;
              const originalName = attachment.originalName || filename;
              
              const filePath = path.join(UPLOADS_DIR, filename);
              console.log(`Trying to read file: ${filePath}`);
              
              const fileContent = await fs.promises.readFile(filePath);
              
              if (fileContent.byteLength > 0) {
                allAttachments.push({
                  filename: `Request_${req.id}_${originalName}`,
                  content: fileContent,
                  contentType: attachment.mimetype || 'application/octet-stream'
                });
                console.log(`✓ Added attachment: Request_${req.id}_${originalName} (${fileContent.byteLength} bytes)`);
              } else {
                console.warn(`✗ File is empty: ${filename}`);
              }
            } catch (fileErr) {
              console.error(`✗ Error reading attachment ${attachment.filename || attachment} for request ${req.id}:`, fileErr.message);
            }
          }
        } catch (err) {
          console.error(`Error processing attachments for request ${req.id}:`, err);
        }
      } else {
        console.log(`Request ${req.id}: No attachments field`);
      }
    }
    
    console.log(`\n📎 Collected ${allAttachments.length} attachment(s) from ${requests.length} request(s)\n`);
    
    // Build and send bulk payment email
    const { subject, html } = buildBulkPaymentEmail({ 
      requests, 
      groupedByCompany 
    });
    
    // Send email FIRST before updating database
    try {
      await sendEmail({
        to: toRecipients,
        cc: ccRecipients,
        subject,
        html,
        attachments: allAttachments,
        user: {
          firstName: 'Payment',
          lastName: 'System',
          email: process.env.FROM_EMAIL || process.env.SMTP_USER
        }
      });
      
      console.log(`✓ Email sent successfully to ${toRecipients.join(', ')}`);
    } catch (emailErr) {
      console.error('✗ Failed to send email:', emailErr);
      // Return error WITHOUT updating database
      return res.status(500).json({ 
        message: 'Failed to send bulk payment notification email',
        error: process.env.NODE_ENV === 'development' ? emailErr.message : 'Email sending failed',
        details: 'Requests were NOT processed to prevent data loss'
      });
    }
    
    // Email sent successfully, NOW update database
    console.log('Email sent successfully, now updating database...');
    
    for (const req of requests) {
      try {
        await pool.request()
          .input('requestId', sql.Int, req.id)
          .input('method', sql.NVarChar(100), 'Bulk Payment')
          .input('reference', sql.NVarChar(200), null)
          .input('paidAmount', sql.Decimal(18,2), req.amount)
          .input('paidDate', sql.DateTime2, new Date())
          .input('notes', sql.NVarChar(sql.MAX), 'Sent via bulk payment')
          .input('createdByEmail', sql.NVarChar(320), null)
          .input('attachments', sql.NVarChar(sql.MAX), null)
          .query(`
            BEGIN TRANSACTION;
            
            -- Insert payment record
            INSERT INTO petty_cash_payments 
              (request_id, method, reference, paid_amount, paid_date, notes, status, created_by_email, sent_to_payment, attachments)
            VALUES 
              (@requestId, @method, @reference, @paidAmount, @paidDate, @notes, 'processed', @createdByEmail, 1, @attachments);
            
            -- Update request status to processed
            UPDATE petty_cash_requests 
            SET status = 'processed'
            WHERE id = @requestId;
            
            COMMIT TRANSACTION;
          `);
        
        console.log(`✓ Created payment record and updated status for request ${req.id}`);
      } catch (err) {
        console.error(`✗ Error creating payment record for request ${req.id}:`, err);
        // Continue with other requests even if one fails
      }
    }
    
    console.log(`Bulk payment completed: ${requests.length} requests processed with ${allAttachments.length} attachment(s)`);
    
    return res.json({ 
      message: `Bulk payment notification sent successfully for ${requests.length} request(s)`,
      requestIds: requests.map(r => r.id),
      recipients: toRecipients
    });
    
  } catch (err) {
    console.error('Error sending bulk payment notification:', err);
    return res.status(500).json({ 
      message: 'Failed to send bulk payment notification',
      error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
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
      location,
      travelDetails,
      travelFormData // Also accept travelFormData from frontend
    } = req.body || {};
    
    // Use travelFormData if travelDetails is not provided
    const travelData = travelDetails || travelFormData;

    console.log('Extracted fields:', {
      employeeName,
      employeeEmail,
      company,
      category,
      amount,
      currency,
      description,
      dateOfPurchase,
      location,
      travelData: travelData ? 'present' : 'not present'
    });

    if (!employeeName || !employeeEmail || !category || !amount) {
      console.log('Validation failed - missing required fields');
      return res.status(400).json({ message: 'Missing required fields: employeeName, employeeEmail, category, or amount' });
    }

    const pool = await poolPromise;
    
    // Ensure travel_details column exists
    await ensureTravelDetailsColumn(pool);
    
    // Check if user has an L1 manager for travel requests
    let l1ManagerId = null;
    let initialStatus = 'pending'; // Default to admin approval
    
    if (category === 'Travel Request' || category === 'Travel') {
      console.log('Travel request detected, checking for L1 manager...');
      const userResult = await pool.request()
        .input('email', sql.NVarChar(320), employeeEmail)
        .query('SELECT l1_manager_id FROM petty_Users WHERE email = @email');
      
      if (userResult.recordset.length > 0 && userResult.recordset[0].l1_manager_id) {
        l1ManagerId = userResult.recordset[0].l1_manager_id;
        initialStatus = 'pending_l1'; // Route to L1 manager first
        console.log(`L1 manager found: ${l1ManagerId}, setting status to pending_l1`);
      } else {
        console.log('No L1 manager assigned, routing directly to admin');
      }
    }
    
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
      .input('status', sql.VarChar(20), initialStatus)
      .input('l1ManagerId', sql.Int, l1ManagerId);

    // Handle travel details - parse if string, stringify if object, and validate structure
    let travelDetailsJson = null;
    if (travelData) {
      try {
        // If travelData is a string, parse it first to validate JSON
        const travelDetailsObj = typeof travelData === 'string' 
          ? JSON.parse(travelData) 
          : travelData;
        
        // Validate travel details structure
        if (travelDetailsObj && typeof travelDetailsObj === 'object') {
          // Just check if it's a valid object with some data
          if (Object.keys(travelDetailsObj).length === 0) {
            console.error('Travel details object is empty');
            return res.status(400).json({ 
              message: 'Travel details cannot be empty' 
            });
          }
          
          travelDetailsJson = JSON.stringify(travelDetailsObj);
          console.log('Travel details validated and processed');
        } else {
          console.error('Invalid travel details - not an object');
          return res.status(400).json({ 
            message: 'Invalid travel details format' 
          });
        }
      } catch (e) {
        console.error('Error parsing travel details:', e);
        return res.status(400).json({ message: 'Invalid travel details format. Must be valid JSON.' });
      }
    }
    request.input('travelDetails', sql.NVarChar(sql.MAX), travelDetailsJson);

    let attachmentPaths = [];
    if (req.files && req.files.length > 0) {
      attachmentPaths = req.files.map(file => ({
        originalName: file.originalname,
        filename: file.filename, // Store only the filename, not the full path
        size: file.size,
        mimetype: file.mimetype
      }));
    }

    const attachmentsJson = JSON.stringify(attachmentPaths);
    request.input('attachments', sql.NVarChar(sql.MAX), attachmentsJson);

    console.log('About to execute SQL insert...');
    const insertSql = `
      INSERT INTO petty_cash_requests (employee_name, employee_email, company_name, category_name, amount, currency, location, status, reason, created_at, approved_at, rejected_at, attachments, date_of_purchase, travel_details, l1_manager_id, l1_approval_status)
      OUTPUT INSERTED.*
      VALUES (@employeeName, @employeeEmail, @company, @category, @amount, @currency, @location, @status, @reason, SYSUTCDATETIME(), NULL, NULL, @attachments, @dateOfPurchase, @travelDetails, @l1ManagerId, ${l1ManagerId ? "'pending'" : "NULL"})
    `;

    const result = await request.query(insertSql);
    console.log('SQL insert successful:', result.recordset?.[0]);
    const newRequest = result.recordset?.[0] || null;
    
    if (newRequest) {
      // Add the uploaded file info to the response with relative paths
      newRequest.attachments = attachmentPaths.map((attachment, index) => {
        // Get the file object from req.files if it exists
        const file = req.files && req.files[index] ? req.files[index] : null;
        const filePath = file ? file.path : '';
        
        return {
          ...attachment,
          // Ensure we're only sending the filename, not the full path
          filename: path.basename(attachment.filename),
          // Store only the relative path to the file if it exists
          filepath: filePath ? path.relative(process.cwd(), filePath) : ''
        };
      });
      
      // Check location and log if exists
      if (location) {
        try {
          // First, find the location ID
          const locationResult = await pool.request()
            .input('location', sql.VarChar(200), location)
            .query('SELECT id FROM petty_Locations WHERE location = @location');
          
          if (locationResult.recordset.length > 0) {
            const locationId = locationResult.recordset[0].id;
            // We'll update the budget when payment is marked as done
            console.log(`Location ID ${locationId} will be updated when payment is completed`);
          }
        } catch (error) {
          console.error('Error checking location:', error);
          // Don't fail the request if location check fails
        }
      }
    }
    // Send notification emails (non-blocking)
    try {
      const replyTo = newRequest?.employee_email || employeeEmail;

      // Prepare attachments once for reuse
      const emailAttachments = [];
      if (req.files && req.files.length > 0) {
        for (const file of req.files) {
          try {
            const filePath = path.join(__dirname, '../../uploads', file.filename);
            const fileContent = await require('fs').promises.readFile(filePath);
            emailAttachments.push({
              filename: file.originalname,
              content: fileContent,
              contentType: file.mimetype || 'application/octet-stream'
            });
          } catch (err) {
            console.error(`Error reading attachment file ${file.filename}:`, err);
          }
        }
      }

      const isTravelRequest = category === 'Travel Request' || category === 'Travel';

      if (isTravelRequest) {
        // Travel request — only notify L1 manager, never admin at creation
        if (l1ManagerId && initialStatus === 'pending_l1') {
          const l1ManagerResult = await pool.request()
            .input('managerId', sql.Int, l1ManagerId)
            .query('SELECT id, firstName, lastName, email FROM petty_Users WHERE id = @managerId');

          if (l1ManagerResult.recordset.length > 0) {
            const l1Manager = l1ManagerResult.recordset[0];
            const { subject, html } = buildL1ManagerApprovalEmail(newRequest, l1Manager);
            console.log(`[EMAIL] Sending L1 manager notification to ${l1Manager.email} for request #${newRequest.id}`);
            sendEmail({ to: l1Manager.email, subject, html, attachments: emailAttachments })
              .then(() => console.log(`[EMAIL] L1 manager notification sent to ${l1Manager.email}`))
              .catch((e) => console.error('Failed sending L1 manager email:', e.message));
          }
        }
        // No admin notification on travel request creation
      } else {
        // Normal petty cash request — notify admin by company
        const adminEmails = getAdminEmailsByCompany(newRequest.company_name);
        if (adminEmails.length > 0) {
          const { subject, html } = buildAdminNewRequestEmail(newRequest);
          for (const adminTo of adminEmails) {
            console.log(`[EMAIL] Sending admin notification to ${adminTo} for request #${newRequest.id}`);
            sendEmail({ to: adminTo, subject, html, attachments: emailAttachments })
              .then(() => console.log(`[EMAIL] Admin notification sent to ${adminTo}`))
              .catch((e) => console.error('Failed sending admin email:', e.message));
          }
        } else {
          console.warn('No admin email configured; skipping admin notification');
        }
      }
    } catch (e) {
      console.error('Email notification error:', e);
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
      console.log(`[EMAIL] PUT /status called for request #${id} — new status: ${row?.status} — recipient: ${recipient}`);
      if (recipient) {
        const { subject, html } = buildUserStatusEmail(row);
        console.log(`[EMAIL] Sending status update email to ${recipient} for request #${id}`);
        await sendEmail({ to: recipient, subject, html });
        console.log(`[EMAIL] Status update email sent to ${recipient}`);
      } else {
        console.warn('[MAIL][status] missing employee email for request id', id);
      }
    } catch (e) { 
      console.error('[MAIL][status] error:', e);
    }

    // Send email to payment team when request is approved
    if (status === 'approved') {
      try {
        const paymentEmails = getAdminEmailsByCompany(row?.company_name);
        if (paymentEmails && paymentEmails.length > 0) {
          const { subject, html } = buildApprovedRequestPaymentEmail(row);
          console.log(`[EMAIL] Sending approval notification to payment team for request #${id}: ${paymentEmails.join(', ')}`);
          await sendEmail({ to: paymentEmails, subject, html });
          console.log(`[EMAIL] Payment team notification email sent for request #${id}`);
        } else {
          console.warn('[MAIL][approval] no payment emails configured for company:', row?.company_name);
        }
      } catch (e) {
        console.error('[MAIL][approval] error sending payment team email:', e);
      }
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
    
    // First, get the request details
    const requestResult = await request
      .input('id', sql.Int, id)
      .query(`
        SELECT r.amount, r.currency, r.status
        FROM petty_cash_requests r
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


// Serve uploaded files with proper filename handling
router.get('/files/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    if (!filename) {
      return res.status(400).json({ message: 'Filename is required' });
    }

    // Prevent directory traversal attacks
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ message: 'Invalid filename' });
    }

    const filePath = path.join(UPLOADS_DIR, filename);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.error('File not found:', filePath);
      return res.status(404).json({ message: 'File not found' });
    }

    // Extract the original filename from the stored filename
    // Format: timestamp-randomNumber-originalfilename.ext
    const originalName = filename.includes('-') 
      ? filename.split('-').slice(2).join('_')
      : filename;
    
    // Set headers for file download
    res.download(filePath, originalName, (err) => {
      if (err) {
        console.error('Error downloading file:', err);
        if (!res.headersSent) {
          res.status(500).json({ message: 'Error downloading file' });
        }
      }
    });
    
  } catch (err) {
    console.error('Download error:', err);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Error processing download' });
    }
  }
});

// Endpoint to get file by original filename (for backward compatibility)
router.get('/file/:originalName', async (req, res) => {
  try {
    const originalName = req.params.originalName;
    const files = fs.readdirSync(UPLOADS_DIR);
    
    // Find the file that matches the original name (case insensitive)
    const file = files.find(f => f.toLowerCase().endsWith(originalName.toLowerCase()));
    
    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }
    
    const filePath = path.join(UPLOADS_DIR, file);
    const originalNameFromFile = file.split('-').slice(2).join('_');
    
    res.download(filePath, originalNameFromFile, (err) => {
      if (err) {
        console.error('Error downloading file:', err);
        if (!res.headersSent) {
          res.status(500).json({ message: 'Error downloading file' });
        }
      }
    });
    
  } catch (err) {
    console.error('File retrieval error:', err);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Error retrieving file' });
    }
  }
});

module.exports = router;
