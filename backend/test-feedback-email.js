/**
 * One-time test script — sends a feedback email to a specific address
 * Usage: node test-feedback-email.js
 * Delete this file after testing.
 */
require('dotenv').config();
const crypto = require('crypto');
const sql = require('mssql');
const { poolPromise } = require('./src/config/db');
const { sendEmail } = require('./src/utils/mailer');

const TEST_EMAIL = 'Priyal.Makwana@acornuniversalconsultancy.com';
const TEST_NAME  = 'Priyal Makwana';

function getFrontendBaseUrl() {
  const raw = process.env.FRONTEND_URL || 'http://localhost:5174';
  return String(raw).split(',')[0].trim();
}

async function run() {
  try {
    const pool = await poolPromise;

    // Ensure table + sub_ratings column exist
    await pool.request().query(`
      IF OBJECT_ID('dbo.petty_travel_feedback','U') IS NULL
      BEGIN
        CREATE TABLE dbo.petty_travel_feedback (
          id INT IDENTITY(1,1) PRIMARY KEY,
          request_id INT NOT NULL,
          token NVARCHAR(64) NOT NULL UNIQUE,
          employee_email NVARCHAR(320) NOT NULL,
          sent_at DATETIME2 NULL,
          submitted_at DATETIME2 NULL,
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

    // Use a fake request_id = 0 for test (won't conflict with real data)
    // Clean up any previous test record first
    await pool.request()
      .input('email', sql.NVarChar(320), TEST_EMAIL)
      .query(`DELETE FROM petty_travel_feedback WHERE employee_email = @email AND request_id = 0`);

    const token = crypto.randomBytes(32).toString('hex');

    await pool.request()
      .input('token', sql.NVarChar(64), token)
      .input('email', sql.NVarChar(320), TEST_EMAIL)
      .query(`
        INSERT INTO petty_travel_feedback (request_id, token, employee_email, sent_at)
        VALUES (0, @token, @email, SYSUTCDATETIME())
      `);

    const baseUrl = getFrontendBaseUrl();
    const feedbackUrl = `${baseUrl}/travel-feedback/${token}`;

    // Mock travel data — flights + hotel + food to show all sections
    const travelData = {
      travelType: 'international',
      requirements: { flights: true, food: true },
      roundTrip: { needsHotel: true },
    };

    const reqs = travelData.requirements;
    const categories = [
      reqs.flights && '✈️ Flights',
      '🏨 Hotel & Accommodation',
      reqs.food && '🍽️ Food',
    ].filter(Boolean);

    const categoryList = categories
      .map(c => `<li style="margin:6px 0;color:#374151;font-size:14px;">${c}</li>`)
      .join('');

    const subject = `[TEST] Travel Feedback Form — Please Review`;
    const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f3f4f6;">
  <div style="max-width:600px;margin:0 auto;padding:20px;">
    <div style="background:#2563EB;padding:36px 28px;border-radius:12px 12px 0 0;text-align:center;">
      <div style="font-size:40px;margin-bottom:12px;">✈️</div>
      <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">How was your trip?</h1>
      <p style="margin:8px 0 0;color:#dbeafe;font-size:14px;">We'd love to hear about your travel experience</p>
    </div>
    <div style="background:#ffffff;padding:32px 28px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
      <p style="margin:0 0 16px;color:#111827;font-size:15px;line-height:1.6;">Hi <strong>${TEST_NAME}</strong>,</p>
      <p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.6;">
        This is a <strong>test email</strong> to preview the new detailed feedback form. Please click the button below and check all the rating sections.
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
      <p style="margin:20px 0 0;color:#9ca3af;font-size:12px;text-align:center;">
        TEST EMAIL — This link is for testing only.<br>Trip Reference: #TEST
      </p>
    </div>
  </div>
</body>
</html>`;

    await sendEmail({ to: TEST_EMAIL, subject, html });

    console.log(`✅ Test feedback email sent to ${TEST_EMAIL}`);
    console.log(`🔗 Feedback URL: ${feedbackUrl}`);
    console.log(`\nAfter testing, delete the test record with:`);
    console.log(`DELETE FROM petty_travel_feedback WHERE request_id = 0;`);

    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

run();
