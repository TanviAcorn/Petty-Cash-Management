const express = require('express');
const router = express.Router();
const sql = require('mssql');
const { poolPromise } = require('../config/db');

async function ensureCostsTable(pool) {
  await pool.request().query(`
    IF OBJECT_ID('dbo.petty_travel_costs','U') IS NULL
    CREATE TABLE dbo.petty_travel_costs (
      id INT IDENTITY(1,1) PRIMARY KEY,
      request_id INT NOT NULL,
      employee_name NVARCHAR(200) NULL,
      employee_email NVARCHAR(320) NULL,
      trip_summary NVARCHAR(500) NULL,
      travel_date DATE NULL,
      flight_cost DECIMAL(10,2) NULL,
      hotel_cost DECIMAL(10,2) NULL,
      food_cost DECIMAL(10,2) NULL,
      car_park_cost DECIMAL(10,2) NULL,
      visa_cost DECIMAL(10,2) NULL,
      baggage_cost DECIMAL(10,2) NULL,
      transport_cost DECIMAL(10,2) NULL,
      other_cost DECIMAL(10,2) NULL,
      cancellation_cost DECIMAL(10,2) NULL,
      other_notes NVARCHAR(500) NULL,
      total_cost AS (ISNULL(flight_cost,0)+ISNULL(hotel_cost,0)+ISNULL(food_cost,0)+
                     ISNULL(car_park_cost,0)+ISNULL(visa_cost,0)+ISNULL(baggage_cost,0)+
                     ISNULL(transport_cost,0)+ISNULL(other_cost,0)+ISNULL(cancellation_cost,0)) PERSISTED,
      currency NVARCHAR(10) DEFAULT 'GBP',
      created_by NVARCHAR(320) NULL,
      created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
      updated_at DATETIME2 NULL
    );
    -- Add cancellation_cost column if table already existed without it
    IF COL_LENGTH('dbo.petty_travel_costs','cancellation_cost') IS NULL
      ALTER TABLE dbo.petty_travel_costs ADD cancellation_cost DECIMAL(10,2) NULL;
  `);
}

// GET /api/travel-costs — list all cost records with optional date filter
router.get('/', async (req, res) => {
  try {
    const pool = await poolPromise;
    await ensureCostsTable(pool);

    const { from, to } = req.query;
    const where = [];
    const request = pool.request();

    if (from) {
      where.push('travel_date >= @from');
      request.input('from', sql.Date, new Date(from));
    }
    if (to) {
      where.push('travel_date <= @to');
      request.input('to', sql.Date, new Date(to));
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const result = await request.query(`
      SELECT * FROM petty_travel_costs
      ${whereClause}
      ORDER BY created_at DESC
    `);

    res.json({ data: result.recordset });
  } catch (err) {
    console.error('travel-costs GET error:', err);
    res.status(500).json({ message: 'Failed to fetch travel costs' });
  }
});

// GET /api/travel-costs/summary — aggregate totals
router.get('/summary', async (req, res) => {
  try {
    const pool = await poolPromise;
    await ensureCostsTable(pool);

    const { from, to } = req.query;
    const where = [];
    const request = pool.request();

    if (from) {
      where.push('travel_date >= @from');
      request.input('from', sql.Date, new Date(from));
    }
    if (to) {
      where.push('travel_date <= @to');
      request.input('to', sql.Date, new Date(to));
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const result = await request.query(`
      SELECT
        COUNT(*) AS total_requests,
        SUM(total_cost)     AS grand_total,
        SUM(flight_cost)    AS total_flights,
        SUM(hotel_cost)     AS total_hotel,
        SUM(food_cost)      AS total_food,
        SUM(car_park_cost)  AS total_car_park,
        SUM(visa_cost)      AS total_visa,
        SUM(baggage_cost)   AS total_baggage,
        SUM(transport_cost) AS total_transport,
        SUM(other_cost)     AS total_other
      FROM petty_travel_costs
      ${whereClause}
    `);

    res.json({ data: result.recordset[0] });
  } catch (err) {
    console.error('travel-costs summary error:', err);
    res.status(500).json({ message: 'Failed to fetch summary' });
  }
});

module.exports = router;
