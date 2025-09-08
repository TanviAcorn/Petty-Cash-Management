const express = require('express');
const router = express.Router();
const sql = require('mssql');
const { poolPromise } = require('../config/db');

// GET /api/requests
router.get('/', async (req, res) => {
  const { status, q, company, category, range } = req.query;

  // Build dynamic WHERE clause safely
  const where = [];
  const params = {};

  if (status) {
    where.push('r.status = @status');
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
  if (q) {
    where.push("(LOWER(r.employee_name) LIKE @q OR LOWER(r.employee_email) LIKE @q OR LOWER(r.company_name) LIKE @q OR LOWER(r.category_name) LIKE @q OR LOWER(ISNULL(r.reason, '')) LIKE @q)");
    params.q = { type: sql.NVarChar(400), value: `%${String(q).toLowerCase()}%` };
  }
  if (range && range !== 'all') {
    if (range === '7d') where.push('r.rejected_at >= DATEADD(day, -7, SYSUTCDATETIME())');
    else if (range === '30d') where.push('r.rejected_at >= DATEADD(day, -30, SYSUTCDATETIME())');
    else if (range === 'year') where.push('YEAR(r.rejected_at) = YEAR(SYSUTCDATETIME())');
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const query = `
    SELECT 
      r.id,
      r.employee_name AS employeeName,
      r.employee_email AS employeeEmail,
      r.company_name AS company,
      r.category_name AS category,
      r.amount,
      r.created_at AS date, -- original request date
      r.rejected_at AS rejectedAt,
      r.status,
      r.reason
    FROM petty_cash_requests r
    ${whereSql}
    ORDER BY CASE WHEN r.rejected_at IS NULL THEN 1 ELSE 0 END, r.rejected_at DESC, r.created_at DESC
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

module.exports = router;
