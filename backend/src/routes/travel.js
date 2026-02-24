const express = require('express');
const router = express.Router();
const travelController = require('../controllers/travelController');

/**
 * POST /api/travel/flights/search
 * Search for flights using Skyscanner API
 * 
 * Request body:
 * {
 *   origin: string (3-letter IATA code, e.g., 'LHR'),
 *   destination: string (3-letter IATA code, e.g., 'JFK'),
 *   departureDate: string (YYYY-MM-DD),
 *   returnDate: string (YYYY-MM-DD, optional),
 *   currency: string (e.g., 'GBP')
 * }
 */
router.post('/flights/search', travelController.searchFlights);

/**
 * POST /api/travel/accommodations/search
 * Search for accommodations using Booking.com API
 * 
 * Request body:
 * {
 *   destination: string (city name),
 *   checkInDate: string (YYYY-MM-DD),
 *   checkOutDate: string (YYYY-MM-DD),
 *   guests: number (1-20),
 *   currency: string (e.g., 'GBP')
 * }
 */
router.post('/accommodations/search', travelController.searchAccommodations);

module.exports = router;
