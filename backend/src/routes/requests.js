const express = require('express');
const router = express.Router();
const sql = require('mssql');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { poolPromise } = require('../config/db');

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
  const { status, q, company, category, range, email } = req.query;

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
    } = req.body || {};

    console.log('Extracted fields:', {
      employeeName,
      employeeEmail,
      company,
      category,
      amount,
      description,
      dateOfPurchase
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
      INSERT INTO petty_cash_requests (employee_name, employee_email, company_name, category_name, amount, status, reason, created_at, approved_at, rejected_at, attachments, date_of_purchase)
      OUTPUT INSERTED.*
      VALUES (@employeeName, @employeeEmail, @company, @category, @amount, @status, @reason, SYSUTCDATETIME(), NULL, NULL, @attachments, @dateOfPurchase)
    `;

    const result = await request.query(insertSql);
    console.log('SQL insert successful:', result.recordset?.[0]);
    const newRequest = result.recordset?.[0] || null;
    
    if (newRequest) {
      // Optional: Add the uploaded file info to the response
      newRequest.uploadedFiles = attachmentPaths;
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
    return res.json(result.recordset?.[0] || { id });
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
    return res.json(result.recordset?.[0] || { id });
  } catch (err) {
    console.error('Error rejecting request:', err);
    return res.status(500).json({ message: 'Failed to reject request' });
  }
});

module.exports = router;
