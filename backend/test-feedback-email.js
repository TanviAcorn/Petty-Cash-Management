/**
 * Test script — sends a feedback email with mock multi-city data
 * Usage: node test-feedback-email.js
 */
require('dotenv').config();
const crypto = require('crypto');
const sql = require('mssql');
const fs = require('fs');
const { poolPromise } = require('./src/config/db');
const { sendEmail } = require('./src/utils/mailer');

const TEST_EMAIL      = 'travel@astutehealthcare.co.uk';
// const TEST_EMAIL      = 'priyal.makwana@acornuniversalconsultancy.com';
const TEST_REQUEST_ID = 245;

function getFrontendBaseUrl() {
  return String(process.env.FRONTEND_URL || 'http://localhost:5174').split(',')[0].trim();
}

const mockTravelData = {
  travelType: 'international',
  tripType: 'multiCity',
  countryOfTravel: 'France / Belgium',
  requirements: { flights: true, food: true, baggage: true, carPark: true },
  multiCityLegs: [
    { fromCity: 'London',   toCity: 'Paris',    date: '2026-04-10', needsHotel: true,  hotelFrom: '2026-04-10', hotelTo: '2026-04-12' },
    { fromCity: 'Paris',    toCity: 'Brussels', date: '2026-04-12', needsHotel: true,  hotelFrom: '2026-04-12', hotelTo: '2026-04-14' },
    { fromCity: 'Brussels', toCity: 'London',   date: '2026-04-14', needsHotel: false },
  ],
};

const mockAdminDetails = {
  flights_leg_0: { airline: 'British Airways', flightNumber: 'BA123', departureAirport: 'LHR', arrivalAirport: 'CDG', departureTime: '2026-04-10T08:00', seatNumber: '12A' },
  hotel_leg_0:   { hotelName: 'Hotel Le Marais', hotelAddress: '10 Rue de Rivoli, Paris', checkIn: '2026-04-10T14:00', checkOut: '2026-04-12T11:00' },
  carPark_leg_0: { carParkName: 'LHR Long Stay', carParkLocation: 'Terminal 5, Heathrow', bayNumber: 'B-204', carParkEntryDate: '2026-04-10T06:00', carParkExitDate: '2026-04-14T20:00' },
  flights_leg_1: { airline: 'Eurostar', flightNumber: 'ES9114', departureAirport: 'Paris Gare du Nord', arrivalAirport: 'Brussels Midi', departureTime: '2026-04-12T10:00', seatNumber: '5C' },
  hotel_leg_1:   { hotelName: 'Hotel Amigo Brussels', hotelAddress: "Rue de l'Amigo 1, Brussels", checkIn: '2026-04-12T15:00', checkOut: '2026-04-14T12:00' },
  carPark_leg_1: { carParkName: 'Brussels Parking', carParkLocation: 'Brussels Midi Station', bayNumber: 'A-12' },
  flights_leg_2: { airline: 'Ryanair', flightNumber: 'FR445', departureAirport: 'BRU', arrivalAirport: 'STN', departureTime: '2026-04-14T16:00', seatNumber: '22F' },
  food:    { eastEurope: '€40/day', totalMealBudget: '€200' },
  baggage: { baggageAllowance: '23kg', baggageBookingRef: 'BAG-001' },
};

async function run() {
  try {
    const pool = await poolPromise;

    // Ensure feedback table exists
    await pool.request().query(`
      IF OBJECT_ID('dbo.petty_travel_feedback','U') IS NULL
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
    `);

    // Fetch real request to get employee name
    const reqResult = await pool.request()
      .input('id', sql.Int, TEST_REQUEST_ID)
      .query('SELECT id, employee_name, employee_email, travel_form_data FROM petty_cash_requests WHERE id = @id');

    if (!reqResult.recordset.length) {
      console.error(`❌ Request #${TEST_REQUEST_ID} not found.`);
      process.exit(1);
    }

    const req = reqResult.recordset[0];

    // Backup original data
    const backupPath = `./travel_form_data_backup_${TEST_REQUEST_ID}.json`;
    fs.writeFileSync(backupPath, JSON.stringify({ id: req.id, travel_form_data: req.travel_form_data }));
    console.log(`💾 Backed up original travel_form_data`);

    // Inject mock data
    await pool.request()
      .input('id', sql.Int, TEST_REQUEST_ID)
      .input('data', sql.NVarChar(sql.MAX), JSON.stringify(mockTravelData))
      .input('adminDetails', sql.NVarChar(sql.MAX), JSON.stringify(mockAdminDetails))
      .query(`UPDATE petty_cash_requests SET travel_form_data = @data, travel_admin_details = @adminDetails WHERE id = @id`);
    console.log(`📝 Injected mock multi-city travel + admin details`);

    // Delete previous feedback record for this request
    await pool.request()
      .input('id', sql.Int, TEST_REQUEST_ID)
      .query('DELETE FROM petty_travel_feedback WHERE request_id = @id');

    const token = crypto.randomBytes(32).toString('hex');
    await pool.request()
      .input('requestId', sql.Int, TEST_REQUEST_ID)
      .input('token', sql.NVarChar(64), token)
      .input('email', sql.NVarChar(320), TEST_EMAIL)
      .query(`INSERT INTO petty_travel_feedback (request_id, token, employee_email, sent_at)
              VALUES (@requestId, @token, @email, SYSUTCDATETIME())`);

    const feedbackUrl = `${getFrontendBaseUrl()}/travel-feedback/${token}`;

    const subject = `[TEST] Multi-City Feedback — Trip #${TEST_REQUEST_ID}`;
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f3f4f6;margin:0;padding:0;">
  <div style="max-width:600px;margin:0 auto;padding:20px;">
    <div style="background:#2563EB;padding:36px 28px;border-radius:12px 12px 0 0;text-align:center;">
      <div style="font-size:40px;margin-bottom:12px;">✈️</div>
      <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">Multi-City Trip Feedback Test</h1>
    </div>
    <div style="background:#fff;padding:32px 28px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
      <p style="color:#374151;font-size:15px;">Hi <strong>${req.employee_name}</strong>,</p>
      <p style="color:#374151;font-size:15px;">This is a <strong>test</strong> for the multi-city per-leg feedback form. Click below to open it.</p>
      <div style="text-align:center;margin:28px 0;">
        <a href="${feedbackUrl}" style="display:inline-block;background:#2563EB;color:#fff;padding:14px 36px;text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;">
          Open Feedback Form
        </a>
      </div>
      <p style="color:#9ca3af;font-size:12px;text-align:center;">TEST — Trip #${TEST_REQUEST_ID} · London → Paris → Brussels → London</p>
    </div>
  </div>
</body></html>`;

    await sendEmail({ to: TEST_EMAIL, subject, html });

    console.log(`✅ Test feedback email sent to ${TEST_EMAIL}`);
    console.log(`🔗 Feedback URL: ${feedbackUrl}`);
    console.log(`\n⚠️  Run "node restore-travel-data.js" after testing to restore original data.`);

    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

run();
