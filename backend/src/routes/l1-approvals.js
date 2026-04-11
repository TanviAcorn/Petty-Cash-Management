const express = require('express');
const router = express.Router();
const sql = require('mssql');
const { poolPromise } = require('../config/db');
const { sendEmail, buildL1ApprovalNotificationEmail } = require('../utils/mailer');
const { bookTravelCalendarEvent, buildTripSummary, extractTravelDates } = require('../utils/teamsCalendar');

// GET /api/l1-approvals - Get all requests pending L1 approval for a manager
router.get('/', async (req, res) => {
  try {
    const { managerEmail } = req.query;
    
    const pool = await poolPromise;
    
    let query = `
      SELECT 
        r.*,
        u.firstName as employeeFirstName,
        u.lastName as employeeLastName
      FROM petty_cash_requests r
      LEFT JOIN petty_Users u ON r.employee_email = u.email
      WHERE (r.category_name = 'Travel Request' OR r.category_name = 'Travel')
        AND r.rejected_at IS NULL
    `;
    
    // If managerEmail is provided (for L1 managers), filter by that manager and only show pending_l1
    // If no managerEmail (for admin), show all travel requests
    if (managerEmail) {
      // Get manager ID from email
      const managerResult = await pool.request()
        .input('email', sql.NVarChar(320), managerEmail)
        .query('SELECT id FROM petty_Users WHERE email = @email');
      
      if (managerResult.recordset.length === 0) {
        return res.status(404).json({ message: 'Manager not found' });
      }
      
      const managerId = managerResult.recordset[0].id;
      query += ` AND r.l1_manager_id = ${managerId} AND r.status = 'pending_l1'`;
    } else {
      // Admin view — show pending and approved (not rejected)
      query += ` AND r.status IN ('pending_l1', 'pending', 'approved')`;
    }
    
    query += ` ORDER BY r.created_at DESC`;
    
    const result = await pool.request().query(query);
    
    // Parse JSON fields
    const requests = result.recordset.map(row => {
      try {
        row.attachments = row.attachments ? JSON.parse(row.attachments) : [];
      } catch {
        row.attachments = [];
      }
      
      try {
        row.travel_form_data = row.travel_form_data ? JSON.parse(row.travel_form_data) : null;
      } catch {
        row.travel_form_data = null;
      }
      
      // Also parse travel_details if travel_form_data is null
      if (!row.travel_form_data && row.travel_details) {
        try {
          row.travel_form_data = JSON.parse(row.travel_details);
        } catch {
          row.travel_form_data = null;
        }
      }
      
      return row;
    });
    
    res.json({ data: requests });
  } catch (err) {
    console.error('Error fetching L1 approval requests:', err);
    res.status(500).json({ message: 'Failed to fetch L1 approval requests' });
  }
});

// GET /api/l1-approvals/my-travel-requests?email=xxx — fetch user's own submitted travel requests
router.get('/my-travel-requests', async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ message: 'Email required' });

    const pool = await poolPromise;
    const result = await pool.request()
      .input('email', sql.NVarChar(320), email)
      .query(`
        SELECT id, employee_name, employee_email, category_name, status,
               l1_approval_status, created_at, travel_form_data, travel_docs_sent_at
        FROM petty_cash_requests
        WHERE employee_email = @email
          AND (category_name = 'Travel Request' OR category_name = 'Travel')
        ORDER BY created_at DESC
      `);

    const rows = result.recordset.map(row => {
      let travelData = null;
      try { travelData = row.travel_form_data ? JSON.parse(row.travel_form_data) : null; } catch {}
      return { ...row, travel_form_data: travelData };
    });

    res.json({ data: rows });
  } catch (err) {
    console.error('my-travel-requests error:', err);
    res.status(500).json({ message: 'Failed to fetch travel requests' });
  }
});

// GET /api/l1-approvals/last-trip?email=xxx — fetch user's last approved travel request
router.get('/last-trip', async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ message: 'Email required' });

    const pool = await poolPromise;
    const result = await pool.request()
      .input('email', sql.NVarChar(320), email)
      .query(`
        SELECT TOP 1 id, travel_details, travel_form_data, created_at
        FROM petty_cash_requests
        WHERE employee_email = @email
          AND (category_name = 'Travel Request' OR category_name = 'Travel')
          AND l1_approval_status = 'approved'
        ORDER BY created_at DESC
      `);

    if (!result.recordset.length) return res.json({ data: null });

    const row = result.recordset[0];
    let travelData = null;
    try { travelData = row.travel_form_data ? JSON.parse(row.travel_form_data) : null; } catch {}
    if (!travelData) { try { travelData = row.travel_details ? JSON.parse(row.travel_details) : null; } catch {} }

    res.json({ data: travelData ? { id: row.id, travelData, createdAt: row.created_at } : null });
  } catch (err) {
    console.error('last-trip error:', err);
    res.status(500).json({ message: 'Failed to fetch last trip' });
  }
});

// GET /api/l1-approvals/:id - Get a single request for L1 approval
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await poolPromise;
    
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT 
          r.*,
          u.firstName as employeeFirstName,
          u.lastName as employeeLastName,
          m.firstName as l1ManagerFirstName,
          m.lastName as l1ManagerLastName,
          m.email as l1ManagerEmail
        FROM petty_cash_requests r
        LEFT JOIN petty_Users u ON r.employee_email = u.email
        LEFT JOIN petty_Users m ON r.l1_manager_id = m.id
        WHERE r.id = @id
      `);
    
    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Request not found' });
    }
    
    const row = result.recordset[0];
    
    // Parse JSON fields
    try {
      row.attachments = row.attachments ? JSON.parse(row.attachments) : [];
    } catch {
      row.attachments = [];
    }
    
    try {
      row.travel_form_data = row.travel_form_data ? JSON.parse(row.travel_form_data) : null;
    } catch {
      row.travel_form_data = null;
    }
    
    // Also parse travel_details if travel_form_data is null
    if (!row.travel_form_data && row.travel_details) {
      try {
        row.travel_form_data = JSON.parse(row.travel_details);
      } catch {
        row.travel_form_data = null;
      }
    }
    
    res.json({ data: row });
  } catch (err) {
    console.error('Error fetching L1 approval request:', err);
    res.status(500).json({ message: 'Failed to fetch L1 approval request' });
  }
});

// PUT /api/l1-approvals/:id/approve - Approve a request at L1 level
router.put('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const { managerEmail, note } = req.body;
    
    const pool = await poolPromise;
    
    // Update request status
    await pool.request()
      .input('id', sql.Int, id)
      .input('note', sql.NVarChar(sql.MAX), note || null)
      .query(`
        UPDATE petty_cash_requests
        SET l1_approval_status = 'approved',
            l1_approved_at = SYSUTCDATETIME(),
            status = 'approved',
            approved_at = SYSUTCDATETIME(),
            l1_rejection_reason = @note
        WHERE id = @id
      `);
    
    // Get updated request
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT * FROM petty_cash_requests WHERE id = @id');
    
    const request = result.recordset[0];
    
    // Parse JSON fields
    try {
      request.attachments = request.attachments ? JSON.parse(request.attachments) : [];
    } catch {
      request.attachments = [];
    }
    
    // Send notification to employee
    try {
      const { subject, html } = buildL1ApprovalNotificationEmail(request, true);
      await sendEmail({ 
        to: request.employee_email, 
        subject, 
        html,
        replyTo: managerEmail
      });
    } catch (e) {
      console.error('Failed to send employee notification:', e);
    }

    // Notify both travel admins that L1 has approved — they need to upload travel details
    try {
      const adminEmails = [
        process.env.ADMIN_EMAIL,
        process.env.TRAVEL_ADMIN_EMAIL,
      ].filter(Boolean);

      // Get L1 manager name for the email
      const managerResult = await pool.request()
        .input('email', sql.NVarChar(320), managerEmail || '')
        .query('SELECT firstName, lastName FROM petty_Users WHERE email = @email');
      const manager = managerResult.recordset[0];
      const managerName = manager ? `${manager.firstName} ${manager.lastName}`.trim() : (managerEmail || 'L1 Manager');

      const approvalSubject = `✅ Travel Request #${request.id} Approved — Action Required`;
      const approvalHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f3f4f6;">
  <div style="max-width:600px;margin:0 auto;padding:20px;">
    <div style="background:#2563EB;padding:28px 24px;border-radius:12px 12px 0 0;text-align:center;">
      <div style="font-size:32px;margin-bottom:8px;">✈️</div>
      <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700;">Travel Request Approved</h1>
      <p style="margin:6px 0 0;color:#dbeafe;font-size:13px;">Trip Reference #${request.id}</p>
    </div>
    <div style="background:#fff;padding:28px 24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
      <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 20px;">
        The following travel request has been <strong style="color:#16a34a;">approved by the L1 manager</strong> and is ready for travel details to be uploaded.
      </p>
      <div style="background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;margin-bottom:24px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px;width:40%;">Employee</td>
            <td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;color:#111827;font-size:14px;font-weight:600;">${request.employee_name}</td>
          </tr>
          <tr>
            <td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px;">Employee Email</td>
            <td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;color:#111827;font-size:14px;">${request.employee_email}</td>
          </tr>
          <tr>
            <td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px;">Approved By</td>
            <td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;color:#111827;font-size:14px;font-weight:600;">${managerName}</td>
          </tr>
          <tr>
            <td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px;">Request ID</td>
            <td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;color:#111827;font-size:14px;">#${request.id}</td>
          </tr>
          <tr>
            <td style="padding:10px 16px;color:#6b7280;font-size:13px;">Approved On</td>
            <td style="padding:10px 16px;color:#111827;font-size:14px;">${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</td>
          </tr>
        </table>
      </div>
      <div style="background:#EFF6FF;border-left:4px solid #2563EB;padding:14px 18px;border-radius:4px;margin-bottom:24px;">
        <p style="margin:0;color:#1e40af;font-size:13px;line-height:1.6;">
          <strong>Action Required:</strong> Please log in to the portal and upload the travel details (flights, hotel, visa, etc.) for this employee.
        </p>
      </div>
      <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">HR PocketPro HR — Automated Notification</p>
    </div>
  </div>
</body></html>`;

      for (const adminEmail of adminEmails) {
        sendEmail({ to: adminEmail, subject: approvalSubject, html: approvalHtml, replyTo: managerEmail })
          .catch((e) => console.error(`Failed to send admin approval notification to ${adminEmail}:`, e.message));
      }
    } catch (e) {
      console.error('Failed to send admin L1 approval notification:', e);
    }

    // Auto-book Teams/Outlook calendar event for the employee
    try {
      let travelData = null;
      try { travelData = request.travel_form_data ? JSON.parse(request.travel_form_data) : null; } catch {}
      if (!travelData) { try { travelData = request.travel_details ? JSON.parse(request.travel_details) : null; } catch {} }

      if (travelData) {
        const { startDate, endDate } = extractTravelDates(travelData);
        if (startDate) {
          const tripSummary = buildTripSummary(travelData);
          await bookTravelCalendarEvent({
            employeeEmail: request.employee_email,
            employeeName: request.employee_name,
            startDate,
            endDate: endDate || startDate,
            tripSummary,
            requestId: request.id,
          });
        }
      }
    } catch (e) {
      console.error('Failed to book Teams calendar event:', e);
    }

    res.json({ message: 'Request approved at L1 level', data: request });
  } catch (err) {
    console.error('Error approving L1 request:', err);
    res.status(500).json({ message: 'Failed to approve request' });
  }
});

// PUT /api/l1-approvals/:id/reject - Reject a request at L1 level
router.put('/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const { managerEmail, reason } = req.body;
    
    if (!reason) {
      return res.status(400).json({ message: 'Rejection reason is required' });
    }
    
    const pool = await poolPromise;
    
    // Update request status
    await pool.request()
      .input('id', sql.Int, id)
      .input('reason', sql.NVarChar(sql.MAX), reason)
      .query(`
        UPDATE petty_cash_requests
        SET l1_approval_status = 'rejected',
            status = 'rejected',
            l1_rejection_reason = @reason,
            rejected_at = SYSUTCDATETIME()
        WHERE id = @id
      `);
    
    // Get updated request
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT * FROM petty_cash_requests WHERE id = @id');
    
    const request = result.recordset[0];
    
    // Send notification to employee
    try {
      const { subject, html } = buildL1ApprovalNotificationEmail(request, false);
      await sendEmail({ 
        to: request.employee_email, 
        subject, 
        html,
        replyTo: managerEmail
      });
    } catch (e) {
      console.error('Failed to send employee notification:', e);
    }
    
    res.json({ message: 'Request rejected at L1 level', data: request });
  } catch (err) {
    console.error('Error rejecting L1 request:', err);
    res.status(500).json({ message: 'Failed to reject request' });
  }
});

module.exports = router;

