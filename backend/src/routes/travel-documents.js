const express = require('express');
const router = express.Router();
const sql = require('mssql');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { poolPromise } = require('../config/db');
const { sendEmail } = require('../utils/mailer');
const { bookTravelCalendarEvent, buildTripSummary, extractTravelDates } = require('../utils/teamsCalendar');

const UPLOADS_DIR = path.join(__dirname, '../../uploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const prefix = Date.now() + '-' + Math.round(Math.random() * 1e9) + '-';
    cb(null, prefix + file.originalname.replace(/[^\w\d.-]/g, '_'));
  }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

async function ensureTable(pool) {
  await pool.request().query(`
    IF OBJECT_ID('dbo.petty_travel_documents', 'U') IS NULL
    CREATE TABLE dbo.petty_travel_documents (
      id            INT IDENTITY(1,1) PRIMARY KEY,
      request_id    INT NOT NULL,
      filename      NVARCHAR(500) NOT NULL,
      original_name NVARCHAR(500) NOT NULL,
      mimetype      NVARCHAR(200) NULL,
      uploaded_by   NVARCHAR(320) NULL,
      uploaded_at   DATETIME2 DEFAULT SYSUTCDATETIME(),
      doc_type      NVARCHAR(100) NULL
    );
  `);
}

// GET /api/travel-documents/:requestId — list docs for a request
router.get('/:requestId', async (req, res) => {
  try {
    const pool = await poolPromise;
    await ensureTable(pool);
    const result = await pool.request()
      .input('rid', sql.Int, parseInt(req.params.requestId))
      .query('SELECT * FROM petty_travel_documents WHERE request_id = @rid ORDER BY uploaded_at DESC');
    res.json({ data: result.recordset });
  } catch (err) {
    console.error('travel-documents GET error:', err);
    res.status(500).json({ message: 'Failed to fetch documents' });
  }
});

// POST /api/travel-documents/:requestId/upload — admin uploads docs
router.post('/:requestId/upload', upload.array('documents', 20), async (req, res) => {
  try {
    const pool = await poolPromise;
    await ensureTable(pool);
    const requestId = parseInt(req.params.requestId);
    const uploadedBy = req.body.uploadedBy || null;
    const docType = req.body.docType || null;

    for (const file of req.files || []) {
      await pool.request()
        .input('rid', sql.Int, requestId)
        .input('filename', sql.NVarChar(500), file.filename)
        .input('originalName', sql.NVarChar(500), file.originalname)
        .input('mimetype', sql.NVarChar(200), file.mimetype)
        .input('uploadedBy', sql.NVarChar(320), uploadedBy)
        .input('docType', sql.NVarChar(100), docType)
        .query(`INSERT INTO petty_travel_documents (request_id, filename, original_name, mimetype, uploaded_by, doc_type)
                VALUES (@rid, @filename, @originalName, @mimetype, @uploadedBy, @docType)`);
    }

    res.json({ message: `${req.files?.length || 0} document(s) uploaded` });
  } catch (err) {
    console.error('travel-documents upload error:', err);
    res.status(500).json({ message: 'Upload failed' });
  }
});

// DELETE /api/travel-documents/:requestId/:docId — remove a doc
router.delete('/:requestId/:docId', async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('id', sql.Int, parseInt(req.params.docId))
      .query('SELECT filename FROM petty_travel_documents WHERE id = @id');

    if (result.recordset.length) {
      const filePath = path.join(UPLOADS_DIR, result.recordset[0].filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      await pool.request()
        .input('id', sql.Int, parseInt(req.params.docId))
        .query('DELETE FROM petty_travel_documents WHERE id = @id');
    }
    res.json({ message: 'Document deleted' });
  } catch (err) {
    console.error('travel-documents delete error:', err);
    res.status(500).json({ message: 'Delete failed' });
  }
});

// GET /api/travel-documents/:requestId/draft — load saved draft details
router.get('/:requestId/draft', async (req, res) => {
  try {
    const pool = await poolPromise;
    const requestId = parseInt(req.params.requestId);

    await pool.request().query(`
      IF COL_LENGTH('dbo.petty_cash_requests','travel_admin_details') IS NULL
        ALTER TABLE dbo.petty_cash_requests ADD travel_admin_details NVARCHAR(MAX) NULL;
      IF COL_LENGTH('dbo.petty_cash_requests','travel_admin_remarks') IS NULL
        ALTER TABLE dbo.petty_cash_requests ADD travel_admin_remarks NVARCHAR(MAX) NULL;
    `);

    const result = await pool.request()
      .input('id', sql.Int, requestId)
      .query('SELECT travel_admin_details, travel_admin_remarks FROM petty_cash_requests WHERE id = @id');

    if (!result.recordset.length) return res.json({ data: null });

    const row = result.recordset[0];
    let details = {};
    try { details = row.travel_admin_details ? JSON.parse(row.travel_admin_details) : {}; } catch {}

    const hasContent = Object.values(details).some(sec =>
      Object.values(sec || {}).some(v => v?.trim())
    ) || row.travel_admin_remarks;

    res.json({
      data: hasContent ? { details, globalRemarks: row.travel_admin_remarks || '' } : null
    });
  } catch (err) {
    console.error('draft GET error:', err);
    res.status(500).json({ message: 'Failed to load draft' });
  }
});

// POST /api/travel-documents/:requestId/save-details — store text details per section
router.post('/:requestId/save-details', async (req, res) => {
  try {
    const pool = await poolPromise;
    const requestId = parseInt(req.params.requestId);
    const { details, costDetails, currency, globalRemarks, isDraft } = req.body;

    // Ensure columns exist
    await pool.request().query(`
      IF COL_LENGTH('dbo.petty_cash_requests','travel_admin_details') IS NULL
        ALTER TABLE dbo.petty_cash_requests ADD travel_admin_details NVARCHAR(MAX) NULL;
      IF COL_LENGTH('dbo.petty_cash_requests','travel_admin_remarks') IS NULL
        ALTER TABLE dbo.petty_cash_requests ADD travel_admin_remarks NVARCHAR(MAX) NULL;
    `);

    await pool.request()
      .input('id', sql.Int, requestId)
      .input('details', sql.NVarChar(sql.MAX), JSON.stringify(details || {}))
      .input('remarks', sql.NVarChar(sql.MAX), globalRemarks || null)
      .query(`UPDATE petty_cash_requests SET travel_admin_details = @details, travel_admin_remarks = @remarks WHERE id = @id`);

    // Save costs to petty_travel_costs if costDetails provided and not just a draft
    if (costDetails && Object.keys(costDetails).length > 0) {
      try {
        // Ensure costs table exists
        await pool.request().query(`
          IF OBJECT_ID('dbo.petty_travel_costs','U') IS NULL
          CREATE TABLE dbo.petty_travel_costs (
            id INT IDENTITY(1,1) PRIMARY KEY,
            request_id INT NOT NULL,
            employee_name NVARCHAR(200) NULL, employee_email NVARCHAR(320) NULL,
            trip_summary NVARCHAR(500) NULL, travel_date DATE NULL,
            flight_cost DECIMAL(10,2) NULL, hotel_cost DECIMAL(10,2) NULL,
            food_cost DECIMAL(10,2) NULL, car_park_cost DECIMAL(10,2) NULL,
            visa_cost DECIMAL(10,2) NULL, baggage_cost DECIMAL(10,2) NULL,
            transport_cost DECIMAL(10,2) NULL, other_cost DECIMAL(10,2) NULL,
            other_notes NVARCHAR(500) NULL,
            total_cost AS (ISNULL(flight_cost,0)+ISNULL(hotel_cost,0)+ISNULL(food_cost,0)+
                           ISNULL(car_park_cost,0)+ISNULL(visa_cost,0)+ISNULL(baggage_cost,0)+
                           ISNULL(transport_cost,0)+ISNULL(other_cost,0)) PERSISTED,
            currency NVARCHAR(10) DEFAULT 'GBP',
            created_by NVARCHAR(320) NULL,
            created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
            updated_at DATETIME2 NULL
          );
        `);

        // Fetch request info for employee details
        const reqInfo = await pool.request()
          .input('id', sql.Int, requestId)
          .query('SELECT employee_name, employee_email, travel_details, travel_form_data FROM petty_cash_requests WHERE id = @id');

        const row = reqInfo.recordset[0] || {};
        let travelData = null;
        try { travelData = row.travel_form_data ? JSON.parse(row.travel_form_data) : null; } catch {}
        if (!travelData) { try { travelData = row.travel_details ? JSON.parse(row.travel_details) : null; } catch {} }

        let tripSummary = '';
        let travelDate = null;
        if (travelData) {
          if (travelData.travelType === 'domestic') tripSummary = `Domestic – ${travelData.cityOfTravelDomestic || ''}`;
          else if (travelData.tripType === 'roundTrip' && travelData.roundTrip) {
            tripSummary = `${travelData.roundTrip.fromCity} → ${travelData.roundTrip.toCity}, ${travelData.countryOfTravel}`;
            travelDate = travelData.roundTrip.departureDate || null;
          } else tripSummary = `International – ${travelData.countryOfTravel || ''}`;
          if (!travelDate) travelDate = travelData.dateOfTravel || travelData.multiCityLegs?.[0]?.date || null;
        }

        const cd = costDetails;
        const existing = await pool.request()
          .input('rid', sql.Int, requestId)
          .query('SELECT id FROM petty_travel_costs WHERE request_id = @rid');

        const cr = pool.request()
          .input('rid',           sql.Int,          requestId)
          .input('empName',       sql.NVarChar(200), row.employee_name || null)
          .input('empEmail',      sql.NVarChar(320), row.employee_email || null)
          .input('tripSummary',   sql.NVarChar(500), tripSummary || null)
          .input('travelDate',    sql.Date,          travelDate ? new Date(travelDate) : null)
          .input('flightCost',    sql.Decimal(10,2), cd.flightCost    ? parseFloat(cd.flightCost)    : null)
          .input('hotelCost',     sql.Decimal(10,2), cd.hotelCost     ? parseFloat(cd.hotelCost)     : null)
          .input('foodCost',      sql.Decimal(10,2), cd.foodCost      ? parseFloat(cd.foodCost)      : null)
          .input('carParkCost',   sql.Decimal(10,2), cd.carParkCost   ? parseFloat(cd.carParkCost)   : null)
          .input('visaCost',      sql.Decimal(10,2), cd.visaCost      ? parseFloat(cd.visaCost)      : null)
          .input('baggageCost',   sql.Decimal(10,2), cd.baggageCost   ? parseFloat(cd.baggageCost)   : null)
          .input('transportCost', sql.Decimal(10,2), cd.transportCost ? parseFloat(cd.transportCost) : null)
          .input('currency',      sql.NVarChar(10),  currency || 'GBP');

        if (existing.recordset.length) {
          await cr.query(`
            UPDATE petty_travel_costs SET
              employee_name=@empName, employee_email=@empEmail, trip_summary=@tripSummary,
              travel_date=@travelDate, flight_cost=@flightCost, hotel_cost=@hotelCost,
              food_cost=@foodCost, car_park_cost=@carParkCost, visa_cost=@visaCost,
              baggage_cost=@baggageCost, transport_cost=@transportCost,
              currency=@currency, updated_at=SYSUTCDATETIME()
            WHERE request_id=@rid
          `);
        } else {
          await cr.query(`
            INSERT INTO petty_travel_costs
              (request_id,employee_name,employee_email,trip_summary,travel_date,
               flight_cost,hotel_cost,food_cost,car_park_cost,visa_cost,baggage_cost,transport_cost,currency)
            VALUES
              (@rid,@empName,@empEmail,@tripSummary,@travelDate,
               @flightCost,@hotelCost,@foodCost,@carParkCost,@visaCost,@baggageCost,@transportCost,@currency)
          `);
        }
      } catch (costErr) {
        console.error('Cost save error (non-fatal):', costErr.message);
      }
    }

    res.json({ message: 'Details saved' });
  } catch (err) {
    console.error('save-details error:', err);
    res.status(500).json({ message: 'Failed to save details' });
  }
});

// POST /api/travel-documents/:requestId/send — finalize & email user
router.post('/:requestId/send', async (req, res) => {
  try {
    const pool = await poolPromise;
    await ensureTable(pool);
    const requestId = parseInt(req.params.requestId);

    // Fetch request
    const reqResult = await pool.request()
      .input('id', sql.Int, requestId)
      .query('SELECT * FROM petty_cash_requests WHERE id = @id');

    if (!reqResult.recordset.length) return res.status(404).json({ message: 'Request not found' });
    const request = reqResult.recordset[0];

    // Fetch uploaded docs
    const docsResult = await pool.request()
      .input('rid', sql.Int, requestId)
      .query('SELECT * FROM petty_travel_documents WHERE request_id = @rid');

    const docs = docsResult.recordset;
    // Allow send even if no files — admin may have only filled text details

    // Parse travel form data
    let travelData = null;
    try { travelData = request.travel_form_data ? JSON.parse(request.travel_form_data) : null; } catch {}

    // Parse admin-entered details
    let adminDetails = {};
    try { adminDetails = request.travel_admin_details ? JSON.parse(request.travel_admin_details) : {}; } catch {}
    const adminRemarks = request.travel_admin_remarks || null;

    // Build attachments for email
    const emailAttachments = [];
    for (const doc of docs) {
      const filePath = path.join(UPLOADS_DIR, doc.filename);
      if (fs.existsSync(filePath)) {
        emailAttachments.push({
          filename: doc.original_name,
          content: fs.readFileSync(filePath),
          contentType: doc.mimetype || 'application/octet-stream'
        });
      }
    }

    // Build travel summary rows
    const tf = travelData || {};
    const summaryRows = buildTravelSummaryRows(tf);

    const { subject, html } = buildTravelDocumentsEmail({
      request,
      travelData: tf,
      summaryRows,
      docCount: docs.length,
      adminDetails,
      adminRemarks,
    });

    await sendEmail({ to: request.employee_email, subject, html, attachments: emailAttachments });

    // Book Teams/Outlook calendar event for the employee
    try {
      const { startDate, endDate } = extractTravelDates(travelData);
      const tripSummary = buildTripSummary(travelData);
      if (startDate) {
        await bookTravelCalendarEvent({
          employeeEmail: request.employee_email,
          employeeName: request.employee_name,
          startDate,
          endDate: endDate || startDate,
          tripSummary,
          requestId,
        });
      }
    } catch (calErr) {
      console.error('[TeamsCalendar] Non-fatal calendar error:', calErr.message);
    }

    // Mark as documents_sent on the request
    await pool.request()
      .input('id', sql.Int, requestId)
      .query(`
        IF COL_LENGTH('dbo.petty_cash_requests','travel_docs_sent_at') IS NULL
          ALTER TABLE dbo.petty_cash_requests ADD travel_docs_sent_at DATETIME2 NULL;
        UPDATE petty_cash_requests SET travel_docs_sent_at = SYSUTCDATETIME() WHERE id = @id;
      `);

    res.json({ message: 'Travel documents emailed to user successfully' });
  } catch (err) {
    console.error('travel-documents send error:', err);
    res.status(500).json({ message: 'Failed to send documents' });
  }
});

function buildTravelSummaryRows(tf) {
  const rows = [];
  if (!tf) return rows;
  if (tf.travelType) rows.push({ label: 'Travel Type', value: tf.travelType === 'domestic' ? 'Domestic' : 'International' });
  if (tf.countryOfTravel) rows.push({ label: 'Country', value: tf.countryOfTravel });
  if (tf.tripType) rows.push({ label: 'Trip Type', value: tf.tripType === 'roundTrip' ? 'Round Trip' : 'Multi-City' });
  if (tf.roundTrip?.fromCity) rows.push({ label: 'Route', value: `${tf.roundTrip.fromCity} → ${tf.roundTrip.toCity}` });
  if (tf.roundTrip?.departureDate) rows.push({ label: 'Departure', value: tf.roundTrip.departureDate });
  if (tf.roundTrip?.arrivalDate) rows.push({ label: 'Return', value: tf.roundTrip.arrivalDate });
  if (tf.cityOfTravelDomestic) rows.push({ label: 'City', value: tf.cityOfTravelDomestic });
  if (tf.dateOfTravel) rows.push({ label: 'Date of Travel', value: tf.dateOfTravel });
  if (tf.reasonOfTravel) rows.push({ label: 'Reason', value: tf.reasonOfTravel });
  return rows;
}

const SECTION_LABELS = {
  flights: 'Flight Details',
  hotel: 'Hotel / Accommodation',
  visa: 'Visa Details',
  carPark: 'Airport Car Park',
  food: 'Food Preferance',
  baggage: 'Baggage Requirements',
  rentedVehicle: 'Rented Vehicle',
  overnightStay: 'Overnight Stay',
};

const FIELD_LABELS = {
  airline: 'Airline', flightNumber: 'Flight Number', bookingRef: 'Booking Reference',
  departureAirport: 'Departure Airport', arrivalAirport: 'Arrival Airport',
  departureTerminal: 'Departure Terminal', departureTime: 'Departure Date & Time',
  arrivalTime: 'Arrival Date & Time', seatNumber: 'Seat Number',
  baggageAllowanceFlight: 'Baggage Allowance (Flight)',
  hotelName: 'Hotel Name', hotelAddress: 'Address', roomNumber: 'Room Number',
  roomType: 'Room Type', confirmationNumber: 'Confirmation Number',
  checkIn: 'Check-in Date', checkOut: 'Check-out Date', hotelPhone: 'Hotel Phone',
  visaNumber: 'Visa Number', visaIssueDate: 'Issue Date', visaExpiryDate: 'Expiry Date',
  visaType: 'Visa Type', visaIssuingCountry: 'Issuing Country',
  carParkName: 'Car Park Name', carParkLocation: 'Location / Address',
  bayNumber: 'Bay / Space Number', carParkBookingRef: 'Booking Reference',
  carParkEntryDate: 'Entry Date', carParkExitDate: 'Exit Date', carParkCost: 'Total Cost (£)',
  venue: 'Restaurant / Venue', mealAllowance: 'Daily Meal Allowance (£)',
  totalMealBudget: 'Total Meal Budget (£)', foodNotes: 'Notes',
  eastEurope: 'East Europe Allowance (€40 fixed)', westEurope: 'West Europe Allowance (€80 fixed)',
  baggageAllowance: 'Baggage Allowance', baggageBookingRef: 'Booking Reference',
  baggageWeight: 'Max Weight (kg)', baggageNotes: 'Notes',
  rentalCompany: 'Rental Company', vehicleReg: 'Vehicle Registration',
  vehicleModel: 'Vehicle Make / Model', pickupAddress: 'Pick-up Address',
  pickupDateTime: 'Pick-up Date & Time', dropoffAddress: 'Drop-off Address',
  dropoffDateTime: 'Drop-off Date & Time', rentalBookingRef: 'Booking Reference',
  rentalCost: 'Total Cost (£)',
};

function buildAdminDetailsSections(adminDetails) {
  if (!adminDetails || !Object.keys(adminDetails).length) return '';
  let html = '';
  for (const [sectionKey, fields] of Object.entries(adminDetails)) {
    const hasValues = Object.values(fields || {}).some(v => v?.trim());
    if (!hasValues) continue;
    const sectionLabel = SECTION_LABELS[sectionKey] || sectionKey;
    const fieldRows = Object.entries(fields)
      .filter(([, v]) => v?.trim())
      .map(([k, v]) => `<tr>
        <td style="padding:8px 14px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px;width:160px;">${FIELD_LABELS[k] || k}</td>
        <td style="padding:8px 14px;border-bottom:1px solid #e5e7eb;color:#111827;font-size:14px;">${v}</td>
      </tr>`).join('');
    html += `
      <div style="margin-bottom:20px;">
        <h3 style="margin:0 0 8px;font-size:14px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.5px;">${sectionLabel}</h3>
        <div style="background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;">
          <table style="width:100%;border-collapse:collapse;">${fieldRows}</table>
        </div>
      </div>`;
  }
  return html;
}

function buildTravelDocumentsEmail({ request, summaryRows, docCount, adminDetails, adminRemarks }) {
  const subject = `Your Travel Documents – Trip #${request.id}`;
  const rows = summaryRows.map(r =>
    `<tr><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px;width:140px;">${r.label}</td>
     <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;color:#111827;font-size:14px;">${r.value}</td></tr>`
  ).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
  <body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:#f3f4f6;">
  <div style="max-width:600px;margin:0 auto;padding:20px;">
    <div style="background:#2563EB;padding:32px 24px;border-radius:12px 12px 0 0;text-align:center;">
      <div style="font-size:36px;margin-bottom:10px;">✈️</div>
      <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;font-family:Arial,sans-serif;">Your Travel Documents Are Ready</h1>
      <p style="margin:8px 0 0;color:#dbeafe;font-size:14px;font-family:Arial,sans-serif;">Trip Reference #${request.id}</p>
    </div>
    <div style="background:#fff;padding:32px 24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
      <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">Hi <strong>${request.employee_name}</strong>,</p>
      <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.6;">
        Your travel has been arranged. Please find your travel details below${docCount > 0 ? ` and ${docCount} document${docCount !== 1 ? 's' : ''} attached` : ''}.
      </p>
      <div style="background:#f9fafb;border-radius:8px;padding:4px 0;margin-bottom:24px;border:1px solid #e5e7eb;">
        <table style="width:100%;border-collapse:collapse;">${rows}</table>
      </div>
      ${buildAdminDetailsSections(adminDetails)}
      ${adminRemarks ? `
      <div style="margin-bottom:20px;">
        <h3 style="margin:0 0 8px;font-size:14px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.5px;">Additional Remarks</h3>
        <div style="background:#fffbeb;border-left:4px solid #f59e0b;padding:14px 18px;border-radius:4px;">
          <p style="margin:0;color:#374151;font-size:14px;line-height:1.7;white-space:pre-wrap;">${adminRemarks}</p>
        </div>
      </div>` : ''}
      <div style="background:#EFF6FF;border-left:4px solid #3B82F6;padding:14px 18px;border-radius:4px;margin-bottom:24px;">
        <p style="margin:0;color:#1e40af;font-size:13px;line-height:1.6;">
          📎 <strong>${docCount} document${docCount !== 1 ? 's' : ''} attached</strong> — Please save these for your records and present them as required during your trip.
        </p>
      </div>
      <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">Have a safe trip! — PocketPro HR</p>
    </div>
  </div>
  </body></html>`;

  return { subject, html };
}

module.exports = router;


