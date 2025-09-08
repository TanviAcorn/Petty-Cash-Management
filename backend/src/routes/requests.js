const express = require('express');
const router = express.Router();
const sql = require('mssql');
const { poolPromise } = require('../config/db');

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

// POST /api/requests - create a new petty cash request
router.post('/', async (req, res) => {
  try {
    const {
      employeeName,
      employeeEmail,
      company, // optional
      category,
      amount,
      description, // reason
    } = req.body || {};

    if (!employeeName || !employeeEmail || !category || !amount) {
      return res.status(400).json({ message: 'employeeName, employeeEmail, category and amount are required' });
    }

    const pool = await poolPromise;
    const request = pool.request()
      .input('employeeName', sql.NVarChar(200), String(employeeName))
      .input('employeeEmail', sql.NVarChar(320), String(employeeEmail))
      .input('company', sql.NVarChar(200), company ? String(company) : null)
      .input('category', sql.NVarChar(200), String(category))
      .input('amount', sql.Decimal(18, 2), Number(amount))
      .input('reason', sql.NVarChar(sql.MAX), description ? String(description) : null)
      .input('status', sql.VarChar(20), 'pending');

    const insertSql = `
      INSERT INTO petty_cash_requests (employee_name, employee_email, company_name, category_name, amount, status, reason, created_at)
      OUTPUT INSERTED.*
      VALUES (@employeeName, @employeeEmail, @company, @category, @amount, @status, @reason, SYSUTCDATETIME())
    `;

    const result = await request.query(insertSql);
    const row = result.recordset?.[0] || null;
    return res.status(201).json(row);
  } catch (err) {
    console.error('Error creating request:', err);
    return res.status(500).json({ message: 'Failed to create request' });
  }
});

module.exports = router;
