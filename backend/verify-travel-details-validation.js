// Verification script for travel details validation logic
// This tests the validation logic without requiring a running server

console.log('=== Travel Details Validation Logic Verification ===\n');

// Simulate the validation logic from the POST endpoint
function validateTravelDetails(travelDetails) {
  if (!travelDetails) {
    return { valid: true, message: 'No travel details provided' };
  }

  try {
    // If travelDetails is a string, parse it first to validate JSON
    const travelDetailsObj = typeof travelDetails === 'string' 
      ? JSON.parse(travelDetails) 
      : travelDetails;
    
    // Validate travel details structure
    if (travelDetailsObj && typeof travelDetailsObj === 'object') {
      // Check if it has at least one of flight or accommodation
      const hasValidStructure = 
        (travelDetailsObj.flight && typeof travelDetailsObj.flight === 'object') ||
        (travelDetailsObj.accommodation && typeof travelDetailsObj.accommodation === 'object');
      
      if (!hasValidStructure) {
        return { 
          valid: false, 
          message: 'Invalid travel details structure. Must contain at least flight or accommodation data.' 
        };
      }
      
      // Validate flight structure if present
      if (travelDetailsObj.flight) {
        const flight = travelDetailsObj.flight;
        const requiredFlightFields = ['airline', 'origin', 'destination', 'departureTime', 'price'];
        const missingFlightFields = requiredFlightFields.filter(field => !flight[field]);
        
        if (missingFlightFields.length > 0) {
          return { 
            valid: false, 
            message: `Invalid flight data. Missing required fields: ${missingFlightFields.join(', ')}` 
          };
        }
      }
      
      // Validate accommodation structure if present
      if (travelDetailsObj.accommodation) {
        const accommodation = travelDetailsObj.accommodation;
        const requiredAccommodationFields = ['name', 'checkInDate', 'checkOutDate', 'totalPrice'];
        const missingAccommodationFields = requiredAccommodationFields.filter(field => !accommodation[field]);
        
        if (missingAccommodationFields.length > 0) {
          return { 
            valid: false, 
            message: `Invalid accommodation data. Missing required fields: ${missingAccommodationFields.join(', ')}` 
          };
        }
      }
    }
    
    return { valid: true, message: 'Valid travel details' };
  } catch (e) {
    return { valid: false, message: 'Invalid travel details format. Must be valid JSON.' };
  }
}

// Test cases
const testCases = [
  {
    name: 'Valid travel details with flight and accommodation',
    input: {
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
      }
    },
    expectedValid: true
  },
  {
    name: 'Valid travel details with only flight',
    input: {
      flight: {
        airline: 'British Airways',
        origin: 'LHR',
        destination: 'JFK',
        departureTime: '2026-03-15T10:30:00Z',
        price: 450.00
      }
    },
    expectedValid: true
  },
  {
    name: 'Valid travel details with only accommodation',
    input: {
      accommodation: {
        name: 'Marriott Marquis',
        checkInDate: '2026-03-15',
        checkOutDate: '2026-03-22',
        totalPrice: 1400.00
      }
    },
    expectedValid: true
  },
  {
    name: 'Invalid - empty object',
    input: {},
    expectedValid: false
  },
  {
    name: 'Invalid - missing required flight fields',
    input: {
      flight: {
        airline: 'British Airways'
        // Missing: origin, destination, departureTime, price
      }
    },
    expectedValid: false
  },
  {
    name: 'Invalid - missing required accommodation fields',
    input: {
      accommodation: {
        name: 'Marriott Marquis'
        // Missing: checkInDate, checkOutDate, totalPrice
      }
    },
    expectedValid: false
  },
  {
    name: 'Invalid - invalid JSON string',
    input: 'invalid json',
    expectedValid: false
  },
  {
    name: 'Valid - null travel details',
    input: null,
    expectedValid: true
  },
  {
    name: 'Valid - undefined travel details',
    input: undefined,
    expectedValid: true
  }
];

// Run tests
let passed = 0;
let failed = 0;

testCases.forEach((testCase, index) => {
  console.log(`Test ${index + 1}: ${testCase.name}`);
  const result = validateTravelDetails(testCase.input);
  
  if (result.valid === testCase.expectedValid) {
    console.log(`  ✓ PASSED - ${result.message}`);
    passed++;
  } else {
    console.log(`  ✗ FAILED - Expected valid=${testCase.expectedValid}, got valid=${result.valid}`);
    console.log(`    Message: ${result.message}`);
    failed++;
  }
  console.log();
});

console.log('=== Summary ===');
console.log(`Total tests: ${testCases.length}`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed === 0) {
  console.log('\n✓ All validation tests passed!');
  process.exit(0);
} else {
  console.log('\n✗ Some tests failed');
  process.exit(1);
}
