# Design Document: Travel Booking Integration

## Overview

This design document outlines the architecture and implementation approach for integrating travel booking functionality into the HR Petty Cash Management System. The solution will enable employees to search and select flights (via Skyscanner API) and accommodations (via Booking.com API) directly within the petty cash request workflow when requesting travel-related expenses.

### Key Design Principles

1. **Minimal Disruption**: Integrate seamlessly with existing request creation flow
2. **Progressive Enhancement**: Travel booking is optional; users can still submit requests without API selections
3. **Data Integrity**: Store travel details in a structured, queryable format
4. **API Resilience**: Handle API failures gracefully without blocking request submission
5. **Cost Transparency**: Automatically calculate and display total travel costs

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React)                         │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  NewRequest Component (Enhanced)                       │ │
│  │  ├─ Basic Request Form                                 │ │
│  │  ├─ TravelBookingSection (New)                         │ │
│  │  │  ├─ FlightSearch Component                          │ │
│  │  │  └─ AccommodationSearch Component                   │ │
│  │  └─ TravelSummary Component                            │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTP/REST
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Backend (Node.js/Express)                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  /api/requests (Enhanced)                              │ │
│  │  /api/travel/flights/search (New)                      │ │
│  │  /api/travel/accommodations/search (New)               │ │
│  └────────────────────────────────────────────────────────┘ │
│                            │                                 │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Travel Service Layer                                  │ │
│  │  ├─ Skyscanner API Client                              │ │
│  │  └─ Booking.com API Client                             │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Database (MS SQL Server)                        │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  petty_cash_requests (Enhanced)                        │ │
│  │  ├─ travel_details (JSON column - new)                 │ │
│  │  └─ existing columns...                                │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### Frontend Components

#### 1. TravelBookingSection Component

**Purpose**: Container component that conditionally renders when a travel-related category is selected.

**Props**:
```typescript
interface TravelBookingSectionProps {
  onTravelDetailsChange: (details: TravelDetails) => void;
  initialDetails?: TravelDetails;
  currency: string;
}
```

**State**:
```typescript
interface TravelBookingState {
  showTravelBooking: boolean;
  selectedFlight: FlightOption | null;
  selectedAccommodation: AccommodationOption | null;
  totalCost: number;
}
```

**Behavior**:
- Renders when category contains keywords: "travel", "trip", "flight", "hotel"
- Provides tabs or sections for flight and accommodation search
- Calculates and displays total travel cost
- Emits travel details to parent component

#### 2. FlightSearch Component

**Purpose**: Search and select flights using Skyscanner API.

**Props**:
```typescript
interface FlightSearchProps {
  onFlightSelect: (flight: FlightOption) => void;
  selectedFlight: FlightOption | null;
  currency: string;
}
```

**State**:
```typescript
interface FlightSearchState {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate: string;
  searchResults: FlightOption[];
  loading: boolean;
  error: string | null;
}
```

**UI Elements**:
- Origin airport input (autocomplete)
- Destination airport input (autocomplete)
- Departure date picker
- Return date picker (optional for one-way)
- Search button
- Results list with flight cards
- Loading indicator
- Error message display

#### 3. AccommodationSearch Component

**Purpose**: Search and select accommodations using Booking.com API.

**Props**:
```typescript
interface AccommodationSearchProps {
  onAccommodationSelect: (accommodation: AccommodationOption) => void;
  selectedAccommodation: AccommodationOption | null;
  currency: string;
}
```

**State**:
```typescript
interface AccommodationSearchState {
  destination: string;
  checkInDate: string;
  checkOutDate: string;
  guests: number;
  searchResults: AccommodationOption[];
  loading: boolean;
  error: string | null;
}
```

**UI Elements**:
- Destination city input (autocomplete)
- Check-in date picker
- Check-out date picker
- Number of guests selector
- Search button
- Results list with hotel cards
- Loading indicator
- Error message display

#### 4. TravelSummary Component

**Purpose**: Display selected travel details and cost breakdown.

**Props**:
```typescript
interface TravelSummaryProps {
  flight: FlightOption | null;
  accommodation: AccommodationOption | null;
  currency: string;
}
```

**Display**:
- Flight details (if selected)
- Accommodation details (if selected)
- Cost breakdown
- Total travel cost
- Edit/remove options

### Backend API Endpoints

#### 1. POST /api/travel/flights/search

**Purpose**: Search for flights using Skyscanner API.

**Request Body**:
```json
{
  "origin": "LHR",
  "destination": "JFK",
  "departureDate": "2026-03-15",
  "returnDate": "2026-03-22",
  "currency": "GBP"
}
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "flight_123",
      "airline": "British Airways",
      "flightNumber": "BA117",
      "origin": "LHR",
      "destination": "JFK",
      "departureTime": "2026-03-15T10:30:00Z",
      "arrivalTime": "2026-03-15T13:45:00Z",
      "duration": "7h 15m",
      "stops": 0,
      "price": 450.00,
      "currency": "GBP",
      "bookingUrl": "https://..."
    }
  ]
}
```

#### 2. POST /api/travel/accommodations/search

**Purpose**: Search for accommodations using Booking.com API.

**Request Body**:
```json
{
  "destination": "New York",
  "checkInDate": "2026-03-15",
  "checkOutDate": "2026-03-22",
  "guests": 1,
  "currency": "GBP"
}
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "hotel_456",
      "name": "Marriott Marquis",
      "address": "1535 Broadway, New York, NY 10036",
      "starRating": 4,
      "guestRating": 8.5,
      "pricePerNight": 200.00,
      "totalPrice": 1400.00,
      "currency": "GBP",
      "amenities": ["WiFi", "Gym", "Pool"],
      "bookingUrl": "https://..."
    }
  ]
}
```

#### 3. Enhanced POST /api/requests

**Purpose**: Create petty cash request with optional travel details.

**Request Body** (multipart/form-data):
```
employeeName: "John Doe"
employeeEmail: "john@example.com"
company: "Acorn Universal"
category: "Travel"
location: "London Office"
amount: 1850.00
currency: "GBP"
dateOfPurchase: "2026-03-15"
description: "Business trip to New York"
travelDetails: "{...}" // JSON string
attachments: [files]
```

**Travel Details JSON Structure**:
```json
{
  "flight": {
    "id": "flight_123",
    "airline": "British Airways",
    "flightNumber": "BA117",
    "origin": "LHR",
    "destination": "JFK",
    "departureTime": "2026-03-15T10:30:00Z",
    "arrivalTime": "2026-03-15T13:45:00Z",
    "returnDepartureTime": "2026-03-22T15:00:00Z",
    "returnArrivalTime": "2026-03-22T23:30:00Z",
    "price": 450.00,
    "currency": "GBP"
  },
  "accommodation": {
    "id": "hotel_456",
    "name": "Marriott Marquis",
    "address": "1535 Broadway, New York, NY 10036",
    "checkInDate": "2026-03-15",
    "checkOutDate": "2026-03-22",
    "nights": 7,
    "pricePerNight": 200.00,
    "totalPrice": 1400.00,
    "currency": "GBP"
  },
  "totalCost": 1850.00
}
```

### Backend Service Layer

#### 1. SkyscannerService

**File**: `backend/src/services/skyscannerService.js`

**Methods**:
```javascript
class SkyscannerService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://partners.api.skyscanner.net/apiservices';
  }

  async searchFlights(params) {
    // Implementation
  }

  async getFlightDetails(flightId) {
    // Implementation
  }
}
```

**API Integration Notes**:
- Use Skyscanner's Browse Quotes API or Live Pricing API
- Handle rate limiting and caching
- Transform API response to standardized format
- Handle errors gracefully

#### 2. BookingService

**File**: `backend/src/services/bookingService.js`

**Methods**:
```javascript
class BookingService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://distribution-xml.booking.com/2.0';
  }

  async searchAccommodations(params) {
    // Implementation
  }

  async getAccommodationDetails(hotelId) {
    // Implementation
  }
}
```

**API Integration Notes**:
- Use Booking.com Affiliate API or Distribution API
- Handle authentication and rate limiting
- Transform API response to standardized format
- Handle errors gracefully

#### 3. TravelController

**File**: `backend/src/controllers/travelController.js`

**Methods**:
```javascript
class TravelController {
  async searchFlights(req, res) {
    // Validate request
    // Call SkyscannerService
    // Return formatted response
  }

  async searchAccommodations(req, res) {
    // Validate request
    // Call BookingService
    // Return formatted response
  }
}
```

## Data Models

### Database Schema Changes

#### Enhanced petty_cash_requests Table

Add new column to existing table:

```sql
ALTER TABLE petty_cash_requests
ADD travel_details NVARCHAR(MAX) NULL;
```

**Column Details**:
- `travel_details`: JSON string containing flight and accommodation selections
- Nullable: Yes (not all requests are travel-related)
- Format: JSON string that can be parsed into TravelDetails object

### TypeScript/JavaScript Interfaces

```typescript
interface TravelDetails {
  flight?: FlightDetails;
  accommodation?: AccommodationDetails;
  totalCost: number;
  currency: string;
}

interface FlightDetails {
  id: string;
  airline: string;
  flightNumber: string;
  origin: string;
  destination: string;
  departureTime: string;
  arrivalTime: string;
  returnDepartureTime?: string;
  returnArrivalTime?: string;
  duration: string;
  stops: number;
  price: number;
  currency: string;
  bookingUrl?: string;
}

interface AccommodationDetails {
  id: string;
  name: string;
  address: string;
  starRating: number;
  guestRating: number;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  guests: number;
  pricePerNight: number;
  totalPrice: number;
  currency: string;
  amenities: string[];
  bookingUrl?: string;
}

interface FlightOption extends FlightDetails {}
interface AccommodationOption extends AccommodationDetails {}
```

## Error Handling

### Frontend Error Handling

1. **API Search Failures**:
   - Display user-friendly error messages
   - Allow users to retry search
   - Provide option to skip travel booking and proceed with manual entry

2. **Network Errors**:
   - Show connection error message
   - Implement retry mechanism
   - Allow offline form submission without travel details

3. **Validation Errors**:
   - Highlight invalid fields
   - Show specific validation messages
   - Prevent form submission until resolved

### Backend Error Handling

1. **External API Failures**:
   ```javascript
   try {
     const results = await skyscannerService.searchFlights(params);
     return res.json({ success: true, data: results });
   } catch (error) {
     console.error('Skyscanner API error:', error);
     return res.status(503).json({
       success: false,
       message: 'Flight search service temporarily unavailable',
       error: process.env.NODE_ENV === 'development' ? error.message : undefined
     });
   }
   ```

2. **Rate Limiting**:
   - Implement request throttling
   - Cache frequent searches
   - Return cached results when available

3. **Invalid Requests**:
   - Validate all input parameters
   - Return 400 Bad Request with specific error messages
   - Log validation failures for monitoring

## Testing Strategy

### Unit Tests

1. **Frontend Components**:
   - Test FlightSearch component rendering and interactions
   - Test AccommodationSearch component rendering and interactions
   - Test TravelSummary component display logic
   - Test cost calculation functions
   - Mock API calls

2. **Backend Services**:
   - Test SkyscannerService API integration (mocked)
   - Test BookingService API integration (mocked)
   - Test TravelController request handling
   - Test error handling scenarios

3. **Data Transformation**:
   - Test API response parsing
   - Test travel details JSON serialization/deserialization
   - Test currency conversion logic

### Integration Tests

1. **API Endpoint Tests**:
   - Test /api/travel/flights/search endpoint
   - Test /api/travel/accommodations/search endpoint
   - Test enhanced /api/requests endpoint with travel details
   - Test error responses

2. **Database Tests**:
   - Test travel_details column storage
   - Test JSON parsing from database
   - Test request retrieval with travel details

### End-to-End Tests

1. **User Workflows**:
   - Create travel request with flight selection
   - Create travel request with accommodation selection
   - Create travel request with both flight and accommodation
   - Create travel request without travel booking (skip)
   - View travel request details as admin

2. **Error Scenarios**:
   - Handle API timeout gracefully
   - Handle invalid search parameters
   - Handle missing API credentials

## Security Considerations

### API Key Management

1. **Environment Variables**:
   ```
   SKYSCANNER_API_KEY=your_key_here
   BOOKING_API_KEY=your_key_here
   ```

2. **Backend-Only Access**:
   - Never expose API keys to frontend
   - All external API calls go through backend
   - Implement request validation and sanitization

### Data Validation

1. **Input Sanitization**:
   - Validate all user inputs before API calls
   - Sanitize search parameters
   - Prevent injection attacks

2. **Rate Limiting**:
   - Implement per-user rate limits
   - Prevent API abuse
   - Monitor unusual activity

## Performance Optimization

### Caching Strategy

1. **Flight Search Results**:
   - Cache results for 15 minutes
   - Use origin-destination-date as cache key
   - Implement in-memory cache (Redis recommended for production)

2. **Accommodation Search Results**:
   - Cache results for 30 minutes
   - Use destination-dates as cache key
   - Clear cache on date changes

### API Request Optimization

1. **Debouncing**:
   - Debounce autocomplete searches (300ms)
   - Prevent excessive API calls during typing

2. **Pagination**:
   - Limit initial results to 10-20 items
   - Implement "load more" functionality
   - Reduce initial payload size

## Deployment Considerations

### Environment Configuration

1. **Development**:
   - Use sandbox/test API endpoints
   - Mock API responses for faster development
   - Enable detailed error logging

2. **Production**:
   - Use production API endpoints
   - Enable API monitoring and alerting
   - Implement proper error tracking (e.g., Sentry)

### Migration Strategy

1. **Database Migration**:
   ```sql
   -- Run this migration script
   IF NOT EXISTS (
     SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_NAME = 'petty_cash_requests' 
     AND COLUMN_NAME = 'travel_details'
   )
   BEGIN
     ALTER TABLE petty_cash_requests
     ADD travel_details NVARCHAR(MAX) NULL;
   END
   ```

2. **Backward Compatibility**:
   - Existing requests without travel_details continue to work
   - Frontend gracefully handles null travel_details
   - Admin view displays travel details only when present

### Monitoring and Logging

1. **API Metrics**:
   - Track API response times
   - Monitor API error rates
   - Alert on high failure rates

2. **User Analytics**:
   - Track travel booking feature usage
   - Monitor conversion rates (searches to selections)
   - Identify common search patterns

## Future Enhancements

1. **Multi-City Flights**: Support complex itineraries
2. **Car Rentals**: Add car rental search integration
3. **Travel Policy Enforcement**: Validate selections against company travel policy
4. **Booking Confirmation**: Direct booking through APIs (requires additional agreements)
5. **Price Alerts**: Notify users of price changes
6. **Travel Approval Workflow**: Separate approval for travel vs. expense
