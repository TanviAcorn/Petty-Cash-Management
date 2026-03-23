const express = require('express');
const router = express.Router();
const sql = require('mssql');
const { poolPromise } = require('../config/db');

// Ensure visa_types table exists
const ensureTable = async (pool) => {
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='petty_VisaTypes' AND xtype='U')
    CREATE TABLE petty_VisaTypes (
      id INT IDENTITY(1,1) PRIMARY KEY,
      name NVARCHAR(200) NOT NULL,
      description NVARCHAR(500) NULL,
      created_at DATETIME2 DEFAULT SYSUTCDATETIME()
    )
  `);
};

// GET /api/visa-types
router.get('/', async (_req, res) => {
  try {
    const pool = await poolPromise;
    await ensureTable(pool);
    const result = await pool.request().query('SELECT id, name, description FROM petty_VisaTypes ORDER BY name');
    res.json(result.recordset);
  } catch (err) {
    console.error('visa-types GET error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/visa-types
router.post('/', async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ message: 'Name is required' });
    const pool = await poolPromise;
    await ensureTable(pool);
    const result = await pool.request()
      .input('name', sql.NVarChar(200), name.trim())
      .input('description', sql.NVarChar(500), description || null)
      .query('INSERT INTO petty_VisaTypes (name, description) OUTPUT INSERTED.id, INSERTED.name VALUES (@name, @description)');
    res.status(201).json(result.recordset[0]);
  } catch (err) {
    console.error('visa-types POST error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/visa-types/:id
router.delete('/:id', async (req, res) => {
  try {
    const pool = await poolPromise;
    await pool.request().input('id', sql.Int, parseInt(req.params.id)).query('DELETE FROM petty_VisaTypes WHERE id = @id');
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
