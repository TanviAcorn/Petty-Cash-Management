# Task 4 Quick Reference: Travel Details API

## Endpoints Modified

### 1. POST /api/requests
**Purpose**: Create new request with optional travel details

**New Parameter**:
- `travelDetails` (optional): JSON string or object

**Example Request**:
```javascript
const formData = new FormData();
formData.append('employeeName', 'John Doe');
formData.append('employeeEmail', 'john@example.com');
formData.append('category', 'Travel');
formData.append('amount', '1850.00');
formData.append('currency', 'GBP');
formData.append('travelDetails', JSON.stringify({
  flight: {
    airline: 'British Airways',
    origin: 'LHR',
    destination: 'JFK',
    departureTime: '2026-03-15T10:30:00Z',
    price: 450.00
  },
  accommodation: {
    name: 'Marriott Marquis',
    checkInDate: '2026-03-15',
    checkOutDate: '2026-03-22',
    totalPrice: 1400.00
  },
  totalCost: 1850.00
}));
```

**Validation**:
- Must contain at least `flight` OR `accommodation`
- Flight requires: `airline`, `origin`, `destination`, `departureTime`, `price`
- Accommodation requires: `name`, `checkInDate`, `checkOutDate`, `totalPrice`

---

### 2. GET /api/requests/:id
**Purpose**: Retrieve request with parsed travel details

**Response Change**:
```javascript
{
  data: {
    id: 123,
    employeeName: 'John Doe',
    // ... other fields
    travelDetails: {  // ← Automatically parsed from JSON
      flight: { ... },
      accommodation: { ... },
      totalCost: 1850.00
    }
  }
}
```

**Note**: `travelDetails` is `null` for requests without travel data

---

### 3. PUT /api/requests/:id
**Purpose**: Update request including travel details

**New Parameter**:
- `travelDetails` (optional): JSON object or null

**Example Request**:
```javascript
await axios.put('/api/requests/123', {
  amount: 1900.00,
  travelDetails: {
    flight: { ... },
    accommodation: { ... },
    totalCost: 1900.00
  }
});
```

**To Clear Travel Details**:
```javascript
await axios.put('/api/requests/123', {
  travelDetails: null
});
```

---

## Error Responses

### Invalid JSON Format
```json
{
  "message": "Invalid travel details format. Must be valid JSON."
}
```

### Missing Required Fields
```json
{
  "message": "Invalid flight data. Missing required fields: origin, destination, price"
}
```

### Empty Travel Details
```json
{
  "message": "Invalid travel details structure. Must contain at least flight or accommodation data."
}
```

---

## Database

### Column Added
```sql
travel_details NVARCHAR(MAX) NULL
```

### Auto-Migration
The column is automatically created if it doesn't exist when:
- Creating a new request
- Updating a request

---

## Backward Compatibility

✓ Existing requests without travel details work normally
✓ New requests can omit travel details
✓ GET returns `travelDetails: null` for old requests
✓ No breaking changes to existing API

---

## Testing

### Manual Test (with curl)
```bash
# Create request with travel details
curl -X POST http://localhost:5000/api/requests \
  -F "employeeName=John Doe" \
  -F "employeeEmail=john@example.com" \
  -F "category=Travel" \
  -F "amount=1850.00" \
  -F "currency=GBP" \
  -F 'travelDetails={"flight":{"airline":"BA","origin":"LHR","destination":"JFK","departureTime":"2026-03-15T10:30:00Z","price":450},"totalCost":1850}'

# Get request
curl http://localhost:5000/api/requests/123

# Update request
curl -X PUT http://localhost:5000/api/requests/123 \
  -H "Content-Type: application/json" \
  -d '{"amount":1900,"travelDetails":{"flight":{...},"totalCost":1900}}'
```

### Automated Tests
```bash
# Run validation tests
node backend/verify-travel-details-validation.js

# Run integration tests (requires server running)
node backend/test-travel-details-task4.js
```

---

## Common Issues

### Issue: "Invalid travel details format"
**Cause**: Malformed JSON string
**Solution**: Ensure travelDetails is valid JSON

### Issue: "Missing required fields"
**Cause**: Flight or accommodation missing required properties
**Solution**: Include all required fields per validation rules

### Issue: "Must contain at least flight or accommodation"
**Cause**: Empty object `{}` passed as travelDetails
**Solution**: Include at least one of flight or accommodation, or omit travelDetails entirely

---

## Next Steps for Frontend

1. Update request creation form to collect travel details
2. Call POST /api/requests with travelDetails parameter
3. Display parsed travelDetails from GET /api/requests/:id
4. Allow editing travelDetails via PUT /api/requests/:id

See tasks 5-10 in the implementation plan for frontend components.
