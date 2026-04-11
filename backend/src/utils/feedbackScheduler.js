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

async function sendPendingFeedbackEmails() {
  try {
    const pool = await poolPromise;
    await ensureFeedbackTable(pool);

    // Find approved travel requests where return date was today or earlier,
    // feedback not yet sent, and request is approved
    const result = await pool.request().query(`
      SELECT 
        r.id, r.employee_email, r.employee_name,
        r.travel_form_data, r.travel_details
      FROM petty_cash_requests r
      WHERE r.category_name = 'Travel Request'
        AND r.status IN ('approved', 'pending', 'payment done')
        AND r.l1_approval_status = 'approved'
        AND r.id NOT IN (SELECT request_id FROM petty_travel_feedback)
        AND (
          TRY_CAST(JSON_VALUE(COALESCE(r.travel_form_data, r.travel_details), '$.returnDate') AS DATE) <= CAST(GETUTCDATE() AS DATE)
          OR TRY_CAST(JSON_VALUE(COALESCE(r.travel_form_data, r.travel_details), '$.roundTrip.arrivalDate') AS DATE) <= CAST(GETUTCDATE() AS DATE)
          OR (
            JSON_VALUE(COALESCE(r.travel_form_data, r.travel_details), '$.tripType') = 'multiCity'
            AND TRY_CAST(JSON_VALUE(COALESCE(r.travel_form_data, r.travel_details), '$.multiCityLegs[1].date') AS DATE) <= CAST(GETUTCDATE() AS DATE)
          )
        )
    `);

    console.log(`[FeedbackScheduler] Found ${result.recordset.length} trips ready for feedback email`);

    for (const row of result.recordset) {
      try {
        const token = crypto.randomBytes(32).toString('hex');

        let travelData = null;
        try { travelData = row.travel_form_data ? JSON.parse(row.travel_form_data) : null; } catch {}
        if (!travelData) {
          try { travelData = row.travel_details ? JSON.parse(row.travel_details) : null; } catch {}
        }

        // Insert feedback record
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
        console.error(`[FeedbackScheduler] Failed for request #${row.id}:`, err.message);
      }
    }
  } catch (err) {
    console.error('[FeedbackScheduler] Error running feedback check:', err);
  }
}

function startFeedbackScheduler() {
  // Run every day at 9:00 AM UTC
  cron.schedule('0 9 * * *', () => {
    console.log('[FeedbackScheduler] Running daily feedback check...');
    sendPendingFeedbackEmails();
    sendPreTravelReminders();
  });

  console.log('[FeedbackScheduler] Scheduled daily jobs at 09:00 UTC');
}

module.exports = { startFeedbackScheduler };

