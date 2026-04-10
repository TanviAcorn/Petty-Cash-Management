const express = require('express');
const router = express.Router();
const sql = require('mssql');
const crypto = require('crypto');
const { poolPromise } = require('../config/db');

// Ensure petty_travel_feedback table exists
async function ensureFeedbackTable(pool) {
  await pool.request().query(`
    IF OBJECT_ID('dbo.petty_travel_feedback', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.petty_travel_feedback (
        id INT IDENTITY(1,1) PRIMARY KEY,
        request_id INT NOT NULL,
        token NVARCHAR(64) NOT NULL UNIQUE,
        employee_email NVARCHAR(320) NOT NULL,
        sent_at DATETIME2 NULL,
        submitted_at DATETIME2 NULL,
        hotel_rating INT NULL,
        food_rating INT NULL,
        vehicle_rating INT NULL,
        car_park_rating INT NULL,
        flights_rating INT NULL,
        baggage_rating INT NULL,
        overall_rating INT NULL,
        remarks NVARCHAR(MAX) NULL,
        hotel_remarks NVARCHAR(MAX) NULL,
        food_remarks NVARCHAR(MAX) NULL,
        vehicle_remarks NVARCHAR(MAX) NULL,
        car_park_remarks NVARCHAR(MAX) NULL,
        flights_remarks NVARCHAR(MAX) NULL,
        baggage_remarks NVARCHAR(MAX) NULL
      );
    END
    ELSE
    BEGIN
      IF COL_LENGTH('dbo.petty_travel_feedback','baggage_rating') IS NULL
        ALTER TABLE dbo.petty_travel_feedback ADD baggage_rating INT NULL;
      IF COL_LENGTH('dbo.petty_travel_feedback','baggage_remarks') IS NULL
        ALTER TABLE dbo.petty_travel_feedback ADD baggage_remarks NVARCHAR(MAX) NULL;
      IF COL_LENGTH('dbo.petty_travel_feedback','sub_ratings') IS NULL
        ALTER TABLE dbo.petty_travel_feedback ADD sub_ratings NVARCHAR(MAX) NULL;
    END
  `);
}

// GET /api/travel-feedback/all — admin view of all submitted feedbacks
router.get('/all', async (req, res) => {
  try {
    const pool = await poolPromise;
    await ensureFeedbackTable(pool);

    const result = await pool.request().query(`
      SELECT
        f.id, f.request_id, f.employee_email, f.sent_at, f.submitted_at,
        f.flights_rating, f.hotel_rating, f.food_rating, f.vehicle_rating,
        f.car_park_rating, f.baggage_rating, f.overall_rating,
        f.flights_remarks, f.hotel_remarks, f.food_remarks, f.vehicle_remarks,
        f.car_park_remarks, f.baggage_remarks, f.remarks, f.sub_ratings,
        r.employee_name, r.travel_form_data
      FROM petty_travel_feedback f
      LEFT JOIN petty_cash_requests r ON r.id = f.request_id
      WHERE f.submitted_at IS NOT NULL
      ORDER BY f.submitted_at DESC
    `);

    const rows = result.recordset.map(row => {
      let travelData = null;
      try { travelData = row.travel_form_data ? JSON.parse(row.travel_form_data) : null; } catch {}
      let subRatings = null;
      try { subRatings = row.sub_ratings ? JSON.parse(row.sub_ratings) : null; } catch {}
      return { ...row, travel_form_data: travelData, sub_ratings: subRatings };
    });

    res.json({ data: rows });
  } catch (err) {
    console.error('feedback all error:', err);
    res.status(500).json({ message: 'Failed to fetch feedbacks' });
  }
});

// GET /api/travel-feedback/:token — fetch request info for the feedback form
router.get('/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const pool = await poolPromise;
    await ensureFeedbackTable(pool);

    const result = await pool.request()
      .input('token', sql.NVarChar(64), token)
      .query(`
        SELECT 
          f.id, f.request_id, f.submitted_at, f.token, f.employee_email,
          f.hotel_rating, f.food_rating, f.vehicle_rating,
          f.car_park_rating, f.flights_rating, f.overall_rating,
          f.remarks, f.hotel_remarks, f.food_remarks,
          f.vehicle_remarks, f.car_park_remarks, f.flights_remarks,
          r.employee_name, r.travel_form_data, r.travel_details,
          r.travel_admin_details,
          r.category_name
        FROM petty_travel_feedback f
        LEFT JOIN petty_cash_requests r ON r.id = f.request_id
        WHERE f.token = @token
      `);

    if (!result.recordset.length) {
      return res.status(404).json({ message: 'Feedback link not found or expired' });
    }

    const row = result.recordset[0];

    // Parse travel form data — for test records (request_id=0) use mock data
    let travelData = null;
    if (row.request_id === 0) {
      travelData = {
        travelType: 'international',
        requirements: { flights: true, food: true },
        roundTrip: { needsHotel: true },
      };
    } else {
      try { travelData = row.travel_form_data ? JSON.parse(row.travel_form_data) : null; } catch {}
      if (!travelData) {
        try { travelData = row.travel_details ? JSON.parse(row.travel_details) : null; } catch {}
      }
    }

    // Parse admin details
    let adminDetails = {};
    try { adminDetails = row.travel_admin_details ? JSON.parse(row.travel_admin_details) : {}; } catch {}

    return res.json({
      data: {
        requestId: row.request_id,
        employeeName: row.employee_name || row.employee_email?.split('@')[0] || 'Employee',
        alreadySubmitted: !!row.submitted_at,
        travelData,
        adminDetails,
        existing: row.submitted_at ? {
          hotelRating: row.hotel_rating,
          foodRating: row.food_rating,
          vehicleRating: row.vehicle_rating,
          carParkRating: row.car_park_rating,
          flightsRating: row.flights_rating,
          overallRating: row.overall_rating,
          remarks: row.remarks,
          hotelRemarks: row.hotel_remarks,
          foodRemarks: row.food_remarks,
          vehicleRemarks: row.vehicle_remarks,
          carParkRemarks: row.car_park_remarks,
          flightsRemarks: row.flights_remarks,
        } : null
      }
    });
  } catch (err) {
    console.error('Error fetching feedback:', err);
    return res.status(500).json({ message: 'Failed to fetch feedback' });
  }
});

// POST /api/travel-feedback/:token — submit feedback
router.post('/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const {
      hotelRating, foodRating, vehicleRating, carParkRating,
      flightsRating, baggageRating, overallRating, remarks,
      hotelRemarks, foodRemarks, vehicleRemarks, carParkRemarks,
      flightsRemarks, baggageRemarks, subRatings
    } = req.body;

    const pool = await poolPromise;
    await ensureFeedbackTable(pool);

    // Check token exists and not already submitted
    const check = await pool.request()
      .input('token', sql.NVarChar(64), token)
      .query('SELECT id, submitted_at FROM petty_travel_feedback WHERE token = @token');

    if (!check.recordset.length) {
      return res.status(404).json({ message: 'Feedback link not found' });
    }
    if (check.recordset[0].submitted_at) {
      return res.status(400).json({ message: 'Feedback already submitted' });
    }

    await pool.request()
      .input('token', sql.NVarChar(64), token)
      .input('hotelRating', sql.Int, hotelRating || null)
      .input('foodRating', sql.Int, foodRating || null)
      .input('vehicleRating', sql.Int, vehicleRating || null)
      .input('carParkRating', sql.Int, carParkRating || null)
      .input('flightsRating', sql.Int, flightsRating || null)
      .input('baggageRating', sql.Int, baggageRating || null)
      .input('overallRating', sql.Int, overallRating || null)
      .input('remarks', sql.NVarChar(sql.MAX), remarks || null)
      .input('hotelRemarks', sql.NVarChar(sql.MAX), hotelRemarks || null)
      .input('foodRemarks', sql.NVarChar(sql.MAX), foodRemarks || null)
      .input('vehicleRemarks', sql.NVarChar(sql.MAX), vehicleRemarks || null)
      .input('carParkRemarks', sql.NVarChar(sql.MAX), carParkRemarks || null)
      .input('flightsRemarks', sql.NVarChar(sql.MAX), flightsRemarks || null)
      .input('baggageRemarks', sql.NVarChar(sql.MAX), baggageRemarks || null)
      .input('subRatings', sql.NVarChar(sql.MAX), subRatings ? JSON.stringify(subRatings) : null)
      .query(`
        UPDATE petty_travel_feedback SET
          submitted_at = SYSUTCDATETIME(),
          hotel_rating = @hotelRating,
          food_rating = @foodRating,
          vehicle_rating = @vehicleRating,
          car_park_rating = @carParkRating,
          flights_rating = @flightsRating,
          baggage_rating = @baggageRating,
          overall_rating = @overallRating,
          remarks = @remarks,
          hotel_remarks = @hotelRemarks,
          food_remarks = @foodRemarks,
          vehicle_remarks = @vehicleRemarks,
          car_park_remarks = @carParkRemarks,
          flights_remarks = @flightsRemarks,
          baggage_remarks = @baggageRemarks,
          sub_ratings = @subRatings
        WHERE token = @token
      `);

    return res.json({ message: 'Feedback submitted successfully' });
  } catch (err) {
    console.error('Error submitting feedback:', err);
    return res.status(500).json({ message: 'Failed to submit feedback' });
  }
});

module.exports = router;
module.exports.ensureFeedbackTable = ensureFeedbackTable;
