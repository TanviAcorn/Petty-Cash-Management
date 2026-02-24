const axios = require('axios');

class BookingService {
  constructor() {
    this.apiKey = process.env.RAPIDAPI_KEY;
    this.baseUrl = 'https://booking-com.p.rapidapi.com/v1';
    
    if (!this.apiKey) {
      console.warn('RAPIDAPI_KEY not configured. Accommodation search will not be available.');
    }
  }

  /**
   * Search for accommodations based on provided criteria
   * @param {Object} params - Search parameters
   * @param {string} params.destination - Destination city or location
   * @param {string} params.checkInDate - Check-in date in YYYY-MM-DD format
   * @param {string} params.checkOutDate - Check-out date in YYYY-MM-DD format
   * @param {number} params.guests - Number of guests
   * @param {string} params.currency - Currency code (e.g., 'GBP')
   * @returns {Promise<Array>} Array of accommodation options
   */
  async searchAccommodations(params) {
    try {
      // Validate API key
      if (!this.apiKey) {
        throw new Error('RapidAPI key not configured');
      }

      // Validate required parameters
      this._validateSearchParams(params);

      // Step 1: Search for destination to get dest_id
      const locationResponse = await axios.get(`${this.baseUrl}/hotels/locations`, {
        headers: {
          'X-RapidAPI-Key': this.apiKey,
          'X-RapidAPI-Host': 'booking-com.p.rapidapi.com'
        },
        params: {
          name: params.destination,
          locale: 'en-gb'
        },
        timeout: 10000
      });

      const destinations = locationResponse.data;
      if (!destinations || destinations.length === 0) {
        throw new Error(`No destinations found for "${params.destination}"`);
      }

      const destId = destinations[0].dest_id;

      // Step 2: Search for hotels at that destination
      const hotelsResponse = await axios.get(`${this.baseUrl}/hotels/search`, {
        headers: {
          'X-RapidAPI-Key': this.apiKey,
          'X-RapidAPI-Host': 'booking-com.p.rapidapi.com'
        },
        params: {
          dest_id: destId,
          dest_type: destinations[0].dest_type || 'city',
          checkin_date: params.checkInDate,
          checkout_date: params.checkOutDate,
          adults_number: params.guests,
          room_number: '1',
          units: 'metric',
          currency: params.currency,
          locale: 'en-gb',
          order_by: 'popularity'
        },
        timeout: 15000
      });

      // Transform the response
      return this._transformAccommodationResponse(hotelsResponse.data, params);

    } catch (error) {
      return this._handleError(error, 'searchAccommodations');
    }
  }

  /**
   * Validate search parameters
   * @private
   */
  _validateSearchParams(params) {
    const required = ['destination', 'checkInDate', 'checkOutDate', 'guests', 'currency'];
    const missing = required.filter(field => !params[field]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required parameters: ${missing.join(', ')}`);
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(params.checkInDate)) {
      throw new Error('Invalid checkInDate format. Expected YYYY-MM-DD');
    }

    if (!dateRegex.test(params.checkOutDate)) {
      throw new Error('Invalid checkOutDate format. Expected YYYY-MM-DD');
    }

    // Validate check-out is after check-in
    const checkIn = new Date(params.checkInDate);
    const checkOut = new Date(params.checkOutDate);
    if (checkOut <= checkIn) {
      throw new Error('Check-out date must be after check-in date');
    }

    // Validate guests
    if (!Number.isInteger(params.guests) || params.guests < 1) {
      throw new Error('Number of guests must be a positive integer');
    }
  }

  /**
   * Calculate number of nights between check-in and check-out
   * @private
   */
  _calculateNights(checkInDate, checkOutDate) {
    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);
    const diffTime = Math.abs(checkOut - checkIn);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  /**
   * Transform API response to standardized format
   * @private
   */
  _transformAccommodationResponse(apiData, params) {
    try {
      const nights = this._calculateNights(params.checkInDate, params.checkOutDate);
      const results = apiData?.result || [];

      if (results.length === 0) {
        console.warn('No accommodations found in API response');
        return [];
      }

      // Transform Booking.com API response to our AccommodationOption format
      return results.slice(0, 10).map((hotel, index) => {
        const pricePerNight = hotel.min_total_price 
          ? parseFloat(hotel.min_total_price) / nights 
          : parseFloat(hotel.price_breakdown?.gross_price || 0) / nights;
        
        const totalPrice = hotel.min_total_price 
          ? parseFloat(hotel.min_total_price)
          : parseFloat(hotel.price_breakdown?.gross_price || 0);

        return {
          id: hotel.hotel_id || `hotel_${Date.now()}_${index}`,
          name: hotel.hotel_name || 'Unknown Hotel',
          address: hotel.address || 'Address not available',
          starRating: hotel.class || hotel.hotel_class || 0,
          guestRating: hotel.review_score || 0,
          checkInDate: params.checkInDate,
          checkOutDate: params.checkOutDate,
          nights: nights,
          guests: params.guests,
          pricePerNight: parseFloat(pricePerNight.toFixed(2)),
          totalPrice: parseFloat(totalPrice.toFixed(2)),
          currency: params.currency,
          amenities: this._extractAmenities(hotel),
          bookingUrl: hotel.url || `https://www.booking.com/hotel/${hotel.hotel_id}.html`
        };
      });
    } catch (error) {
      console.error('Error transforming accommodation response:', error);
      return [];
    }
  }

  /**
   * Extract amenities from hotel data
   * @private
   */
  _extractAmenities(hotel) {
    const amenities = [];
    
    if (hotel.has_free_parking) amenities.push('Free Parking');
    if (hotel.is_free_cancellable) amenities.push('Free Cancellation');
    if (hotel.has_swimming_pool) amenities.push('Pool');
    if (hotel.accommodation_type_name) amenities.push(hotel.accommodation_type_name);
    
    // Add facilities if available
    if (hotel.hotel_facilities) {
      amenities.push(...hotel.hotel_facilities.slice(0, 3));
    }

    return amenities.slice(0, 5); // Limit to 5 amenities
  }

  /**
   * Generate mock accommodation data for development/testing
   * @private
   */
  _generateMockAccommodations(params) {
    const hotelNames = [
      'Grand Plaza Hotel',
      'City Center Inn',
      'Riverside Suites',
      'Metropolitan Hotel',
      'Comfort Lodge'
    ];

    const amenitiesList = [
      ['WiFi', 'Gym', 'Pool', 'Restaurant'],
      ['WiFi', 'Breakfast', 'Parking'],
      ['WiFi', 'Gym', 'Business Center'],
      ['WiFi', 'Pool', 'Spa', 'Restaurant', 'Bar'],
      ['WiFi', 'Parking', 'Breakfast']
    ];

    const nights = this._calculateNights(params.checkInDate, params.checkOutDate);
    const accommodations = [];

    for (let i = 0; i < 5; i++) {
      const starRating = 3 + (i % 3);
      const basePricePerNight = 80 + (starRating * 30) + (i * 10);
      const guestRating = 7.5 + (i * 0.3);
      
      const accommodation = {
        id: `hotel_${Date.now()}_${i}`,
        name: hotelNames[i],
        address: `${100 + i * 50} Main Street, ${params.destination}`,
        starRating: starRating,
        guestRating: parseFloat(guestRating.toFixed(1)),
        checkInDate: params.checkInDate,
        checkOutDate: params.checkOutDate,
        nights: nights,
        guests: params.guests,
        pricePerNight: basePricePerNight,
        totalPrice: basePricePerNight * nights,
        currency: params.currency,
        amenities: amenitiesList[i],
        bookingUrl: 'https://www.booking.com'
      };

      accommodations.push(accommodation);
    }

    return accommodations;
  }

  /**
   * Handle errors with appropriate logging and user-friendly messages
   * @private
   */
  _handleError(error, operation) {
    console.error(`BookingService.${operation} error:`, error.message);
    
    // Log full error for debugging
    if (error.response) {
      console.error('API Response Error:', {
        status: error.response.status,
        data: error.response.data
      });
    }

    // Rate limiting error
    if (error.response && error.response.status === 429) {
      throw new Error('Accommodation search service is temporarily busy. Please try again in a moment.');
    }

    // API authentication error
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      throw new Error('Accommodation search service authentication failed. Please check your API key.');
    }

    // Network/timeout errors
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      throw new Error('Accommodation search service is not responding. Please try again later.');
    }

    // Validation errors (pass through)
    if (error.message.includes('Missing required') || error.message.includes('Invalid') || error.message.includes('No destinations found')) {
      throw error;
    }

    // Generic error
    throw new Error('Unable to search accommodations at this time. Please try again later.');
  }
}

module.exports = new BookingService();
