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
  const hasHotel = reqs.hotel;
  const hasFood = reqs.food;
  const hasVehicle = reqs.rentedVehicle;
  const hasCarPark = reqs.carPark;
  const hasFlights = reqs.flights;

  const categories = [
    hasFlights && '✈️ Flights',
    hasHotel && '🏨 Hotel & Accommodation',
    hasVehicle && '🚗 Rented Vehicle',
    hasCarPark && '🅿️ Car Park',
    hasFood && '🍽️ Food',
  ].filter(Boolean);

  const categoryList = categories.length
    ? categories.map(c => `<li style="margin: 4px 0; color: #374151;">${c}</li>`).join('')
    : '<li style="color: #374151;">Overall experience</li>';

  const subject = `Travel Feedback Request – Trip #${requestId}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background:#f3f4f6;">
      <div style="max-width:600px;margin:0 auto;padding:20px;">
        
        <div style="background:linear-gradient(135deg,#3B82F6,#6366F1);padding:36px 28px;border-radius:12px 12px 0 0;text-align:center;">
          <div style="font-size:40px;margin-bottom:12px;">✈️</div>
          <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">How was your trip?</h1>
          <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">We'd love to hear about your travel experience</p>
        </div>

        <div style="background:#fff;padding:32px 28px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
          <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">
            Hi <strong>${employeeName}</strong>,
          </p>
          <p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.6;">
            Now that you're back from your trip, we'd appreciate your feedback. Your responses help us improve travel arrangements for everyone.
          </p>

          <div style="background:#f9fafb;border-radius:8px;padding:16px 20px;margin-bottom:24px;border-left:4px solid #3B82F6;">
            <p style="margin:0 0 8px;color:#6b7280;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Please rate your experience for:</p>
            <ul style="margin:0;padding-left:20px;">
              ${categoryList}
            </ul>
          </div>

          <div style="text-align:center;margin:28px 0;">
            <a href="${feedbackUrl}" style="display:inline-block;background:linear-gradient(135deg,#3B82F6,#6366F1);color:#fff;padding:14px 36px;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;letter-spacing:0.3px;">
              Share Your Feedback
            </a>
          </div>

          <p style="margin:20px 0 0;color:#9ca3af;font-size:12px;text-align:center;line-height:1.5;">
            This link is unique to you and expires after submission.<br>
            Trip Reference: #${requestId}
          </p>
        </div>

        <div style="margin-top:16px;text-align:center;color:#9ca3af;font-size:12px;">
          <p style="margin:0;">Automated notification from Petty Cash Management System.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return { subject, html };
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
        AND r.id NOT IN (SELECT request_id FROM travel_feedback)
        AND (
          -- Check return date from travel_form_data JSON
          TRY_CAST(JSON_VALUE(r.travel_form_data, '$.returnDate') AS DATE) <= CAST(GETUTCDATE() AS DATE)
          OR TRY_CAST(JSON_VALUE(r.travel_form_data, '$.roundTrip.arrivalDate') AS DATE) <= CAST(GETUTCDATE() AS DATE)
          OR (
            -- Multi-city: check last leg date
            JSON_VALUE(r.travel_form_data, '$.tripType') = 'multiCity'
            AND TRY_CAST(JSON_VALUE(r.travel_form_data, '$.multiCityLegs[1].date') AS DATE) <= CAST(GETUTCDATE() AS DATE)
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
            INSERT INTO travel_feedback (request_id, token, employee_email, sent_at)
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
  });

  console.log('[FeedbackScheduler] Scheduled daily feedback emails at 09:00 UTC');
}

module.exports = { startFeedbackScheduler, sendPendingFeedbackEmails };
