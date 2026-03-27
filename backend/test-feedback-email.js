/**
 * Test script — sends a feedback email using a real request ID
 * Usage: node test-feedback-email.js
 */
require('dotenv').config();
const crypto = require('crypto');
const sql = require('mssql');
const { poolPromise } = require('./src/config/db');
const { sendEmail } = require('./src/utils/mailer');

const TEST_EMAIL = 'Priyal.Makwana@acornuniversalconsultancy.com';

// ── Change this to any travel request ID that has admin details saved ──
const TEST_REQUEST_ID = 245;

function getFrontendBaseUrl() {
  const raw = process.env.FRONTEND_URL || 'http://localhost:5174';
  return String(raw).split(',')[0].trim();
}

async function run() {
  try {
    const pool = await poolPromise;

    // Ensure table exists
    await pool.request().query(`
      IF OBJECT_ID('dbo.petty_travel_feedback','U') IS NULL
      BEGIN
        CREATE TABLE dbo.petty_travel_feedback (
          id INT IDENTITY(1,1) PRIMARY KEY,
          request_id INT NOT NULL,
          token NVARCHAR(64) NOT NULL UNIQUE,
          employee_email NVARCHAR(320) NOT NULL,
          sent_at DATETIME2 NULL, submitted_at DATETIME2 NULL,
          hotel_rating INT NULL, food_rating INT NULL,
          vehicle_rating INT NULL, car_park_rating INT NULL,
          flights_rating INT NULL, baggage_rating INT NULL,
          overall_rating INT NULL,
          remarks NVARCHAR(MAX) NULL,
          hotel_remarks NVARCHAR(MAX) NULL, food_remarks NVARCHAR(MAX) NULL,
          vehicle_remarks NVARCHAR(MAX) NULL, car_park_remarks NVARCHAR(MAX) NULL,
          flights_remarks NVARCHAR(MAX) NULL, baggage_remarks NVARCHAR(MAX) NULL,
          sub_ratings NVARCHAR(MAX) NULL
        );
      END
      ELSE
      BEGIN
        IF COL_LENGTH('dbo.petty_travel_feedback','sub_ratings') IS NULL
          ALTER TABLE dbo.petty_travel_feedback ADD sub_ratings NVARCHAR(MAX) NULL;
      END
    `);

    // Fetch the real request — auto-find latest travel request if ID not found
    let reqResult = await pool.request()
      .input('id', sql.Int, TEST_REQUEST_ID)
      .query('SELECT id, employee_name, employee_email, travel_form_data, travel_details FROM petty_cash_requests WHERE id = @id');

    if (!reqResult.recordset.length) {
      console.log(`⚠️  Request #${TEST_REQUEST_ID} not found — finding latest travel request automatically...`);
      reqResult = await pool.request()
        .query(`SELECT TOP 1 id, employee_name, employee_email, travel_form_data, travel_details 
                FROM petty_cash_requests 
                WHERE category_name IN ('Travel Request', 'Travel')
                ORDER BY id DESC`);
      if (!reqResult.recordset.length) {
        console.error('❌ No travel requests found in the database at all.');
        process.exit(1);
      }
      console.log(`✅ Using request #${reqResult.recordset[0].id} — ${reqResult.recordset[0].employee_name}`);
    }

    const req = reqResult.recordset[0];
    const actualRequestId = req.id;

    // Mock multi-city travel data for testing hotel-per-leg feedback
    const travelData = {
      travelType: 'international',
      tripType: 'multiCity',
      countryOfTravel: 'France',
      requirements: { flights: true, food: true, baggage: true },
      multiCityLegs: [
        { fromCity: 'London',   toCity: 'Paris',    date: '2026-04-01', needsHotel: true,  hotelFrom: '2026-04-01', hotelTo: '2026-04-03' },
        { fromCity: 'Paris',    toCity: 'Brussels', date: '2026-04-03', needsHotel: true,  hotelFrom: '2026-04-03', hotelTo: '2026-04-05' },
        { fromCity: 'Brussels', toCity: 'London',   date: '2026-04-05', needsHotel: false },
      ],
    };

    // Save original travel_form_data before overwriting so we can restore it
    const fs = require('fs');
    const backupPath = `./travel_form_data_backup_${actualRequestId}.json`;
    fs.writeFileSync(backupPath, JSON.stringify({ id: actualRequestId, original: req.travel_form_data || null }));
    console.log(`💾 Original travel_form_data backed up to ${backupPath}`);

    // Temporarily update the request's travel_form_data with mock data for this test
    await pool.request()
      .input('id', sql.Int, actualRequestId)
      .input('data', sql.NVarChar(sql.MAX), JSON.stringify(travelData))
      .query(`UPDATE petty_cash_requests SET travel_form_data = @data WHERE id = @id`);
    console.log(`📝 Temporarily updated travel_form_data on request #${actualRequestId} with mock multi-city data`);

    // Also inject mock admin details (per-leg) so feedback form shows them
    const mockAdminDetails = {
      flights_leg_0: { airline: 'British Airways', flightNumber: 'BA123', departureAirport: 'LHR', arrivalAirport: 'CDG', departureTime: '2026-04-01T08:00', seatNumber: '12A' },
      hotel_leg_0:   { hotelName: 'Hotel Le Marais', hotelAddress: '10 Rue de Rivoli, Paris', checkIn: '2026-04-01T14:00', checkOut: '2026-04-03T11:00' },
      flights_leg_1: { airline: 'Eurostar', flightNumber: 'ES9114', departureAirport: 'Paris Gare du Nord', arrivalAirport: 'Brussels Midi', departureTime: '2026-04-03T10:00', seatNumber: '5C' },
      hotel_leg_1:   { hotelName: 'Hotel Amigo Brussels', hotelAddress: 'Rue de l\'Amigo 1, Brussels', checkIn: '2026-04-03T15:00', checkOut: '2026-04-05T12:00' },
      carPark_leg_0: { carParkName: 'LHR Long Stay', carParkLocation: 'Terminal 5, Heathrow', bayNumber: 'B-204', carParkEntryDate: '2026-04-01T06:00', carParkExitDate: '2026-04-05T18:00' },
      food: { eastEurope: '€40/day', totalMealBudget: '€200' },
      baggage: { baggageAllowance: '23kg', baggageBookingRef: 'BAG-001' },
    };
    await pool.request()
      .input('id', sql.Int, actualRequestId)
      .input('adminDetails', sql.NVarChar(sql.MAX), JSON.stringify(mockAdminDetails))
      .query(`UPDATE petty_cash_requests SET travel_admin_details = @adminDetails WHERE id = @id`);
    console.log(`📝 Injected mock per-leg admin details`);

    // Delete any previous test record so we can re-run
    await pool.request()
      .input('id', sql.Int, actualRequestId)
      .query('DELETE FROM petty_travel_feedback WHERE request_id = @id');

    const token = crypto.randomBytes(32).toString('hex');
    await pool.request()
      .input('requestId', sql.Int, actualRequestId)
      .input('token', sql.NVarChar(64), token)
      .input('email', sql.NVarChar(320), TEST_EMAIL)
      .query(`INSERT INTO petty_travel_feedback (request_id, token, employee_email, sent_at)
              VALUES (@requestId, @token, @email, SYSUTCDATETIME())`);

    const baseUrl = getFrontendBaseUrl();
    const feedbackUrl = `${baseUrl}/travel-feedback/${token}`;

    const reqs = travelData?.requirements || {};
    const hasHotel = reqs.hotel || reqs.overnightStay ||
      travelData?.roundTrip?.needsHotel ||
      travelData?.multiCityLegs?.some(l => l.needsHotel) ||
      travelData?.domesticHotel?.needsHotel;

    const categories = [
      (reqs.flights || travelData?.travelType === 'international') && '✈️ Flights',
      hasHotel && '🏨 Hotel & Accommodation',
      reqs.rentedVehicle && '🚗 Rented Vehicle',
      reqs.carPark && '🅿️ Car Park',
      reqs.food && '🍽️ Food',
      reqs.baggage && '🧳 Baggage',
    ].filter(Boolean);

    const categoryList = categories.length
      ? categories.map(c => `<li style="margin:6px 0;color:#374151;font-size:14px;">${c}</li>`).join('')
      : '<li style="color:#374151;font-size:14px;">Overall experience</li>';

    const subject = `[TEST] Travel Feedback — Trip #${actualRequestId} · ${req.employee_name}`;
    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f3f4f6;">
  <div style="max-width:600px;margin:0 auto;padding:20px;">
    <div style="background:#2563EB;padding:36px 28px;border-radius:12px 12px 0 0;text-align:center;">
      <div style="font-size:40px;margin-bottom:12px;">✈️</div>
      <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">How was your trip?</h1>
      <p style="margin:8px 0 0;color:#dbeafe;font-size:14px;">We'd love to hear about your travel experience</p>
    </div>
    <div style="background:#ffffff;padding:32px 28px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
      <p style="margin:0 0 16px;color:#111827;font-size:15px;line-height:1.6;">Hi <strong>${req.employee_name}</strong>,</p>
      <p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.6;">
        This is a <strong>test email</strong> for Trip #${actualRequestId}. Click below to open the feedback form with your actual trip details.
      </p>
      <div style="background:#f9fafb;border-radius:8px;padding:16px 20px;margin-bottom:24px;border-left:4px solid #2563EB;">
        <p style="margin:0 0 10px;color:#374151;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Please rate your experience for:</p>
        <ul style="margin:0;padding-left:20px;">${categoryList}</ul>
      </div>
      <div style="text-align:center;margin:28px 0;">
        <a href="${feedbackUrl}" style="display:inline-block;background:#2563EB;color:#ffffff;padding:14px 36px;text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;">
          Open Feedback Form
        </a>
      </div>
      <p style="margin:20px 0 0;color:#9ca3af;font-size:12px;text-align:center;">TEST EMAIL — Trip #${actualRequestId}</p>
    </div>
  </div>
</body></html>`;

    await sendEmail({ to: TEST_EMAIL, subject, html });

    console.log(`✅ Test feedback email sent to ${TEST_EMAIL}`);
    console.log(`🔗 Feedback URL: ${feedbackUrl}`);
    console.log(`📋 Request: #${actualRequestId} — ${req.employee_name}`);
    console.log(`\n⚠️  NOTE: travel_form_data on request #${actualRequestId} was temporarily replaced with mock data.`);
    console.log(`   After testing, run this to restore it:`);
    console.log(`   node restore-travel-data.js`);

    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

run();
