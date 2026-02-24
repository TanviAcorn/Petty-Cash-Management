# Implementation Plan: Travel Booking Integration

- [x] 1. Set up backend infrastructure for travel APIs
  - Create service layer files for Skyscanner and Booking.com API integration via RapidAPI
  - Add environment variable for RAPIDAPI_KEY
  - Create utility functions for API request handling and error management
  - Updated to use RapidAPI for both Skyscanner and Booking.com
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 1.1 Implement Skyscanner service with RapidAPI
  - Create `backend/src/services/skyscannerService.js` with searchFlights method
  - Implement RapidAPI authentication and request formatting
  - Add response transformation to standardized FlightOption format
  - Implement error handling for API failures and rate limiting
  - Uses RapidAPI endpoint: https://skyscanner-api.p.rapidapi.com
  - _Requirements: 2.2, 2.6_

- [x] 1.2 Implement Booking.com service with RapidAPI
  - Create `backend/src/services/bookingService.js` with searchAccommodations method
  - Implement RapidAPI authentication and request formatting
  - Add response transformation to standardized AccommodationOption format
  - Implement error handling for API failures and rate limiting
  - Uses RapidAPI endpoint: https://booking-com.p.rapidapi.com
  - _Requirements: 3.2, 3.6_

- [x] 2. Create travel API endpoints
  - Create `backend/src/controllers/travelController.js` with search methods
  - Create `backend/src/routes/travel.js` with flight and accommodation search routes
  - Add input validation for search parameters
  - Implement error responses for invalid requests and API failures
  - Register travel routes in `backend/server.js`
  - _Requirements: 2.2, 3.2, 7.3_

- [x] 2.1 Implement flight search endpoint
  - Create POST `/api/travel/flights/search` endpoint
  - Validate origin, destination, departureDate, returnDate, and currency parameters
  - Call SkyscannerService and return formatted results
  - Handle errors and return appropriate HTTP status codes
  - _Requirements: 2.2, 2.3, 2.6_

- [x] 2.2 Implement accommodation search endpoint
  - Create POST `/api/travel/accommodations/search` endpoint
  - Validate destination, checkInDate, checkOutDate, guests, and currency parameters
  - Call BookingService and return formatted results
  - Handle errors and return appropriate HTTP status codes
  - _Requirements: 3.2, 3.3, 3.6_

- [x] 3. Enhance database schema for travel details
  - Create database migration script to add travel_details column to petty_cash_requests table
  - Add travel_details as NVARCHAR(MAX) NULL column
  - Test migration script on development database
  - Update request creation logic to accept and store travel_details JSON
  - _Requirements: 5.1, 5.4_

- [x] 4. Update backend request handling for travel details
  - Modify POST `/api/requests` endpoint to accept travelDetails parameter
  - Add validation for travelDetails JSON structure
  - Store travelDetails in travel_details database column
  - Update GET `/api/requests/:id` to return parsed travel_details
  - Ensure backward compatibility for requests without travel details
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 5. Create FlightSearch frontend component
  - Create `frontend/src/components/FlightSearch.jsx` component
  - Implement search form with origin, destination, departure date, and return date inputs
  - Add search button and loading state
  - Call `/api/travel/flights/search` endpoint on search
  - Display flight results in card format with airline, times, duration, stops, and price
  - Implement flight selection functionality
  - Add error handling and display error messages
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 8.1, 8.2, 8.3, 8.4_

- [x] 6. Create AccommodationSearch frontend component
  - Create `frontend/src/components/AccommodationSearch.jsx` component
  - Implement search form with destination, check-in date, check-out date, and guests inputs
  - Add search button and loading state
  - Call `/api/travel/accommodations/search` endpoint on search
  - Display accommodation results in card format with hotel name, address, ratings, amenities, and price
  - Implement accommodation selection functionality
  - Add error handling and display error messages
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 8.1, 8.2, 8.3, 8.4_

- [x] 7. Create TravelSummary frontend component
  - Create `frontend/src/components/TravelSummary.jsx` component
  - Display selected flight details in readable format
  - Display selected accommodation details in readable format
  - Show cost breakdown (flight cost, accommodation cost, total)
  - Add edit/remove buttons for selected items
  - _Requirements: 4.1, 4.2, 4.3, 5.2, 5.3, 6.1, 6.2, 6.3, 6.4_

- [x] 8. Create TravelBookingSection container component


  - Create `frontend/src/components/TravelBookingSection.jsx` component
  - Implement conditional rendering based on category selection
  - Add tabs or sections for flight and accommodation search
  - Integrate FlightSearch, AccommodationSearch, and TravelSummary components
  - Manage state for selected flight and accommodation
  - Calculate total travel cost when selections change
  - Emit travel details to parent component via onTravelDetailsChange callback
  - _Requirements: 1.1, 1.2, 4.1, 4.2, 4.3_

- [x] 9. Integrate TravelBookingSection into NewRequest page


  - Import TravelBookingSection component in `frontend/src/pages/NewRequest.jsx`
  - Add state for travelDetails in NewRequest component
  - Conditionally render TravelBookingSection when travel-related category is selected
  - Implement category detection logic (check for keywords: "travel", "trip", "flight", "hotel")
  - Update amount field automatically when travel cost is calculated
  - Allow manual amount adjustment after auto-population
  - Include travelDetails in form submission to backend
  - _Requirements: 1.1, 1.3, 1.4, 4.3, 4.4, 4.5, 5.1_

- [x] 10. Enhance request review pages to display travel details



  - Update `frontend/src/pages/RequestReview.jsx` to parse and display travel_details
  - Update `frontend/src/pages/UserRequestDetails.jsx` to parse and display travel_details
  - Create travel itinerary display section showing flight and accommodation details
  - Show cost breakdown for travel requests
  - Handle requests without travel details gracefully
  - _Requirements: 5.5, 6.1, 6.2, 6.3, 6.4, 6.5_
