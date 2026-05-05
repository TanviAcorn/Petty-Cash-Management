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
      // Admin view — show pending, approved, and cancelled (awaiting refund)
      query += ` AND r.status IN ('pending_l1', 'pending', 'approved', 'cancelled')`;
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
               l1_approval_status, created_at, travel_form_data, travel_docs_sent_at,
               cancellation_status, cancellation_reason, cancellation_requested_at
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


// GET /api/l1-approvals/cancellations — fetch pending cancellation requests for L1 manager
// NOTE: Must be registered BEFORE GET /:id to avoid the wildcard swallowing it
router.get('/cancellations', async (req, res) => {
  try {
    const { managerEmail } = req.query;
    const pool = await poolPromise;

    // Ensure cancellation columns exist before querying
    await pool.request().query(`
      IF COL_LENGTH('dbo.petty_cash_requests','cancellation_status') IS NULL
        ALTER TABLE dbo.petty_cash_requests ADD cancellation_status NVARCHAR(50) NULL;
      IF COL_LENGTH('dbo.petty_cash_requests','cancellation_reason') IS NULL
        ALTER TABLE dbo.petty_cash_requests ADD cancellation_reason NVARCHAR(MAX) NULL;
      IF COL_LENGTH('dbo.petty_cash_requests','cancellation_requested_at') IS NULL
        ALTER TABLE dbo.petty_cash_requests ADD cancellation_requested_at DATETIME2 NULL;
      IF COL_LENGTH('dbo.petty_cash_requests','cancellation_approved_at') IS NULL
        ALTER TABLE dbo.petty_cash_requests ADD cancellation_approved_at DATETIME2 NULL;
    `);

    let query = `
      SELECT r.id, r.employee_name, r.employee_email, r.company_name,
             r.cancellation_status, r.cancellation_reason, r.cancellation_requested_at,
             r.travel_form_data, r.l1_manager_id,
             u.firstName AS employeeFirstName, u.lastName AS employeeLastName
      FROM petty_cash_requests r
      LEFT JOIN petty_Users u ON r.employee_email = u.email
      WHERE (r.category_name = 'Travel Request' OR r.category_name = 'Travel')
        AND r.cancellation_status = 'pending'
    `;

    if (managerEmail) {
      const managerResult = await pool.request()
        .input('email', sql.NVarChar(320), managerEmail)
        .query('SELECT id FROM petty_Users WHERE email = @email');
      if (!managerResult.recordset.length) return res.json({ data: [] });
      const managerId = managerResult.recordset[0].id;
      query += ` AND r.l1_manager_id = ${managerId}`;
    }

    query += ' ORDER BY r.cancellation_requested_at DESC';

    const result = await pool.request().query(query);
    const rows = result.recordset.map(row => {
      let travelData = null;
      try { travelData = row.travel_form_data ? JSON.parse(row.travel_form_data) : null; } catch {}
      return { ...row, travel_form_data: travelData };
    });

    res.json({ data: rows });
  } catch (err) {
    console.error('Error fetching cancellations:', err);
    res.status(500).json({ message: 'Failed to fetch cancellation requests' });
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

// PUT /api/l1-approvals/:id/edit-request — L1 Manager edits travel form data (only while trip is active)
router.put('/:id/edit-request', async (req, res) => {
  try {
    const { id } = req.params;
    const { travelFormData, editedBy, skipEmail } = req.body;

    if (!travelFormData) return res.status(400).json({ message: 'Travel form data is required' });

    const pool = await poolPromise;

    // Fetch current request
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT * FROM petty_cash_requests WHERE id = @id');

    if (!result.recordset.length) return res.status(404).json({ message: 'Request not found' });
    const request = result.recordset[0];

    // Only allow editing approved requests
    if (request.l1_approval_status !== 'approved') {
      return res.status(403).json({ message: 'Only approved requests can be edited' });
    }

    // Check trip lock on backend too (safety check)
    let td = null;
    try { td = request.travel_form_data ? JSON.parse(request.travel_form_data) : null; } catch {}

    const getTripEndDate = (data) => {
      if (!data) return null;
      if (data.travelType === 'domestic') return data.domesticDateFlexTo || data.dateOfTravel || null;
      if (data.tripType === 'multiCity' && data.multiCityLegs?.length) {
        const last = data.multiCityLegs[data.multiCityLegs.length - 1];
        return last?.dateFlexTo || last?.date || null;
      }
      return data.roundTrip?.arrivalDateFlexTo || data.roundTrip?.arrivalDate || null;
    };

    const endDate = getTripEndDate(td);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      if (new Date() > end) {
        return res.status(403).json({ message: 'Trip has ended — request is locked and cannot be edited' });
      }
    }

    // Count existing updates to get next update_number
    const countResult = await pool.request()
      .input('rid', sql.Int, id)
      .query('SELECT COUNT(*) AS cnt FROM petty_travel_request_updates WHERE request_id = @rid');
    const updateNumber = (countResult.recordset[0]?.cnt || 0) + 1;

    // Store NEW updated form data into petty_travel_request_updates
    // Original travel_form_data in petty_cash_requests stays UNTOUCHED
    await pool.request()
      .input('rid', sql.Int, id)
      .input('updateNum', sql.Int, updateNumber)
      .input('formDataJson', sql.NVarChar(sql.MAX), JSON.stringify(travelFormData))
      .input('editedBy', sql.NVarChar(320), editedBy || null)
      .input('notified', sql.Bit, skipEmail ? 0 : 1)
      .query(`
        INSERT INTO petty_travel_request_updates (request_id, update_number, form_data_json, edited_by, notified_user)
        VALUES (@rid, @updateNum, @formDataJson, @editedBy, @notified)
      `);

    // Send notification email to employee (unless skipEmail)
    if (!skipEmail) {
      try {
      const tf = travelFormData;
      const isIntl = tf.travelType === 'international';

      // Build a simple summary of what the trip looks like now
      let tripSummary = '';
      if (isIntl && tf.tripType === 'roundTrip' && tf.roundTrip) {
        tripSummary = `${tf.roundTrip.fromCity || ''} → ${tf.roundTrip.toCity || ''}, ${tf.countryOfTravel || ''}`;
      } else if (isIntl && tf.tripType === 'multiCity') {
        tripSummary = `Multi-City, ${tf.countryOfTravel || ''}`;
      } else if (!isIntl) {
        tripSummary = `Domestic — ${tf.cityOfTravelDomestic || ''}`;
      }

      const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5174').split(',')[0].trim();

      const subject = `Travel Request #${id} — Details Updated by Your Manager`;
      const html = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
        <body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
          <div style="max-width:600px;margin:0 auto;padding:20px;">
            <div style="background:#7C3AED;padding:30px 20px;border-radius:8px 8px 0 0;">
              <h1 style="margin:0;color:#fff;font-size:22px;font-weight:600;">Travel Request Updated</h1>
            </div>
            <div style="background:#fff;padding:30px 20px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
              <p style="margin:0 0 20px 0;color:#374151;font-size:15px;line-height:1.5;">
                Your L1 Manager has updated the details of your travel request. Please review the changes below.
              </p>
              <table style="width:100%;border-collapse:collapse;margin-bottom:25px;background:#f9fafb;border-radius:6px;overflow:hidden;">
                <tr>
                  <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px;width:140px;">Request ID</td>
                  <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;color:#111827;font-size:14px;font-weight:500;">#${id}</td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px;">Trip</td>
                  <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;color:#111827;font-size:14px;">${tripSummary || 'Travel Request'}</td>
                </tr>
                ${tf.roundTrip?.departureDate ? `
                <tr>
                  <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px;">Departure Date</td>
                  <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;color:#111827;font-size:14px;">${tf.roundTrip.departureDate}</td>
                </tr>` : ''}
                ${tf.roundTrip?.arrivalDate ? `
                <tr>
                  <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px;">Return Date</td>
                  <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;color:#111827;font-size:14px;">${tf.roundTrip.arrivalDate}</td>
                </tr>` : ''}
                ${tf.dateOfTravel ? `
                <tr>
                  <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px;">Date of Travel</td>
                  <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;color:#111827;font-size:14px;">${tf.dateOfTravel}</td>
                </tr>` : ''}
                ${tf.reasonOfTravel ? `
                <tr>
                  <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px;">Reason</td>
                  <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;color:#111827;font-size:14px;">${tf.reasonOfTravel}</td>
                </tr>` : ''}
                ${editedBy ? `
                <tr>
                  <td style="padding:12px 16px;color:#6b7280;font-size:13px;">Updated By</td>
                  <td style="padding:12px 16px;color:#111827;font-size:14px;">${editedBy}</td>
                </tr>` : ''}
              </table>
              <div style="text-align:center;margin:25px 0;">
                <a href="${frontendUrl}/my-travel-requests" style="display:inline-block;background:#7C3AED;color:#fff;padding:12px 32px;text-decoration:none;border-radius:6px;font-weight:500;font-size:14px;">View My Travel Requests</a>
              </div>
              <p style="margin:20px 0 0 0;color:#6b7280;font-size:13px;text-align:center;">
                If you have any questions, please contact your manager directly.
              </p>
            </div>
            <div style="margin-top:20px;padding:15px;text-align:center;color:#9ca3af;font-size:12px;">
              <p style="margin:0;">This is an automated notification from PocketPro HR.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      await sendEmail({
        to: request.employee_email,
        subject,
        html,
      });
      } catch (emailErr) {
        console.error('[L1 Edit] Email notification failed (non-fatal):', emailErr.message);
      }
    }

    res.json({ message: 'Travel request updated successfully' });
  } catch (err) {
    console.error('Error editing travel request:', err);
    res.status(500).json({ message: 'Failed to update travel request' });
  }
});

// ── CANCELLATION FLOW ────────────────────────────────────────────────────────

// POST /api/l1-approvals/:id/request-cancellation
// Employee requests cancellation of their approved travel request
router.post('/:id/request-cancellation', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, employeeEmail } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ message: 'Cancellation reason is required' });
    }

    const pool = await poolPromise;

    // Ensure cancellation columns exist
    await pool.request().query(`
      IF COL_LENGTH('dbo.petty_cash_requests','cancellation_status') IS NULL
        ALTER TABLE dbo.petty_cash_requests ADD cancellation_status NVARCHAR(50) NULL;
      IF COL_LENGTH('dbo.petty_cash_requests','cancellation_reason') IS NULL
        ALTER TABLE dbo.petty_cash_requests ADD cancellation_reason NVARCHAR(MAX) NULL;
      IF COL_LENGTH('dbo.petty_cash_requests','cancellation_requested_at') IS NULL
        ALTER TABLE dbo.petty_cash_requests ADD cancellation_requested_at DATETIME2 NULL;
      IF COL_LENGTH('dbo.petty_cash_requests','cancellation_approved_at') IS NULL
        ALTER TABLE dbo.petty_cash_requests ADD cancellation_approved_at DATETIME2 NULL;
    `);

    // Fetch request
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT * FROM petty_cash_requests WHERE id = @id');

    if (!result.recordset.length) return res.status(404).json({ message: 'Request not found' });
    const request = result.recordset[0];

    // Only allow cancellation on approved requests
    if (request.l1_approval_status !== 'approved') {
      return res.status(400).json({ message: 'Only approved travel requests can be cancelled' });
    }

    // Prevent duplicate cancellation requests
    if (request.cancellation_status === 'pending') {
      return res.status(400).json({ message: 'A cancellation request is already pending' });
    }
    if (request.cancellation_status === 'approved') {
      return res.status(400).json({ message: 'This request has already been cancelled' });
    }

    // Set cancellation_status to 'pending'
    await pool.request()
      .input('id', sql.Int, id)
      .input('reason', sql.NVarChar(sql.MAX), reason.trim())
      .query(`
        UPDATE petty_cash_requests
        SET cancellation_status = 'pending',
            cancellation_reason = @reason,
            cancellation_requested_at = SYSUTCDATETIME()
        WHERE id = @id
      `);

    // Parse travel data for email summary
    let travelData = null;
    try { travelData = request.travel_form_data ? JSON.parse(request.travel_form_data) : null; } catch {}

    // Build trip summary
    let tripSummary = 'Travel Request';
    if (travelData) {
      if (travelData.travelType === 'domestic') tripSummary = `Domestic → ${travelData.cityOfTravelDomestic || ''}`;
      else if (travelData.tripType === 'roundTrip' && travelData.roundTrip)
        tripSummary = `${travelData.roundTrip.fromCity || ''} → ${travelData.roundTrip.toCity || ''}, ${travelData.countryOfTravel || ''}`;
      else if (travelData.tripType === 'multiCity') tripSummary = `Multi-City, ${travelData.countryOfTravel || ''}`;
    }

    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5174').split(',')[0].trim();

    // Notify L1 manager
    try {
      const managerResult = await pool.request()
        .input('id', sql.Int, request.l1_manager_id)
        .query('SELECT firstName, lastName, email FROM petty_Users WHERE id = @id');
      const manager = managerResult.recordset[0];

      if (manager?.email) {
        const subject = `✈️ Cancellation Request — Trip #${id} (${request.employee_name})`;
        const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f3f4f6;">
  <div style="max-width:600px;margin:0 auto;padding:20px;">
    <div style="background:#DC2626;padding:28px 24px;border-radius:12px 12px 0 0;text-align:center;">
      <div style="font-size:32px;margin-bottom:8px;">✈️</div>
      <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700;">Flight Cancellation Request</h1>
      <p style="margin:6px 0 0;color:#fecaca;font-size:13px;">Trip Reference #${id}</p>
    </div>
    <div style="background:#fff;padding:28px 24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
      <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 20px;">
        Dear ${manager.firstName || 'Manager'},<br><br>
        <strong>${request.employee_name}</strong> has requested to cancel their approved travel request and is seeking a refund.
      </p>
      <div style="background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;margin-bottom:24px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px;width:40%;">Employee</td><td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;color:#111827;font-size:14px;font-weight:600;">${request.employee_name}</td></tr>
          <tr><td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px;">Trip</td><td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;color:#111827;font-size:14px;">${tripSummary}</td></tr>
          <tr><td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px;">Request ID</td><td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;color:#111827;font-size:14px;">#${id}</td></tr>
          <tr><td style="padding:10px 16px;color:#6b7280;font-size:13px;">Reason</td><td style="padding:10px 16px;color:#111827;font-size:14px;">${reason.trim()}</td></tr>
        </table>
      </div>
      <div style="background:#FEF2F2;border-left:4px solid #DC2626;padding:14px 18px;border-radius:4px;margin-bottom:24px;">
        <p style="margin:0;color:#991B1B;font-size:13px;line-height:1.6;"><strong>Action Required:</strong> Please review and approve or reject this cancellation request. If approved, it will be forwarded to admin for refund processing.</p>
      </div>
      <div style="text-align:center;margin:24px 0;">
        <a href="${frontendUrl}/l1-approvals?requestId=${id}" style="display:inline-block;background:#DC2626;color:#fff;padding:12px 32px;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px;">Review Cancellation Request</a>
      </div>
      <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">PocketPro HR — Automated Notification</p>
    </div>
  </div>
</body></html>`;
        await sendEmail({ to: manager.email, subject, html });
      }
    } catch (emailErr) {
      console.error('[Cancellation] L1 notification failed (non-fatal):', emailErr.message);
    }

    res.json({ message: 'Cancellation request submitted successfully' });
  } catch (err) {
    console.error('Error submitting cancellation request:', err);
    res.status(500).json({ message: 'Failed to submit cancellation request' });
  }
});

// POST /api/l1-approvals/:id/resend-cancellation-email
// Resend the cancellation approval email to the employee (for cases where it was missed)
router.post('/:id/resend-cancellation-email', async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await poolPromise;

    const result = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT * FROM petty_cash_requests WHERE id = @id');

    if (!result.recordset.length) return res.status(404).json({ message: 'Request not found' });
    const request = result.recordset[0];

    if (request.cancellation_status !== 'approved') {
      return res.status(400).json({ message: 'Cancellation has not been approved for this request' });
    }

    // Parse travel data for trip summary
    let travelData = null;
    try { travelData = request.travel_form_data ? JSON.parse(request.travel_form_data) : null; } catch {}
    let tripSummary = 'Travel Request';
    if (travelData) {
      if (travelData.travelType === 'domestic') tripSummary = `Domestic → ${travelData.cityOfTravelDomestic || ''}`;
      else if (travelData.tripType === 'roundTrip' && travelData.roundTrip)
        tripSummary = `${travelData.roundTrip.fromCity || ''} → ${travelData.roundTrip.toCity || ''}, ${travelData.countryOfTravel || ''}`;
      else if (travelData.tripType === 'multiCity') tripSummary = `Multi-City, ${travelData.countryOfTravel || ''}`;
    }

    const subject = `✅ Your Flight Cancellation Has Been Approved — Trip #${id}`;
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f3f4f6;">
  <div style="max-width:600px;margin:0 auto;padding:20px;">
    <div style="background:#16A34A;padding:28px 24px;border-radius:12px 12px 0 0;text-align:center;">
      <div style="font-size:32px;margin-bottom:8px;">✅</div>
      <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700;">Flight Cancellation Approved</h1>
      <p style="margin:6px 0 0;color:#bbf7d0;font-size:13px;">Trip Reference #${id}</p>
    </div>
    <div style="background:#fff;padding:28px 24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
      <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 20px;">
        Hi <strong>${request.employee_name}</strong>,<br><br>
        Your flight cancellation request for Trip #${id} has been <strong style="color:#16A34A;">approved by your L1 manager</strong> and has been forwarded to admin for refund processing.
      </p>
      <div style="background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;margin-bottom:24px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px;width:40%;">Request ID</td><td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;color:#111827;font-size:14px;font-weight:600;">#${id}</td></tr>
          <tr><td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px;">Trip</td><td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;color:#111827;font-size:14px;">${tripSummary}</td></tr>
          <tr><td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px;">Cancellation Reason</td><td style="padding:10px 16px;color:#111827;font-size:14px;">${request.cancellation_reason || '—'}</td></tr>
        </table>
      </div>
      <div style="background:#F0FDF4;border-left:4px solid #16A34A;padding:14px 18px;border-radius:4px;margin-bottom:20px;">
        <p style="margin:0;color:#15803D;font-size:13px;line-height:1.6;">
          <strong>Next Steps:</strong> Admin will review and process your refund. You will be notified once the refund has been initiated.
        </p>
      </div>
      <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">PocketPro HR — Automated Notification</p>
    </div>
  </div>
</body></html>`;

    await sendEmail({ to: request.employee_email, subject, html });
    console.log(`[Cancellation] Resent cancellation approval email for #${id} to ${request.employee_email}`);
    res.json({ message: `Cancellation email sent to ${request.employee_email}` });
  } catch (err) {
    console.error('Error resending cancellation email:', err);
    res.status(500).json({ message: 'Failed to resend cancellation email' });
  }
});

// PUT /api/l1-approvals/:id/approve-cancellation
// L1 manager approves the cancellation → notifies admin for refund
router.put('/:id/approve-cancellation', async (req, res) => {
  try {
    const { id } = req.params;
    const { managerEmail } = req.body;

    const pool = await poolPromise;

    const result = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT * FROM petty_cash_requests WHERE id = @id');

    if (!result.recordset.length) return res.status(404).json({ message: 'Request not found' });
    const request = result.recordset[0];

    if (request.cancellation_status !== 'pending') {
      return res.status(400).json({ message: 'No pending cancellation request found' });
    }

    // Approve cancellation — mark request as cancelled
    await pool.request()
      .input('id', sql.Int, id)
      .query(`
        UPDATE petty_cash_requests
        SET cancellation_status = 'approved',
            cancellation_approved_at = SYSUTCDATETIME(),
            status = 'cancelled'
        WHERE id = @id
      `);

    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5174').split(',')[0].trim();

    // Parse travel data for summary
    let travelData = null;
    try { travelData = request.travel_form_data ? JSON.parse(request.travel_form_data) : null; } catch {}
    let tripSummary = 'Travel Request';
    if (travelData) {
      if (travelData.travelType === 'domestic') tripSummary = `Domestic → ${travelData.cityOfTravelDomestic || ''}`;
      else if (travelData.tripType === 'roundTrip' && travelData.roundTrip)
        tripSummary = `${travelData.roundTrip.fromCity || ''} → ${travelData.roundTrip.toCity || ''}, ${travelData.countryOfTravel || ''}`;
      else if (travelData.tripType === 'multiCity') tripSummary = `Multi-City, ${travelData.countryOfTravel || ''}`;
    }

    // Get manager name
    const managerResult = await pool.request()
      .input('email', sql.NVarChar(320), managerEmail || '')
      .query('SELECT firstName, lastName FROM petty_Users WHERE email = @email');
    const manager = managerResult.recordset[0];
    const managerName = manager ? `${manager.firstName} ${manager.lastName}`.trim() : (managerEmail || 'L1 Manager');

    // Notify employee
    try {
      const subject = `✅ Cancellation Approved — Trip #${id}`;
      const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f3f4f6;">
  <div style="max-width:600px;margin:0 auto;padding:20px;">
    <div style="background:#16A34A;padding:28px 24px;border-radius:12px 12px 0 0;text-align:center;">
      <div style="font-size:32px;margin-bottom:8px;">✅</div>
      <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700;">Cancellation Approved</h1>
      <p style="margin:6px 0 0;color:#bbf7d0;font-size:13px;">Trip Reference #${id}</p>
    </div>
    <div style="background:#fff;padding:28px 24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
      <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 20px;">
        Hi <strong>${request.employee_name}</strong>,<br><br>
        Your cancellation request for Trip #${id} has been <strong style="color:#16A34A;">approved by your L1 manager</strong>. It has been forwarded to admin for refund processing.
      </p>
      <div style="background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;margin-bottom:24px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px;width:40%;">Trip</td><td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;color:#111827;font-size:14px;">${tripSummary}</td></tr>
          <tr><td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px;">Approved By</td><td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;color:#111827;font-size:14px;font-weight:600;">${managerName}</td></tr>
          <tr><td style="padding:10px 16px;color:#6b7280;font-size:13px;">Reason</td><td style="padding:10px 16px;color:#111827;font-size:14px;">${request.cancellation_reason || '—'}</td></tr>
        </table>
      </div>
      <p style="color:#374151;font-size:14px;line-height:1.6;">Admin will process your refund shortly. You will be notified once the refund is initiated.</p>
      <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">PocketPro HR — Automated Notification</p>
    </div>
  </div>
</body></html>`;
      await sendEmail({ to: request.employee_email, subject, html, replyTo: managerEmail });
    } catch (e) { console.error('[Cancellation] Employee notification failed:', e.message); }

    // Notify admin for refund
    try {
      const adminEmails = [process.env.ADMIN_EMAIL, process.env.TRAVEL_ADMIN_EMAIL].filter(Boolean);
      const subject = `💰 Refund Required — Cancelled Trip #${id} (${request.employee_name})`;
      const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f3f4f6;">
  <div style="max-width:600px;margin:0 auto;padding:20px;">
    <div style="background:#7C3AED;padding:28px 24px;border-radius:12px 12px 0 0;text-align:center;">
      <div style="font-size:32px;margin-bottom:8px;">💰</div>
      <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700;">Refund Request — Action Required</h1>
      <p style="margin:6px 0 0;color:#e9d5ff;font-size:13px;">Trip Reference #${id}</p>
    </div>
    <div style="background:#fff;padding:28px 24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
      <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 20px;">
        A travel cancellation has been <strong>approved by the L1 manager</strong>. Please process the refund for the following employee.
      </p>
      <div style="background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;margin-bottom:24px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px;width:40%;">Employee</td><td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;color:#111827;font-size:14px;font-weight:600;">${request.employee_name}</td></tr>
          <tr><td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px;">Email</td><td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;color:#111827;font-size:14px;">${request.employee_email}</td></tr>
          <tr><td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px;">Trip</td><td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;color:#111827;font-size:14px;">${tripSummary}</td></tr>
          <tr><td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px;">Request ID</td><td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;color:#111827;font-size:14px;">#${id}</td></tr>
          <tr><td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px;">Approved By</td><td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;color:#111827;font-size:14px;font-weight:600;">${managerName}</td></tr>
          <tr><td style="padding:10px 16px;color:#6b7280;font-size:13px;">Cancellation Reason</td><td style="padding:10px 16px;color:#111827;font-size:14px;">${request.cancellation_reason || '—'}</td></tr>
        </table>
      </div>
      <div style="background:#EFF6FF;border-left:4px solid #7C3AED;padding:14px 18px;border-radius:4px;margin-bottom:24px;">
        <p style="margin:0;color:#5B21B6;font-size:13px;line-height:1.6;"><strong>Action Required:</strong> Please process the refund for this cancelled travel request and notify the employee once complete.</p>
      </div>
      <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">PocketPro HR — Automated Notification</p>
    </div>
  </div>
</body></html>`;
      for (const adminEmail of adminEmails) {
        sendEmail({ to: adminEmail, subject, html, replyTo: managerEmail })
          .catch(e => console.error(`[Cancellation] Admin notification failed for ${adminEmail}:`, e.message));
      }
    } catch (e) { console.error('[Cancellation] Admin notification failed:', e.message); }

    res.json({ message: 'Cancellation approved and admin notified for refund' });
  } catch (err) {
    console.error('Error approving cancellation:', err);
    res.status(500).json({ message: 'Failed to approve cancellation' });
  }
});

// PUT /api/l1-approvals/:id/reject-cancellation
// L1 manager rejects the cancellation request
router.put('/:id/reject-cancellation', async (req, res) => {
  try {
    const { id } = req.params;
    const { managerEmail, rejectionNote } = req.body;

    const pool = await poolPromise;

    const result = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT * FROM petty_cash_requests WHERE id = @id');

    if (!result.recordset.length) return res.status(404).json({ message: 'Request not found' });
    const request = result.recordset[0];

    if (request.cancellation_status !== 'pending') {
      return res.status(400).json({ message: 'No pending cancellation request found' });
    }

    // Reset cancellation status — request stays active
    await pool.request()
      .input('id', sql.Int, id)
      .query(`
        UPDATE petty_cash_requests
        SET cancellation_status = 'rejected'
        WHERE id = @id
      `);

    // Notify employee
    try {
      const subject = `❌ Cancellation Rejected — Trip #${id}`;
      const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f3f4f6;">
  <div style="max-width:600px;margin:0 auto;padding:20px;">
    <div style="background:#DC2626;padding:28px 24px;border-radius:12px 12px 0 0;text-align:center;">
      <div style="font-size:32px;margin-bottom:8px;">❌</div>
      <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700;">Cancellation Rejected</h1>
      <p style="margin:6px 0 0;color:#fecaca;font-size:13px;">Trip Reference #${id}</p>
    </div>
    <div style="background:#fff;padding:28px 24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
      <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 20px;">
        Hi <strong>${request.employee_name}</strong>,<br><br>
        Your cancellation request for Trip #${id} has been <strong style="color:#DC2626;">rejected by your L1 manager</strong>. Your travel request remains active.
      </p>
      ${rejectionNote ? `<div style="background:#FEF2F2;border-left:4px solid #DC2626;padding:14px 18px;border-radius:4px;margin-bottom:20px;"><p style="margin:0;color:#991B1B;font-size:14px;"><strong>Reason:</strong> ${rejectionNote}</p></div>` : ''}
      <p style="color:#374151;font-size:14px;line-height:1.6;">If you have questions, please contact your manager directly.</p>
      <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">PocketPro HR — Automated Notification</p>
    </div>
  </div>
</body></html>`;
      await sendEmail({ to: request.employee_email, subject, html, replyTo: managerEmail });
    } catch (e) { console.error('[Cancellation] Employee rejection notification failed:', e.message); }

    res.json({ message: 'Cancellation request rejected' });
  } catch (err) {
    console.error('Error rejecting cancellation:', err);
    res.status(500).json({ message: 'Failed to reject cancellation' });
  }
});

// Also include cancellation_status in my-travel-requests response
// (already returned via SELECT * in the existing endpoint — no change needed)

module.exports = router;

