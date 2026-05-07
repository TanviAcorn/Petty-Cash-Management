/**
 * Travel Recommendations Engine
 *
 * Aggregates feedback + admin-entered travel details per destination city.
 * When a user submits feedback, the relevant service details (hotel name,
 * car park, rental company, airline, food venue) are extracted from the
 * admin-entered travel_admin_details and stored alongside the rating.
 *
 * GET /api/travel-recommendations?toCity=NewYork
 *   Returns aggregated recommendations for a destination, grouped by
 *   category (hotel, carPark, vehicle, flights, food) with average ratings
 *   and "liked by N people" counts.
 *
 * POST /api/travel-recommendations/ingest/:requestId
 *   Called internally after feedback submission to extract and store
 *   recommendation data. Not called directly by the frontend.
 */

const express = require('express');
const router = express.Router();
const sql = require('mssql');
const { poolPromise } = require('../config/db');

// ── Ensure the recommendations table exists ───────────────────────────────
async function ensureRecommendationsTable(pool) {
  await pool.request().query(`
    IF OBJECT_ID('dbo.petty_travel_recommendations','U') IS NULL
    BEGIN
      CREATE TABLE dbo.petty_travel_recommendations (
        id              INT IDENTITY(1,1) PRIMARY KEY,
        request_id      INT NOT NULL,
        to_city         NVARCHAR(200) NOT NULL,       -- destination city (normalised lowercase)
        to_city_display NVARCHAR(200) NOT NULL,       -- original casing for display
        category        NVARCHAR(50)  NOT NULL,       -- hotel | carPark | vehicle | flights | food | baggage
        service_name    NVARCHAR(500) NULL,           -- hotel name, car park name, airline, rental company, venue
        service_detail  NVARCHAR(500) NULL,           -- address, model, airport, etc.
        rating          DECIMAL(3,2)  NULL,           -- 1.00–5.00
        sub_ratings     NVARCHAR(MAX) NULL,           -- JSON sub-question ratings
        remarks         NVARCHAR(MAX) NULL,           -- free-text from feedback
        employee_email  NVARCHAR(320) NULL,
        submitted_at    DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_rec_request_category UNIQUE (request_id, category)
      );
    END;
    -- Add index on to_city for fast lookups
    IF NOT EXISTS (
      SELECT 1 FROM sys.indexes
      WHERE name = 'IX_petty_travel_recommendations_to_city'
        AND object_id = OBJECT_ID('dbo.petty_travel_recommendations')
    )
    BEGIN
      CREATE INDEX IX_petty_travel_recommendations_to_city
        ON dbo.petty_travel_recommendations (to_city);
    END;
  `);
}

// ── Extract destination city from travel_form_data ────────────────────────
function extractToCity(travelData) {
  if (!travelData) return null;
  // Round trip / one-way
  if (travelData.roundTrip?.toCity) return travelData.roundTrip.toCity.trim();
  // Multi-city — use the last leg's toCity as the primary destination
  if (Array.isArray(travelData.multiCityLegs) && travelData.multiCityLegs.length > 0) {
    const last = travelData.multiCityLegs[travelData.multiCityLegs.length - 1];
    if (last?.toCity) return last.toCity.trim();
  }
  // Domestic
  if (travelData.cityOfTravelDomestic) return travelData.cityOfTravelDomestic.trim();
  // Country-level fallback
  if (travelData.countryOfTravel && travelData.countryOfTravel !== 'Other') {
    return travelData.countryOfTravel.trim();
  }
  return null;
}

// ── Ingest feedback into recommendations table ────────────────────────────
// Called after a feedback submission. Extracts service names from
// travel_admin_details and stores them with the rating.
async function ingestFeedbackRecommendation(pool, requestId) {
  try {
    // Fetch the request + feedback
    const result = await pool.request()
      .input('id', sql.Int, requestId)
      .query(`
        SELECT
          r.travel_form_data,
          r.travel_admin_details,
          f.hotel_rating, f.food_rating, f.vehicle_rating,
          f.car_park_rating, f.flights_rating, f.baggage_rating,
          f.hotel_remarks, f.food_remarks, f.vehicle_remarks,
          f.car_park_remarks, f.flights_remarks, f.baggage_remarks,
          f.sub_ratings, f.employee_email
        FROM petty_cash_requests r
        LEFT JOIN petty_travel_feedback f ON f.request_id = r.id
        WHERE r.id = @id AND f.submitted_at IS NOT NULL
      `);

    if (!result.recordset.length) return;
    const row = result.recordset[0];

    let travelData = null;
    try { travelData = row.travel_form_data ? JSON.parse(row.travel_form_data) : null; } catch {}

    let adminDetails = {};
    try { adminDetails = row.travel_admin_details ? JSON.parse(row.travel_admin_details) : {}; } catch {}

    let subRatings = {};
    try { subRatings = row.sub_ratings ? JSON.parse(row.sub_ratings) : {}; } catch {}

    const toCity = extractToCity(travelData);
    if (!toCity) return; // Can't recommend without a destination

    const toCityNorm = toCity.toLowerCase();

    // Build the list of category entries to upsert
    const entries = [
      {
        category: 'hotel',
        serviceName: adminDetails.hotel?.hotelName || null,
        serviceDetail: adminDetails.hotel?.hotelAddress || null,
        rating: row.hotel_rating,
        subRatings: subRatings.hotel || null,
        remarks: row.hotel_remarks,
      },
      {
        category: 'carPark',
        serviceName: adminDetails.carPark?.carParkName || null,
        serviceDetail: adminDetails.carPark?.carParkLocation || null,
        rating: row.car_park_rating,
        subRatings: subRatings.carPark || null,
        remarks: row.car_park_remarks,
      },
      {
        category: 'vehicle',
        serviceName: adminDetails.rentedVehicle?.rentalCompany || null,
        serviceDetail: adminDetails.rentedVehicle?.vehicleModel || null,
        rating: row.vehicle_rating,
        subRatings: subRatings.vehicle || null,
        remarks: row.vehicle_remarks,
      },
      {
        category: 'flights',
        serviceName: adminDetails.flights?.airline || null,
        serviceDetail: adminDetails.flights?.arrivalAirport || null,
        rating: row.flights_rating,
        subRatings: subRatings.flights || null,
        remarks: row.flights_remarks,
      },
      {
        category: 'food',
        serviceName: adminDetails.food?.venue || null,
        serviceDetail: null,
        rating: row.food_rating,
        subRatings: subRatings.food || null,
        remarks: row.food_remarks,
      },
      {
        category: 'baggage',
        serviceName: adminDetails.baggage?.baggageAllowance
          ? `${adminDetails.baggage.baggageAllowance} allowance`
          : null,
        serviceDetail: adminDetails.baggage?.baggageWeight || null,
        rating: row.baggage_rating,
        subRatings: subRatings.baggage || null,
        remarks: row.baggage_remarks,
      },
    ];

    for (const entry of entries) {
      // Only store if we have at least a rating or a service name
      if (!entry.rating && !entry.serviceName) continue;

      await pool.request()
        .input('requestId',     sql.Int,           requestId)
        .input('toCity',        sql.NVarChar(200),  toCityNorm)
        .input('toCityDisplay', sql.NVarChar(200),  toCity)
        .input('category',      sql.NVarChar(50),   entry.category)
        .input('serviceName',   sql.NVarChar(500),  entry.serviceName || null)
        .input('serviceDetail', sql.NVarChar(500),  entry.serviceDetail || null)
        .input('rating',        sql.Decimal(3,2),   entry.rating ? parseFloat(entry.rating) : null)
        .input('subRatings',    sql.NVarChar(sql.MAX), entry.subRatings ? JSON.stringify(entry.subRatings) : null)
        .input('remarks',       sql.NVarChar(sql.MAX), entry.remarks || null)
        .input('employeeEmail', sql.NVarChar(320),  row.employee_email || null)
        .query(`
          IF EXISTS (
            SELECT 1 FROM petty_travel_recommendations
            WHERE request_id = @requestId AND category = @category
          )
            UPDATE petty_travel_recommendations SET
              to_city        = @toCity,
              to_city_display= @toCityDisplay,
              service_name   = @serviceName,
              service_detail = @serviceDetail,
              rating         = @rating,
              sub_ratings    = @subRatings,
              remarks        = @remarks,
              employee_email = @employeeEmail,
              submitted_at   = SYSUTCDATETIME()
            WHERE request_id = @requestId AND category = @category
          ELSE
            INSERT INTO petty_travel_recommendations
              (request_id, to_city, to_city_display, category, service_name,
               service_detail, rating, sub_ratings, remarks, employee_email)
            VALUES
              (@requestId, @toCity, @toCityDisplay, @category, @serviceName,
               @serviceDetail, @rating, @subRatings, @remarks, @employeeEmail)
        `);
    }

    console.log(`[Recommendations] Ingested feedback for request #${requestId} → ${toCity}`);
  } catch (err) {
    console.error(`[Recommendations] Ingest failed for request #${requestId}:`, err.message);
  }
}

// ── GET /api/travel-recommendations?toCity=X ─────────────────────────────
// Returns aggregated recommendations for a destination city.
// Groups by category + service_name, computes avg rating and count.
// Only returns entries with rating >= 3 (good or better) to avoid
// recommending poor services.
router.get('/', async (req, res) => {
  try {
    const { toCity } = req.query;
    if (!toCity || !toCity.trim()) {
      return res.status(400).json({ message: 'toCity query parameter is required' });
    }

    const pool = await poolPromise;
    await ensureRecommendationsTable(pool);

    const toCityNorm = toCity.trim().toLowerCase();

    const result = await pool.request()
      .input('toCity', sql.NVarChar(200), toCityNorm)
      .query(`
        SELECT
          category,
          service_name,
          service_detail,
          to_city_display,
          COUNT(*)                    AS total_count,
          AVG(CAST(rating AS FLOAT))  AS avg_rating,
          -- Count of ratings >= 4 (liked = 4 or 5 stars)
          SUM(CASE WHEN rating >= 4 THEN 1 ELSE 0 END) AS liked_count,
          -- Most recent remarks for this service
          MAX(remarks)                AS latest_remarks,
          -- Aggregate sub-ratings as JSON
          MAX(sub_ratings)            AS sample_sub_ratings
        FROM petty_travel_recommendations
        WHERE to_city = @toCity
          AND (rating IS NULL OR rating >= 3)
        GROUP BY category, service_name, service_detail, to_city_display
        HAVING COUNT(*) >= 1
        ORDER BY category, AVG(CAST(rating AS FLOAT)) DESC, COUNT(*) DESC
      `);

    // Group by category for easy frontend consumption
    const grouped = {};
    for (const row of result.recordset) {
      const cat = row.category;
      if (!grouped[cat]) grouped[cat] = [];

      let subRatings = null;
      try { subRatings = row.sample_sub_ratings ? JSON.parse(row.sample_sub_ratings) : null; } catch {}

      grouped[cat].push({
        serviceName: row.service_name,
        serviceDetail: row.service_detail,
        toCityDisplay: row.to_city_display,
        totalCount: row.total_count,
        avgRating: row.avg_rating ? parseFloat(row.avg_rating.toFixed(1)) : null,
        likedCount: row.liked_count,
        latestRemarks: row.latest_remarks,
        subRatings,
      });
    }

    return res.json({
      toCity: toCity.trim(),
      data: grouped,
      totalFeedbacks: result.recordset.reduce((s, r) => s + r.total_count, 0),
    });
  } catch (err) {
    console.error('[Recommendations] GET error:', err);
    return res.status(500).json({ message: 'Failed to fetch recommendations' });
  }
});

// ── POST /api/travel-recommendations/ingest/:requestId ───────────────────
// Manual trigger (also called internally from travel-feedback POST).
router.post('/ingest/:requestId', async (req, res) => {
  try {
    const requestId = parseInt(req.params.requestId);
    if (!requestId) return res.status(400).json({ message: 'Invalid requestId' });
    const pool = await poolPromise;
    await ensureRecommendationsTable(pool);
    await ingestFeedbackRecommendation(pool, requestId);
    return res.json({ message: `Recommendations ingested for request #${requestId}` });
  } catch (err) {
    console.error('[Recommendations] Ingest endpoint error:', err);
    return res.status(500).json({ message: 'Failed to ingest recommendations' });
  }
});

module.exports = router;
module.exports.ensureRecommendationsTable = ensureRecommendationsTable;
module.exports.ingestFeedbackRecommendation = ingestFeedbackRecommendation;
