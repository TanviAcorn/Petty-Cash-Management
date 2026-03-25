const express = require('express');
const router = express.Router();
const sql = require('mssql');
const { poolPromise } = require('../config/db');
const { sendEmail, buildAdminNewRequestEmail, buildL1ApprovalNotificationEmail } = require('../utils/mailer');

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
        AND r.status IN ('pending_l1', 'pending')
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
            status = 'pending',
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
    
    // Send notification to admin
    try {
      const adminTo = process.env.ADMIN_EMAIL;
      if (adminTo) {
        // Prepare attachments for email
        const emailAttachments = [];
        if (request.attachments && request.attachments.length > 0) {
          const fs = require('fs').promises;
          const path = require('path');
          
          for (const attachment of request.attachments) {
            try {
              const filePath = path.join(__dirname, '../../uploads', attachment.filename);
              const fileContent = await fs.readFile(filePath);
              
              emailAttachments.push({
                filename: attachment.originalName,
                content: fileContent,
                contentType: attachment.mimetype || 'application/octet-stream'
              });
            } catch (err) {
              console.error(`Error reading attachment file ${attachment.filename}:`, err);
            }
          }
        }
        
        const { subject, html } = buildAdminNewRequestEmail(request);
        await sendEmail({ 
          to: adminTo, 
          subject: `${subject} (L1 Approved)`, 
          html,
          replyTo: request.employee_email,
          attachments: emailAttachments
        });
      }
    } catch (e) {
      console.error('Failed to send admin notification:', e);
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
