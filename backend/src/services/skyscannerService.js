const axios = require('axios');

class SkyscannerService {
  constructor() {
    this.apiKey = process.env.RAPIDAPI_KEY;
    this.baseUrl = 'https://skyscanner-api.p.rapidapi.com/v3/flights';
    
    if (!this.apiKey) {
      console.warn('RAPIDAPI_KEY not configured. Flight search will not be available.');
    }
  }

  /**
   * Search for flights based on provided criteria
   * @param {Object} params - Search parameters
   * @param {string} params.origin - Origin airport code (e.g., 'LHR')
   * @param {string} params.destination - Destination airport code (e.g., 'JFK')
   * @param {string} params.departureDate - Departure date in YYYY-MM-DD format
   * @param {string} params.returnDate - Return date in YYYY-MM-DD format (optional)
   * @param {string} params.currency - Currency code (e.g., 'GBP')
   * @returns {Promise<Array>} Array of flight options
   */
  async searchFlights(params) {
    try {
      // Validate API key
      if (!this.apiKey) {
        throw new Error('RapidAPI key not configured');
      }

      // Validate required parameters
      this._validateSearchParams(params);

      // Make actual API call to Skyscanner via RapidAPI
      const response = await axios.get(`${this.baseUrl}/live/search/create`, {
        headers: {
          'X-RapidAPI-Key': this.apiKey,
          'X-RapidAPI-Host': 'skyscanner-api.p.rapidapi.com'
        },
        params: {
          originSkyId: params.origin,
          destinationSkyId: params.destination,
          originEntityId: params.origin,
          destinationEntityId: params.destination,
          date: params.departureDate,
          returnDate: params.returnDate || undefined,
          cabinClass: 'economy',
          adults: '1',
          currency: params.currency,
          market: 'UK',
          locale: 'en-GB'
        },
        timeout: 15000 // 15 second timeout
      });

      // Transform the response
      return this._transformFlightResponse(response.data, params);

    } catch (error) {
      return this._handleError(error, 'searchFlights');
    }
  }

  /**
   * Validate search parameters
   * @private
   */
  _validateSearchParams(params) {
    const required = ['origin', 'destination', 'departureDate', 'currency'];
    const missing = required.filter(field => !params[field]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required parameters: ${missing.join(', ')}`);
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(params.departureDate)) {
      throw new Error('Invalid departureDate format. Expected YYYY-MM-DD');
    }

    if (params.returnDate && !dateRegex.test(params.returnDate)) {
      throw new Error('Invalid returnDate format. Expected YYYY-MM-DD');
    }

    // Validate airport codes (3 letter IATA codes)
    const airportRegex = /^[A-Z]{3}$/;
    if (!airportRegex.test(params.origin)) {
      throw new Error('Invalid origin airport code. Expected 3-letter IATA code');
    }
    if (!airportRegex.test(params.destination)) {
      throw new Error('Invalid destination airport code. Expected 3-letter IATA code');
    }
  }

  /**
   * Transform API response to standardized format
   * @private
   */
  _transformFlightResponse(apiData, params) {
    try {
      // Handle different response structures from Skyscanner API
      const itineraries = apiData?.content?.results?.itineraries || {};
      const legs = apiData?.content?.results?.legs || {};
      const segments = apiData?.content?.results?.segments || {};
      const places = apiData?.content?.results?.places || {};
      const carriers = apiData?.content?.results?.carriers || {};

      const flights = [];

      // Process each itinerary
      Object.values(itineraries).forEach((itinerary, index) => {
        try {
          const pricingOptions = itinerary.pricingOptions || [];
          if (pricingOptions.length === 0) return;

          const pricing = pricingOptions[0];
          const legIds = itinerary.legIds || [];
          
          if (legIds.length === 0) return;

          // Get outbound leg
          const outboundLeg = legs[legIds[0]];
          if (!outboundLeg) return;

          const outboundSegmentId = outboundLeg.segmentIds?.[0];
          const outboundSegment = outboundSegmentId ? segments[outboundSegmentId] : null;

          // Get carrier info
          const carrierId = outboundSegment?.marketingCarrierId;
          const carrier = carrierId ? carriers[carrierId] : null;

          // Get origin and destination info
          const originPlace = places[outboundLeg.originPlaceId];
          const destPlace = places[outboundLeg.destinationPlaceId];

          const flight = {
            id: itinerary.id || `flight_${Date.now()}_${index}`,
            airline: carrier?.name || 'Unknown Airline',
            flightNumber: outboundSegment?.flightNumber || 'N/A',
            origin: originPlace?.iata || params.origin,
            destination: destPlace?.iata || params.destination,
            departureTime: outboundLeg.departureDateTime,
            arrivalTime: outboundLeg.arrivalDateTime,
            duration: this._formatDuration(outboundLeg.durationInMinutes),
            stops: outboundLeg.stopCount || 0,
            price: parseFloat(pricing.price?.amount || 0),
            currency: params.currency,
            bookingUrl: pricing.items?.[0]?.deepLink || ''
          };

          // Add return leg if exists
          if (legIds.length > 1) {
            const returnLeg = legs[legIds[1]];
            if (returnLeg) {
              flight.returnDepartureTime = returnLeg.departureDateTime;
              flight.returnArrivalTime = returnLeg.arrivalDateTime;
            }
          }

          flights.push(flight);
        } catch (err) {
          console.error('Error processing itinerary:', err);
        }
      });

      // If no flights found, return empty array instead of mock data
      if (flights.length === 0) {
        console.warn('No flights found in API response');
        return [];
      }

      return flights;
    } catch (error) {
      console.error('Error transforming flight response:', error);
      return [];
    }
  }

  /**
   * Format duration from minutes to readable string
   * @private
   */
  _formatDuration(minutes) {
    if (!minutes) return 'N/A';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  }

  /**
   * Calculate flight duration
   * @private
   */
  _calculateDuration(departureTime, arrivalTime) {
    if (!departureTime || !arrivalTime) return 'N/A';
    const departure = new Date(departureTime);
    const arrival = new Date(arrivalTime);
    const diffMs = arrival - departure;
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  }

  /**
   * Handle errors with appropriate logging and user-friendly messages
   * @private
   */
  _handleError(error, operation) {
    console.error(`SkyscannerService.${operation} error:`, error.message);
    
    // Log full error for debugging
    if (error.response) {
      console.error('API Response Error:', {
        status: error.response.status,
        data: error.response.data
      });
    }

    // Rate limiting error
    if (error.response && error.response.status === 429) {
      throw new Error('Flight search service is temporarily busy. Please try again in a moment.');
    }

    // API authentication error
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      throw new Error('Flight search service authentication failed. Please check your API key.');
    }

    // Network/timeout errors
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      throw new Error('Flight search service is not responding. Please try again later.');
    }

    // Validation errors (pass through)
    if (error.message.includes('Missing required') || error.message.includes('Invalid')) {
      throw error;
    }

    // Generic error
    throw new Error('Unable to search flights at this time. Please try again later.');
  }
}

module.exports = new SkyscannerService();
