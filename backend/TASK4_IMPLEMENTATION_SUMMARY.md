# Task 4 Implementation Summary: Update Backend Request Handling for Travel Details

## Overview
This task successfully updated the backend request handling to support travel details in petty cash requests, including validation, storage, and retrieval.

## Changes Made

### 1. POST /api/requests Endpoint Enhancement
**File**: `backend/src/routes/requests.js`

#### Added Travel Details Validation
- Accepts `travelDetails` parameter in request body
- Validates JSON structure before storage
- Ensures travel details contain at least one of: `flight` or `accommodation`
- Validates required fields for flight data:
  - `airline`
  - `origin`
  - `destination`
  - `departureTime`
  - `price`
- Validates required fields for accommodation data:
  - `name`
  - `checkInDate`
  - `checkOutDate`
  - `totalPrice`
- Returns appropriate error messages for invalid data (400 Bad Request)
- Stores validated travel details as JSON string in `travel_details` column

#### Backward Compatibility
- Requests without travel details continue to work normally
- `travel_details` column is nullable
- No breaking changes to existing functionality

### 2. GET /api/requests/:id Endpoint Enhancement
**File**: `backend/src/routes/requests.js`

#### Travel Details Parsing
- Retrieves `travel_details` from database
- Automatically parses JSON string to object
- Returns `travelDetails` as parsed object in response
- Handles parsing errors gracefully (returns null on error)
- Maintains backward compatibility for requests without travel details

### 3. PUT /api/requests/:id Endpoint Enhancement
**File**: `backend/src/routes/requests.js`

#### Travel Details Update Support
- Accepts `travelDetails` parameter for updates
- Applies same validation as POST endpoint
- Allows clearing travel details (set to null)
- Only updates travel_details if explicitly provided in request
- Maintains backward compatibility

### 4. Database Schema Management
**File**: `backend/src/routes/requests.js`

#### ensureTravelDetailsColumn Function
- Automatically creates `travel_details` column if it doesn't exist
- Column type: `NVARCHAR(MAX)` (supports large JSON data)
- Column is nullable (backward compatible)
- Called before any operation that uses travel_details

## API Contract

### POST /api/requests
**Request Body** (multipart/form-data):
```
employeeName: string (required)
employeeEmail: string (required)
company: string
category: string (required)
amount: number (required)
currency: string
description: string
dateOfPurchase: date
location: string
travelDetails: JSON string (optional)
attachments: files[]
```

**Travel Details Structure**:
```json
{
  "flight": {
    "id": "string",
    "airline": "string (required)",
    "flightNumber": "string",
    "origin": "string (required)",
    "destination": "string (required)",
    "departureTime": "string (required)",
    "arrivalTime": "string",
    "returnDepartureTime": "string",
    "returnArrivalTime": "string",
    "duration": "string",
    "stops": number,
    "price": number (required),
    "currency": "string",
    "bookingUrl": "string"
  },
  "accommodation": {
    "id": "string",
    "name": "string (required)",
    "address": "string",
    "starRating": number,
    "guestRating": number,
    "checkInDate": "string (required)",
    "checkOutDate": "string (required)",
    "nights": number,
    "guests": number,
    "pricePerNight": number,
    "totalPrice": number (required)",
    "currency": "string",
    "amenities": string[],
    "bookingUrl": "string"
  },
  "totalCost": number,
  "currency": "string"
}
```

**Response**:
```json
{
  "id": 123,
  "employee_name": "John Doe",
  "employee_email": "john@example.com",
  "company_name": "Acorn Universal",
  "category_name": "Travel",
  "amount": 1850.00,
  "currency": "GBP",
  "travel_details": "{...}",
  ...
}
```

### GET /api/requests/:id
**Response**:
```json
{
  "data": {
    "id": 123,
    "employeeName": "John Doe",
    "employeeEmail": "john@example.com",
    "company": "Acorn Universal",
    "category": "Travel",
    "amount": 1850.00,
    "currency": "GBP",
    "description": "Business trip to New York",
    "travelDetails": {
      "flight": { ... },
      "accommodation": { ... },
      "totalCost": 1850.00
    },
    ...
  }
}
```

**Note**: `travelDetails` is automatically parsed from JSON string to object.

### PUT /api/requests/:id
**Request Body**:
```json
{
  "company": "string",
  "category": "string",
  "location": "string",
  "amount": number,
  "description": "string",
  "dateOfPurchase": "date",
  "travelDetails": object | null
}
```

**Response**: Same as GET endpoint

## Validation Rules

### Travel Details Validation
1. Must be valid JSON (if provided as string)
2. Must contain at least one of: `flight` or `accommodation`
3. If `flight` is present, must include: `airline`, `origin`, `destination`, `departureTime`, `price`
4. If `accommodation` is present, must include: `name`, `checkInDate`, `checkOutDate`, `totalPrice`
5. Empty objects `{}` are rejected
6. `null` or `undefined` values are accepted (no travel details)

### Error Responses
- **400 Bad Request**: Invalid JSON format
- **400 Bad Request**: Missing required fields in flight/accommodation
- **400 Bad Request**: Empty travel details object
- **400 Bad Request**: Invalid structure (no flight or accommodation)

## Backward Compatibility

### Existing Requests
- All existing requests without travel_details continue to work
- GET endpoint returns `travelDetails: null` for old requests
- No migration required for existing data

### New Requests Without Travel Details
- Can still create requests without providing travelDetails
- System works exactly as before for non-travel requests
- No breaking changes to existing workflows

## Testing

### Test Files Created
1. `backend/test-travel-details-task4.js` - Integration tests (requires running server)
2. `backend/verify-travel-details-validation.js` - Unit tests for validation logic

### Test Coverage
- ✓ Create request with valid travel details
- ✓ Create request without travel details (backward compatibility)
- ✓ Get request with parsed travel details
- ✓ Update request with modified travel details
- ✓ Validate required flight fields
- ✓ Validate required accommodation fields
- ✓ Reject invalid JSON
- ✓ Reject empty travel details object
- ✓ Handle null/undefined travel details

## Requirements Satisfied

### Requirement 5.1
✓ Store travel details in structured format when employee submits request

### Requirement 5.2
✓ Save flight details including airline, flight number, times, origin, destination, and price

### Requirement 5.3
✓ Save accommodation details including hotel name, address, dates, guests, and price

### Requirement 5.4
✓ Associate travel details with corresponding request record in database

### Requirement 5.5
✓ Generate travel itinerary (data structure ready for frontend display)

## Database Schema

### Column Added
```sql
ALTER TABLE petty_cash_requests
ADD travel_details NVARCHAR(MAX) NULL;
```

**Properties**:
- Column name: `travel_details`
- Data type: `NVARCHAR(MAX)`
- Nullable: Yes
- Stores: JSON string representation of travel details

## Security Considerations

### Input Validation
- All travel details are validated before storage
- JSON parsing errors are caught and handled
- SQL injection prevented through parameterized queries
- No raw user input directly inserted into database

### Data Integrity
- Required fields enforced at application level
- Invalid data rejected before database insertion
- Consistent error messages for validation failures

## Performance Considerations

### Database
- JSON stored as string (NVARCHAR(MAX))
- No additional indexes required
- Minimal impact on existing queries
- Column is nullable (no storage overhead for non-travel requests)

### API
- Validation happens before database insertion
- Parsing only occurs on retrieval (GET endpoint)
- Error handling prevents invalid data from reaching database

## Next Steps

The backend is now ready for frontend integration. The following tasks can proceed:
- Task 5: Create FlightSearch frontend component
- Task 6: Create AccommodationSearch frontend component
- Task 7: Create TravelSummary frontend component
- Task 8: Create TravelBookingSection container component
- Task 9: Integrate TravelBookingSection into NewRequest page
- Task 10: Enhance request review pages to display travel details

## Notes

- The implementation follows the design document specifications
- All validation rules from requirements are implemented
- Backward compatibility is maintained throughout
- Error messages are clear and actionable
- Code is well-documented with comments
