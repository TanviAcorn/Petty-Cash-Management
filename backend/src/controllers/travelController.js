const skyscannerService = require('../services/skyscannerService');
const bookingService = require('../services/bookingService');

/**
 * Search for flights using Skyscanner API
 * POST /api/travel/flights/search
 */
exports.searchFlights = async (req, res) => {
  try {
    const { origin, destination, departureDate, returnDate, currency } = req.body;

    // Validate required parameters
    if (!origin || !destination || !departureDate || !currency) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters: origin, destination, departureDate, and currency are required'
      });
    }

    // Validate airport codes format (3 letter IATA codes)
    const airportRegex = /^[A-Z]{3}$/i;
    if (!airportRegex.test(origin)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid origin airport code. Expected 3-letter IATA code (e.g., LHR)'
      });
    }
    if (!airportRegex.test(destination)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid destination airport code. Expected 3-letter IATA code (e.g., JFK)'
      });
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(departureDate)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid departureDate format. Expected YYYY-MM-DD'
      });
    }

    if (returnDate && !dateRegex.test(returnDate)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid returnDate format. Expected YYYY-MM-DD'
      });
    }

    // Validate dates are in the future
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const depDate = new Date(departureDate);
    
    if (depDate < today) {
      return res.status(400).json({
        success: false,
        message: 'Departure date must be today or in the future'
      });
    }

    // Validate return date is after departure date
    if (returnDate) {
      const retDate = new Date(returnDate);
      if (retDate <= depDate) {
        return res.status(400).json({
          success: false,
          message: 'Return date must be after departure date'
        });
      }
    }

    // Call Skyscanner service
    const flights = await skyscannerService.searchFlights({
      origin: origin.toUpperCase(),
      destination: destination.toUpperCase(),
      departureDate,
      returnDate,
      currency: currency.toUpperCase()
    });

    return res.json({
      success: true,
      data: flights
    });

  } catch (error) {
    console.error('Flight search error:', error);

    // Handle specific error types
    if (error.message.includes('not configured')) {
      return res.status(503).json({
        success: false,
        message: 'Flight search service is not configured. Please contact support.'
      });
    }

    if (error.message.includes('temporarily busy') || error.message.includes('not responding')) {
      return res.status(503).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('authentication failed')) {
      return res.status(503).json({
        success: false,
        message: 'Flight search service authentication failed. Please contact support.'
      });
    }

    // Generic error response
    return res.status(500).json({
      success: false,
      message: 'Unable to search flights at this time. Please try again later.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Search for accommodations using Booking.com API
 * POST /api/travel/accommodations/search
 */
exports.searchAccommodations = async (req, res) => {
  try {
    const { destination, checkInDate, checkOutDate, guests, currency } = req.body;

    // Validate required parameters
    if (!destination || !checkInDate || !checkOutDate || !guests || !currency) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters: destination, checkInDate, checkOutDate, guests, and currency are required'
      });
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(checkInDate)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid checkInDate format. Expected YYYY-MM-DD'
      });
    }

    if (!dateRegex.test(checkOutDate)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid checkOutDate format. Expected YYYY-MM-DD'
      });
    }

    // Validate dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);

    if (checkIn < today) {
      return res.status(400).json({
        success: false,
        message: 'Check-in date must be today or in the future'
      });
    }

    if (checkOut <= checkIn) {
      return res.status(400).json({
        success: false,
        message: 'Check-out date must be after check-in date'
      });
    }

    // Validate guests
    const guestsNum = parseInt(guests, 10);
    if (isNaN(guestsNum) || guestsNum < 1 || guestsNum > 20) {
      return res.status(400).json({
        success: false,
        message: 'Number of guests must be between 1 and 20'
      });
    }

    // Call Booking service
    const accommodations = await bookingService.searchAccommodations({
      destination: destination.trim(),
      checkInDate,
      checkOutDate,
      guests: guestsNum,
      currency: currency.toUpperCase()
    });

    return res.json({
      success: true,
      data: accommodations
    });

  } catch (error) {
    console.error('Accommodation search error:', error);

    // Handle specific error types
    if (error.message.includes('not configured')) {
      return res.status(503).json({
        success: false,
        message: 'Accommodation search service is not configured. Please contact support.'
      });
    }

    if (error.message.includes('temporarily busy') || error.message.includes('not responding')) {
      return res.status(503).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('authentication failed')) {
      return res.status(503).json({
        success: false,
        message: 'Accommodation search service authentication failed. Please contact support.'
      });
    }

    // Generic error response
    return res.status(500).json({
      success: false,
      message: 'Unable to search accommodations at this time. Please try again later.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
