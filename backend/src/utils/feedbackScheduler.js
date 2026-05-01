const cron = require('node-cron');
const crypto = require('crypto');
const sql = require('mssql');
const { poolPromise } = require('../config/db');
const { sendEmail } = require('./mailer');
const { ensureFeedbackTable } = require('../routes/travel-feedback');

function getFrontendBaseUrl() {
  const raw = process.env.FRONTEND_URL || 'http://localhost:5174';
  return String(raw).split(',')[0].trim();
}

function buildFeedbackEmail({ employeeName, requestId, token, travelData }) {
  const baseUrl = getFrontendBaseUrl();
  const feedbackUrl = `${baseUrl}/travel-feedback/${token}`;

  const reqs = travelData?.requirements || {};

  // Check hotel from requirements OR from trip legs
  const hasHotel = reqs.hotel || reqs.overnightStay ||
    travelData?.roundTrip?.needsHotel ||
    travelData?.multiCityLegs?.some(l => l.needsHotel) ||
    travelData?.domesticHotel?.needsHotel;
  const hasFood = reqs.food;
  const hasVehicle = reqs.rentedVehicle;
  const hasCarPark = reqs.carPark;
  const hasFlights = reqs.flights || travelData?.travelType === 'international';
  const hasBaggage = reqs.baggage;
  const hasVisa = reqs.visa;

  const categories = [
    hasFlights   && '✈️ Flights',
    hasHotel     && '🏨 Hotel & Accommodation',
    hasVehicle   && '🚗 Rented Vehicle',
    hasCarPark   && '🅿️ Car Park',
    hasFood      && '🍽️ Food',
    hasBaggage   && '🧳 Baggage',
    hasVisa      && '🛂 Visa',
  ].filter(Boolean);

  const categoryList = categories.length
    ? categories.map(c => `<li style="margin:6px 0;color:#374151;font-size:14px;">${c}</li>`).join('')
    : '<li style="color:#374151;font-size:14px;">Overall experience</li>';

  const subject = `Travel Feedback Request – Trip #${requestId}`;

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;background:#f3f4f6;">
  <div style="max-width:600px;margin:0 auto;padding:20px;">

    <div style="background:#2563EB;padding:36px 28px;border-radius:12px 12px 0 0;text-align:center;">
      <div style="font-size:40px;margin-bottom:12px;">✈️</div>
      <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;font-family:Arial,sans-serif;">How was your trip?</h1>
      <p style="margin:8px 0 0;color:#dbeafe;font-size:14px;font-family:Arial,sans-serif;">We'd love to hear about your travel experience</p>
    </div>

    <div style="background:#ffffff;padding:32px 28px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
      <p style="margin:0 0 16px;color:#111827;font-size:15px;line-height:1.6;">
        Hi <strong>${employeeName}</strong>,
      </p>
      <p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.6;">
        Now that you're back from your trip, we'd appreciate your feedback. Your responses help us improve travel arrangements for everyone.
      </p>

      <div style="background:#f9fafb;border-radius:8px;padding:16px 20px;margin-bottom:24px;border-left:4px solid #2563EB;">
        <p style="margin:0 0 10px;color:#374151;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Please rate your experience for:</p>
        <ul style="margin:0;padding-left:20px;">
          ${categoryList}
        </ul>
      </div>

      <div style="text-align:center;margin:28px 0;">
        <a href="${feedbackUrl}"
           style="display:inline-block;background:#2563EB;color:#ffffff;padding:14px 36px;text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;font-family:Arial,sans-serif;">
          Share Your Feedback
        </a>
      </div>

      <p style="margin:20px 0 0;color:#9ca3af;font-size:12px;text-align:center;line-height:1.5;">
        This link is unique to you and expires after submission.<br>
        Trip Reference: #${requestId}
      </p>
    </div>

    <div style="margin-top:16px;text-align:center;">
      <p style="margin:0;color:#9ca3af;font-size:12px;">Automated notification from PocketPro HR.</p>
    </div>
  </div>
</body>
</html>`;

  return { subject, html };
}

async function sendPreTravelReminders() {
  try {
    const pool = await poolPromise;
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) return;

    // Find approved travel requests where departure is exactly 2 days from today
    const result = await pool.request().query(`
      SELECT r.id, r.employee_name, r.employee_email, r.travel_form_data, r.travel_details
      FROM petty_cash_requests r
      WHERE r.category_name = 'Travel Request'
        AND r.l1_approval_status = 'approved'
        AND r.status NOT IN ('rejected')
        AND (
          TRY_CAST(JSON_VALUE(COALESCE(r.travel_form_data, r.travel_details), '$.roundTrip.departureDate') AS DATE) = CAST(DATEADD(day, 2, GETUTCDATE()) AS DATE)
          OR TRY_CAST(JSON_VALUE(COALESCE(r.travel_form_data, r.travel_details), '$.dateOfTravel') AS DATE) = CAST(DATEADD(day, 2, GETUTCDATE()) AS DATE)
          OR TRY_CAST(JSON_VALUE(COALESCE(r.travel_form_data, r.travel_details), '$.multiCityLegs[0].date') AS DATE) = CAST(DATEADD(day, 2, GETUTCDATE()) AS DATE)
        )
    `);

    console.log(`[FeedbackScheduler] Found ${result.recordset.length} trips departing in 2 days`);

    for (const row of result.recordset) {
      try {
        let travelData = null;
        try { travelData = row.travel_form_data ? JSON.parse(row.travel_form_data) : null; } catch {}
        if (!travelData) { try { travelData = row.travel_details ? JSON.parse(row.travel_details) : null; } catch {} }

        const departureDate =
          travelData?.roundTrip?.departureDate ||
          travelData?.dateOfTravel ||
          travelData?.multiCityLegs?.[0]?.date || 'N/A';

        const subject = `⚠️ Travel Reminder – ${row.employee_name} departs in 2 days (Trip #${row.id})`;
        const html = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f3f4f6;margin:0;padding:0;">
          <div style="max-width:600px;margin:0 auto;padding:20px;">
            <div style="background:#F59E0B;padding:28px 24px;border-radius:12px 12px 0 0;text-align:center;">
              <div style="font-size:32px;margin-bottom:8px;">⚠️</div>
              <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700;">Pre-Travel Reminder</h1>
            </div>
            <div style="background:#fff;padding:28px 24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
              <p style="color:#374151;font-size:15px;line-height:1.6;">
                <strong>${row.employee_name}</strong> is travelling in <strong>2 days</strong> (departure: <strong>${departureDate}</strong>).
              </p>
              <p style="color:#374151;font-size:15px;line-height:1.6;">
                Please ensure all travel documents (flights, hotel, visa, etc.) have been uploaded and sent to the employee before their departure.
              </p>
              <div style="background:#FEF3C7;border-left:4px solid #F59E0B;padding:14px 18px;border-radius:4px;margin:20px 0;">
                <p style="margin:0;color:#92400E;font-size:13px;">
                  Trip #${row.id} | Employee: ${row.employee_name} (${row.employee_email})
                </p>
              </div>
              <p style="color:#9ca3af;font-size:12px;text-align:center;margin-top:20px;">PocketPro HR – Automated Reminder</p>
            </div>
          </div>
        </body></html>`;

        await sendEmail({ to: adminEmail, subject, html });
        console.log(`[FeedbackScheduler] Sent pre-travel reminder for request #${row.id}`);
      } catch (err) {
        console.error(`[FeedbackScheduler] Pre-travel reminder failed for #${row.id}:`, err.message);
      }
    }
  } catch (err) {
    console.error('[FeedbackScheduler] Pre-travel reminder error:', err);
  }
}

async function sendJourneyStartsTomorrow() {
  try {
    const pool = await poolPromise;

    // Find approved travel requests where departure is exactly tomorrow
    const result = await pool.request().query(`
      SELECT r.id, r.employee_name, r.employee_email, r.travel_form_data, r.travel_details
      FROM petty_cash_requests r
      WHERE r.category_name = 'Travel Request'
        AND r.l1_approval_status = 'approved'
        AND r.status NOT IN ('rejected')
        AND (
          TRY_CAST(JSON_VALUE(COALESCE(r.travel_form_data, r.travel_details), '$.roundTrip.departureDate') AS DATE) = CAST(DATEADD(day, 1, GETUTCDATE()) AS DATE)
          OR TRY_CAST(JSON_VALUE(COALESCE(r.travel_form_data, r.travel_details), '$.dateOfTravel') AS DATE) = CAST(DATEADD(day, 1, GETUTCDATE()) AS DATE)
          OR TRY_CAST(JSON_VALUE(COALESCE(r.travel_form_data, r.travel_details), '$.multiCityLegs[0].date') AS DATE) = CAST(DATEADD(day, 1, GETUTCDATE()) AS DATE)
        )
    `);

    console.log(`[FeedbackScheduler] Found ${result.recordset.length} trips departing tomorrow`);

    for (const row of result.recordset) {
      try {
        let travelData = null;
        try { travelData = row.travel_form_data ? JSON.parse(row.travel_form_data) : null; } catch {}
        if (!travelData) { try { travelData = row.travel_details ? JSON.parse(row.travel_details) : null; } catch {} }

        const isIntl = travelData?.travelType === 'international';
        const destination =
          travelData?.roundTrip?.toCity ||
          travelData?.multiCityLegs?.[0]?.toCity ||
          travelData?.cityOfTravelDomestic ||
          travelData?.countryOfTravel ||
          'your destination';

        const departureDate =
          travelData?.roundTrip?.departureDate ||
          travelData?.dateOfTravel ||
          travelData?.multiCityLegs?.[0]?.date || '';

        const formattedDate = departureDate
          ? new Date(departureDate).toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
          : 'tomorrow';

        const firstName = row.employee_name?.split(' ')[0] || row.employee_name;

        const subject = `🌍 Your journey to ${destination} starts tomorrow!`;

        const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;background:#f3f4f6;">
  <div style="max-width:600px;margin:0 auto;padding:20px;">

    <!-- Header -->
    <div style="background:#1d4ed8;padding:40px 28px;border-radius:12px 12px 0 0;text-align:center;">
      <div style="font-size:52px;margin-bottom:12px;">✈️</div>
      <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700;font-family:Arial,sans-serif;">
        Your Adventure Begins Tomorrow!
      </h1>
      <p style="margin:10px 0 0;color:#bfdbfe;font-size:15px;font-family:Arial,sans-serif;">
        Get ready for an amazing journey 🌟
      </p>
    </div>

    <!-- Body -->
    <div style="background:#ffffff;padding:36px 28px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">

      <p style="margin:0 0 20px;color:#111827;font-size:16px;line-height:1.7;">
        Hi <strong>${firstName}</strong>! 👋
      </p>

      <p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.7;">
        Your trip to <strong style="color:#1d4ed8;">${destination}</strong> is just <strong>one day away</strong>!
        We hope you're all packed and excited for the journey ahead. 🎒
      </p>

      <!-- Trip highlight box -->
      <div style="background:#eff6ff;border-radius:10px;padding:20px 24px;margin:24px 0;border-left:4px solid #1d4ed8;">
        <p style="margin:0 0 8px;color:#1e40af;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Your Trip Details</p>
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:6px 0;color:#6b7280;font-size:13px;width:130px;">Destination</td>
            <td style="padding:6px 0;color:#111827;font-size:14px;font-weight:600;">${destination}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#6b7280;font-size:13px;">Departure</td>
            <td style="padding:6px 0;color:#111827;font-size:14px;font-weight:600;">${formattedDate}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#6b7280;font-size:13px;">Trip Type</td>
            <td style="padding:6px 0;color:#111827;font-size:14px;font-weight:600;">${isIntl ? '🌍 International' : '🏠 Domestic'}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#6b7280;font-size:13px;">Reference</td>
            <td style="padding:6px 0;color:#111827;font-size:14px;font-weight:600;">Trip #${row.id}</td>
          </tr>
        </table>
      </div>

      <!-- Checklist -->
      <div style="background:#f0fdf4;border-radius:10px;padding:18px 22px;margin:20px 0;border-left:4px solid #16a34a;">
        <p style="margin:0 0 10px;color:#15803d;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">✅ Last-Minute Checklist</p>
        <ul style="margin:0;padding-left:18px;color:#374151;font-size:14px;line-height:1.8;">
          <li>Passport / ID documents ready</li>
          <li>Travel documents & booking confirmations saved</li>
          <li>Hotel check-in details confirmed</li>
          <li>Local currency / cards ready</li>
          <li>Emergency contacts noted</li>
        </ul>
      </div>

      <p style="margin:24px 0 0;color:#374151;font-size:15px;line-height:1.7;text-align:center;">
        Have a safe, smooth and wonderful trip! 🌟<br>
        <span style="color:#6b7280;font-size:13px;">The PocketPro HR Team is wishing you Happy Journey.</span>
      </p>

    </div>

    <!-- Footer -->
    <div style="margin-top:16px;text-align:center;">
      <p style="margin:0;color:#9ca3af;font-size:12px;">Automated notification from PocketPro HR · Trip #${row.id}</p>
    </div>

  </div>
</body>
</html>`;

        await sendEmail({ to: row.employee_email, subject, html });
        console.log(`[FeedbackScheduler] Sent journey-starts-tomorrow email for request #${row.id} to ${row.employee_email}`);
      } catch (err) {
        console.error(`[FeedbackScheduler] Journey email failed for #${row.id}:`, err.message);
      }
    }
  } catch (err) {
    console.error('[FeedbackScheduler] Journey-starts-tomorrow error:', err);
  }
}

async function sendPendingFeedbackEmails() {
  try {
    const pool = await poolPromise;
    await ensureFeedbackTable(pool);

    // Ensure notification log table exists for delivery tracking
    await pool.request().query(`
      IF OBJECT_ID('dbo.petty_notification_log','U') IS NULL
      CREATE TABLE dbo.petty_notification_log (
        id          INT IDENTITY(1,1) PRIMARY KEY,
        request_id  INT NULL,
        recipient   NVARCHAR(320) NOT NULL,
        subject     NVARCHAR(500) NOT NULL,
        type        NVARCHAR(100) NOT NULL,
        status      NVARCHAR(20)  NOT NULL DEFAULT 'sent',
        error_msg   NVARCHAR(MAX) NULL,
        sent_at     DATETIME2 DEFAULT SYSUTCDATETIME()
      );
    `);

    // Find travel requests where:
    //   1. Trip has FULLY ended — return date is strictly BEFORE today (< today),
    //      giving the employee at least 1 full day to return home before we ask for feedback.
    //   2. Admin has sent travel docs (travel_docs_sent_at IS NOT NULL) — confirms the
    //      trip was properly arranged and actually happened.
    //   3. No feedback email has been sent yet (not in petty_travel_feedback).
    //   4. l1_approval_status covers both paths:
    //        - With L1 manager  → 'approved' (set by L1 approve endpoint)
    //        - Without L1 manager → NULL (routed directly to admin, still valid)
    const result = await pool.request().query(`
      SELECT 
        r.id, r.employee_email, r.employee_name,
        r.travel_form_data, r.travel_details
      FROM petty_cash_requests r
      WHERE (r.category_name = 'Travel Request' OR r.category_name = 'Travel')
        AND (r.l1_approval_status = 'approved' OR r.l1_approval_status IS NULL)
        AND r.status NOT IN ('rejected', 'pending_l1', 'pending')
        AND r.travel_docs_sent_at IS NOT NULL
        AND r.id NOT IN (
          SELECT request_id FROM petty_travel_feedback
        )
        AND (
          -- International round trip: arrival date strictly before today
          TRY_CAST(JSON_VALUE(COALESCE(r.travel_form_data, r.travel_details), '$.roundTrip.arrivalDate') AS DATE)
            < CAST(GETUTCDATE() AS DATE)

          -- International round trip flexible return: flex-to date strictly before today
          OR TRY_CAST(JSON_VALUE(COALESCE(r.travel_form_data, r.travel_details), '$.roundTrip.arrivalDateFlexTo') AS DATE)
            < CAST(GETUTCDATE() AS DATE)

          -- Domestic: flex-to date strictly before today
          OR TRY_CAST(JSON_VALUE(COALESCE(r.travel_form_data, r.travel_details), '$.domesticDateFlexTo') AS DATE)
            < CAST(GETUTCDATE() AS DATE)

          -- Domestic single-day: date of travel strictly before today
          OR (
            JSON_VALUE(COALESCE(r.travel_form_data, r.travel_details), '$.travelType') = 'domestic'
            AND JSON_VALUE(COALESCE(r.travel_form_data, r.travel_details), '$.domesticDateFlexTo') IS NULL
            AND TRY_CAST(JSON_VALUE(COALESCE(r.travel_form_data, r.travel_details), '$.dateOfTravel') AS DATE)
              < CAST(GETUTCDATE() AS DATE)
          )

          -- Multi-city: check last known leg dates (legs 0-5), strictly before today
          OR TRY_CAST(JSON_VALUE(COALESCE(r.travel_form_data, r.travel_details), '$.multiCityLegs[5].date') AS DATE) < CAST(GETUTCDATE() AS DATE)
          OR TRY_CAST(JSON_VALUE(COALESCE(r.travel_form_data, r.travel_details), '$.multiCityLegs[4].date') AS DATE) < CAST(GETUTCDATE() AS DATE)
          OR TRY_CAST(JSON_VALUE(COALESCE(r.travel_form_data, r.travel_details), '$.multiCityLegs[3].date') AS DATE) < CAST(GETUTCDATE() AS DATE)
          OR TRY_CAST(JSON_VALUE(COALESCE(r.travel_form_data, r.travel_details), '$.multiCityLegs[2].date') AS DATE) < CAST(GETUTCDATE() AS DATE)
          OR TRY_CAST(JSON_VALUE(COALESCE(r.travel_form_data, r.travel_details), '$.multiCityLegs[1].date') AS DATE) < CAST(GETUTCDATE() AS DATE)
          OR (
            JSON_VALUE(COALESCE(r.travel_form_data, r.travel_details), '$.tripType') = 'multiCity'
            AND TRY_CAST(JSON_VALUE(COALESCE(r.travel_form_data, r.travel_details), '$.multiCityLegs[0].date') AS DATE)
              < CAST(GETUTCDATE() AS DATE)
          )
        )
    `);

    console.log(`[FeedbackScheduler] Found ${result.recordset.length} trips ready for feedback email`);

    for (const row of result.recordset) {
      let emailStatus = 'sent';
      let errorMsg = null;
      const token = crypto.randomBytes(32).toString('hex');

      try {
        let travelData = null;
        try { travelData = row.travel_form_data ? JSON.parse(row.travel_form_data) : null; } catch {}
        if (!travelData) {
          try { travelData = row.travel_details ? JSON.parse(row.travel_details) : null; } catch {}
        }

        // Insert feedback record FIRST — prevents duplicate sends even if email fails
        await pool.request()
          .input('requestId', sql.Int, row.id)
          .input('token', sql.NVarChar(64), token)
          .input('email', sql.NVarChar(320), row.employee_email)
          .query(`
            INSERT INTO petty_travel_feedback (request_id, token, employee_email, sent_at)
            VALUES (@requestId, @token, @email, SYSUTCDATETIME())
          `);

        const { subject, html } = buildFeedbackEmail({
          employeeName: row.employee_name,
          requestId: row.id,
          token,
          travelData
        });

        await sendEmail({ to: row.employee_email, subject, html });
        console.log(`[FeedbackScheduler] Sent feedback email for request #${row.id} to ${row.employee_email}`);
      } catch (err) {
        emailStatus = 'failed';
        errorMsg = err.message;
        console.error(`[FeedbackScheduler] Failed for request #${row.id}:`, err.message);
      }

      // Log every attempt — satisfies "Notification logs confirm delivery" requirement
      try {
        await pool.request()
          .input('requestId', sql.Int, row.id)
          .input('recipient', sql.NVarChar(320), row.employee_email)
          .input('subject', sql.NVarChar(500), `Travel Feedback Request – Trip #${row.id}`)
          .input('type', sql.NVarChar(100), 'feedback')
          .input('status', sql.NVarChar(20), emailStatus)
          .input('errorMsg', sql.NVarChar(sql.MAX), errorMsg)
          .query(`
            INSERT INTO petty_notification_log (request_id, recipient, subject, type, status, error_msg)
            VALUES (@requestId, @recipient, @subject, @type, @status, @errorMsg)
          `);
      } catch (logErr) {
        console.error(`[FeedbackScheduler] Log write failed for #${row.id}:`, logErr.message);
      }
    }
  } catch (err) {
    console.error('[FeedbackScheduler] Error running feedback check:', err);
  }
}

// ── Alert 1: Visa Expiry ──────────────────────────────────────────────────
async function sendVisaExpiryAlerts() {
  try {
    const pool = await poolPromise;
    const adminEmail = process.env.ADMIN_EMAIL;

    // 90-day visa types
    const ninetyDayTypes = ['High-skilled work visa', 'Skilled worker visa', 'Aufenthaltstitel', 'PSW', 'Indefinite stay to work in UK'];
    // 15-day visa types
    const fifteenDayTypes = ['Visitor Visa'];

    // Build query — find users whose visa expires in exactly 90 or 15 days
    const result = await pool.request().query(`
      SELECT 
        u.id, u.firstName, u.lastName, u.email, u.visa_type, u.visa_valid_till,
        u.visa_country, u.l1_manager_id,
        m.email AS l1_email, m.firstName AS l1_firstName, m.lastName AS l1_lastName
      FROM petty_Users u
      LEFT JOIN petty_Users m ON u.l1_manager_id = m.id
      WHERE u.visa_valid_till IS NOT NULL
        AND u.visa_type IS NOT NULL
        AND u.visa_type != 'Citizen'
        AND (
          -- 90-day rule
          (
            u.visa_type IN ('High-skilled work visa','Skilled worker visa','Aufenthaltstitel','PSW','Indefinite stay to work in UK')
            AND CAST(u.visa_valid_till AS DATE) = CAST(DATEADD(day, 90, GETUTCDATE()) AS DATE)
          )
          OR
          -- 15-day rule
          (
            u.visa_type IN ('Visitor Visa')
            AND CAST(u.visa_valid_till AS DATE) = CAST(DATEADD(day, 15, GETUTCDATE()) AS DATE)
          )
        )
    `);

    console.log(`[VisaAlert] Found ${result.recordset.length} visa expiry alerts to send`);

    for (const user of result.recordset) {
      try {
        const fullName = `${user.firstName} ${user.lastName}`;
        const expiryDate = new Date(user.visa_valid_till).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
        const daysLeft = ninetyDayTypes.includes(user.visa_type) ? 90 : 15;
        const urgencyColor = daysLeft === 15 ? '#DC2626' : '#D97706';
        const urgencyBg = daysLeft === 15 ? '#FEF2F2' : '#FFFBEB';
        const urgencyBorder = daysLeft === 15 ? '#DC2626' : '#D97706';

        const subject = `⚠️ Visa Expiry Alert — ${fullName} (${daysLeft} days remaining)`;

        const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;background:#f3f4f6;">
  <div style="max-width:600px;margin:0 auto;padding:20px;">
    <div style="background:${urgencyColor};padding:32px 28px;border-radius:12px 12px 0 0;text-align:center;">
      <div style="font-size:40px;margin-bottom:10px;">⚠️</div>
      <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">Visa Expiry Alert</h1>
      <p style="margin:8px 0 0;color:#fff;font-size:14px;opacity:0.9;">${daysLeft} days remaining</p>
    </div>
    <div style="background:#fff;padding:32px 28px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
      <p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.6;">
        This is an automated alert to notify you that the visa for <strong>${fullName}</strong> is expiring in <strong>${daysLeft} days</strong>.
      </p>
      <div style="background:${urgencyBg};border-left:4px solid ${urgencyBorder};border-radius:6px;padding:18px 20px;margin:20px 0;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:6px 0;color:#6b7280;font-size:13px;width:140px;">Employee</td>
            <td style="padding:6px 0;color:#111827;font-size:14px;font-weight:600;">${fullName}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#6b7280;font-size:13px;">Email</td>
            <td style="padding:6px 0;color:#111827;font-size:14px;">${user.email}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#6b7280;font-size:13px;">Visa Type</td>
            <td style="padding:6px 0;color:#111827;font-size:14px;font-weight:600;">${user.visa_type}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#6b7280;font-size:13px;">Country</td>
            <td style="padding:6px 0;color:#111827;font-size:14px;">${user.visa_country || '—'}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#6b7280;font-size:13px;">Expiry Date</td>
            <td style="padding:6px 0;color:${urgencyColor};font-size:14px;font-weight:700;">${expiryDate}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#6b7280;font-size:13px;">Days Remaining</td>
            <td style="padding:6px 0;color:${urgencyColor};font-size:14px;font-weight:700;">${daysLeft} days</td>
          </tr>
        </table>
      </div>
      <p style="margin:20px 0 0;color:#374151;font-size:14px;line-height:1.6;">
        Please ensure the visa renewal process is initiated as soon as possible to avoid any disruption.
      </p>
      <p style="margin:16px 0 0;color:#9ca3af;font-size:12px;text-align:center;">PocketPro HR — Automated Visa Expiry Alert</p>
    </div>
  </div>
</body>
</html>`;

        // Send to Employee
        await sendEmail({ to: user.email, subject, html });

        // Send to Admin
        if (adminEmail) {
          await sendEmail({ to: adminEmail, subject, html });
        }

        // Send to L1 Manager
        if (user.l1_email) {
          await sendEmail({ to: user.l1_email, subject, html });
        }

        console.log(`[VisaAlert] Sent visa expiry alert for ${fullName} (${user.visa_type}, expires ${expiryDate})`);
      } catch (err) {
        console.error(`[VisaAlert] Failed for user ${user.email}:`, err.message);
      }
    }
  } catch (err) {
    console.error('[VisaAlert] Error:', err);
  }
}

// ── Alert 2: Passport Expiry ──────────────────────────────────────────────
async function sendPassportExpiryAlerts() {
  try {
    const pool = await poolPromise;
    const adminEmail = process.env.ADMIN_EMAIL;

    // All employees — 180 days before passport_expiry
    const result = await pool.request().query(`
      SELECT 
        u.id, u.firstName, u.lastName, u.email, u.passport_number,
        u.passport_expiry, u.passport_place_of_issue, u.nationality,
        u.l1_manager_id,
        m.email AS l1_email
      FROM petty_Users u
      LEFT JOIN petty_Users m ON u.l1_manager_id = m.id
      WHERE u.passport_expiry IS NOT NULL
        AND CAST(u.passport_expiry AS DATE) = CAST(DATEADD(day, 180, GETUTCDATE()) AS DATE)
    `);

    console.log(`[PassportAlert] Found ${result.recordset.length} passport expiry alerts to send`);

    for (const user of result.recordset) {
      try {
        const fullName = `${user.firstName} ${user.lastName}`;
        const expiryDate = new Date(user.passport_expiry).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

        const subject = `🛂 Passport Renewal Alert — ${fullName} (180 days remaining)`;

        const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;background:#f3f4f6;">
  <div style="max-width:600px;margin:0 auto;padding:20px;">
    <div style="background:#1d4ed8;padding:32px 28px;border-radius:12px 12px 0 0;text-align:center;">
      <div style="font-size:40px;margin-bottom:10px;">🛂</div>
      <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">Passport Renewal Alert</h1>
      <p style="margin:8px 0 0;color:#bfdbfe;font-size:14px;">180 days remaining — action required</p>
    </div>
    <div style="background:#fff;padding:32px 28px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
      <p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.6;">
        This is an automated reminder that the passport for <strong>${fullName}</strong> will expire in <strong>180 days</strong>. Please initiate the renewal process at the earliest.
      </p>
      <div style="background:#eff6ff;border-left:4px solid #1d4ed8;border-radius:6px;padding:18px 20px;margin:20px 0;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:6px 0;color:#6b7280;font-size:13px;width:160px;">Employee</td>
            <td style="padding:6px 0;color:#111827;font-size:14px;font-weight:600;">${fullName}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#6b7280;font-size:13px;">Email</td>
            <td style="padding:6px 0;color:#111827;font-size:14px;">${user.email}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#6b7280;font-size:13px;">Nationality</td>
            <td style="padding:6px 0;color:#111827;font-size:14px;">${user.nationality || '—'}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#6b7280;font-size:13px;">Passport No.</td>
            <td style="padding:6px 0;color:#111827;font-size:14px;font-weight:600;">${user.passport_number || '—'}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#6b7280;font-size:13px;">Place of Issue</td>
            <td style="padding:6px 0;color:#111827;font-size:14px;">${user.passport_place_of_issue || '—'}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#6b7280;font-size:13px;">Expiry Date</td>
            <td style="padding:6px 0;color:#DC2626;font-size:14px;font-weight:700;">${expiryDate}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#6b7280;font-size:13px;">Days Remaining</td>
            <td style="padding:6px 0;color:#DC2626;font-size:14px;font-weight:700;">180 days</td>
          </tr>
        </table>
      </div>
      <p style="margin:20px 0 0;color:#374151;font-size:14px;line-height:1.6;">
        Many countries require a passport to be valid for at least 6 months beyond the travel date. Please renew well in advance.
      </p>
      <p style="margin:16px 0 0;color:#9ca3af;font-size:12px;text-align:center;">PocketPro HR — Automated Passport Renewal Alert</p>
    </div>
  </div>
</body>
</html>`;

        // Send to Employee
        await sendEmail({ to: user.email, subject, html });

        // Send to Admin
        if (adminEmail) {
          await sendEmail({ to: adminEmail, subject, html });
        }

        // Send to L1 Manager
        if (user.l1_email) {
          await sendEmail({ to: user.l1_email, subject, html });
        }

        console.log(`[PassportAlert] Sent passport renewal alert for ${fullName} (expires ${expiryDate})`);
      } catch (err) {
        console.error(`[PassportAlert] Failed for user ${user.email}:`, err.message);
      }
    }
  } catch (err) {
    console.error('[PassportAlert] Error:', err);
  }
}

function startFeedbackScheduler() {
  // Run every day at 9:00 AM UTC
  cron.schedule('0 9 * * *', async () => {
    console.log('[FeedbackScheduler] ── Daily run started ──', new Date().toISOString());
    try { await sendPendingFeedbackEmails(); }   catch (e) { console.error('[FeedbackScheduler] sendPendingFeedbackEmails crashed:', e.message); }
    try { await sendPreTravelReminders(); }       catch (e) { console.error('[FeedbackScheduler] sendPreTravelReminders crashed:', e.message); }
    try { await sendJourneyStartsTomorrow(); }    catch (e) { console.error('[FeedbackScheduler] sendJourneyStartsTomorrow crashed:', e.message); }
    try { await sendVisaExpiryAlerts(); }         catch (e) { console.error('[FeedbackScheduler] sendVisaExpiryAlerts crashed:', e.message); }
    try { await sendPassportExpiryAlerts(); }     catch (e) { console.error('[FeedbackScheduler] sendPassportExpiryAlerts crashed:', e.message); }
    console.log('[FeedbackScheduler] ── Daily run complete ──', new Date().toISOString());
  });

  console.log('[FeedbackScheduler] Scheduled daily jobs at 09:00 UTC');
}

module.exports = {
  startFeedbackScheduler,
  // Exported for manual trigger endpoint and testing
  sendPendingFeedbackEmails,
  sendPreTravelReminders,
  sendJourneyStartsTomorrow,
  sendVisaExpiryAlerts,
  sendPassportExpiryAlerts,
};

