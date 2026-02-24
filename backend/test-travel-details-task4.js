const axios = require('axios');
const FormData = require('form-data');

const API_BASE_URL = 'http://localhost:5000/api';

// Test data
const testTravelDetails = {
  flight: {
    id: 'flight_test_123',
    airline: 'British Airways',
    flightNumber: 'BA117',
    origin: 'LHR',
    destination: 'JFK',
    departureTime: '2026-03-15T10:30:00Z',
    arrivalTime: '2026-03-15T13:45:00Z',
    duration: '7h 15m',
    stops: 0,
    price: 450.00,
    currency: 'GBP'
  },
  accommodation: {
    id: 'hotel_test_456',
    name: 'Marriott Marquis',
    address: '1535 Broadway, New York, NY 10036',
    checkInDate: '2026-03-15',
    checkOutDate: '2026-03-22',
    nights: 7,
    pricePerNight: 200.00,
    totalPrice: 1400.00,
    currency: 'GBP'
  },
  totalCost: 1850.00
};

async function testCreateRequestWithTravelDetails() {
  console.log('\n=== Test 1: Create request with travel details ===');
  try {
    const formData = new FormData();
    formData.append('employeeName', 'John Doe');
    formData.append('employeeEmail', 'john.doe@example.com');
    formData.append('company', 'Acorn Universal');
    formData.append('category', 'Travel');
    formData.append('location', 'London Office');
    formData.append('amount', '1850.00');
    formData.append('currency', 'GBP');
    formData.append('dateOfPurchase', '2026-03-15');
    formData.append('description', 'Business trip to New York');
    formData.append('travelDetails', JSON.stringify(testTravelDetails));

    const response = await axios.post(`${API_BASE_URL}/requests`, formData, {
      headers: formData.getHeaders()
    });

    console.log('✓ Request created successfully');
    console.log('Request ID:', response.data.id);
    console.log('Travel details stored:', response.data.travel_details ? 'Yes' : 'No');
    
    return response.data.id;
  } catch (error) {
    console.error('✗ Failed to create request:', error.response?.data || error.message);
    throw error;
  }
}

async function testGetRequestWithTravelDetails(requestId) {
  console.log('\n=== Test 2: Get request with parsed travel details ===');
  try {
    const response = await axios.get(`${API_BASE_URL}/requests/${requestId}`);
    const request = response.data.data;

    console.log('✓ Request retrieved successfully');
    console.log('Request ID:', request.id);
    console.log('Has travel details:', request.travelDetails ? 'Yes' : 'No');
    
    if (request.travelDetails) {
      console.log('Travel details is object:', typeof request.travelDetails === 'object');
      console.log('Has flight:', !!request.travelDetails.flight);
      console.log('Has accommodation:', !!request.travelDetails.accommodation);
      console.log('Flight airline:', request.travelDetails.flight?.airline);
      console.log('Accommodation name:', request.travelDetails.accommodation?.name);
      console.log('Total cost:', request.travelDetails.totalCost);
    }
    
    return request;
  } catch (error) {
    console.error('✗ Failed to get request:', error.response?.data || error.message);
    throw error;
  }
}

async function testUpdateRequestWithTravelDetails(requestId) {
  console.log('\n=== Test 3: Update request with modified travel details ===');
  try {
    const updatedTravelDetails = {
      ...testTravelDetails,
      flight: {
        ...testTravelDetails.flight,
        airline: 'Virgin Atlantic',
        flightNumber: 'VS123'
      },
      totalCost: 1900.00
    };

    const response = await axios.put(`${API_BASE_URL}/requests/${requestId}`, {
      amount: 1900.00,
      travelDetails: updatedTravelDetails
    });

    console.log('✓ Request updated successfully');
    
    // Verify the update
    const getResponse = await axios.get(`${API_BASE_URL}/requests/${requestId}`);
    const request = getResponse.data.data;
    
    console.log('Updated airline:', request.travelDetails?.flight?.airline);
    console.log('Updated total cost:', request.travelDetails?.totalCost);
    
    return request;
  } catch (error) {
    console.error('✗ Failed to update request:', error.response?.data || error.message);
    throw error;
  }
}

async function testCreateRequestWithoutTravelDetails() {
  console.log('\n=== Test 4: Create request without travel details (backward compatibility) ===');
  try {
    const formData = new FormData();
    formData.append('employeeName', 'Jane Smith');
    formData.append('employeeEmail', 'jane.smith@example.com');
    formData.append('company', 'Acorn Universal');
    formData.append('category', 'Office Supplies');
    formData.append('location', 'London Office');
    formData.append('amount', '50.00');
    formData.append('currency', 'GBP');
    formData.append('dateOfPurchase', '2026-02-06');
    formData.append('description', 'Office supplies purchase');

    const response = await axios.post(`${API_BASE_URL}/requests`, formData, {
      headers: formData.getHeaders()
    });

    console.log('✓ Request created successfully without travel details');
    console.log('Request ID:', response.data.id);
    
    // Verify it can be retrieved
    const getResponse = await axios.get(`${API_BASE_URL}/requests/${response.data.id}`);
    const request = getResponse.data.data;
    
    console.log('Travel details is null:', request.travelDetails === null);
    
    return response.data.id;
  } catch (error) {
    console.error('✗ Failed to create request:', error.response?.data || error.message);
    throw error;
  }
}

async function testInvalidTravelDetails() {
  console.log('\n=== Test 5: Validate travel details structure ===');
  
  // Test 5a: Invalid JSON
  console.log('\nTest 5a: Invalid JSON format');
  try {
    const formData = new FormData();
    formData.append('employeeName', 'Test User');
    formData.append('employeeEmail', 'test@example.com');
    formData.append('category', 'Travel');
    formData.append('amount', '100.00');
    formData.append('currency', 'GBP');
    formData.append('travelDetails', 'invalid json');

    await axios.post(`${API_BASE_URL}/requests`, formData, {
      headers: formData.getHeaders()
    });
    
    console.error('✗ Should have rejected invalid JSON');
  } catch (error) {
    if (error.response?.status === 400) {
      console.log('✓ Correctly rejected invalid JSON:', error.response.data.message);
    } else {
      console.error('✗ Unexpected error:', error.message);
    }
  }
  
  // Test 5b: Missing required flight fields
  console.log('\nTest 5b: Missing required flight fields');
  try {
    const formData = new FormData();
    formData.append('employeeName', 'Test User');
    formData.append('employeeEmail', 'test@example.com');
    formData.append('category', 'Travel');
    formData.append('amount', '100.00');
    formData.append('currency', 'GBP');
    formData.append('travelDetails', JSON.stringify({
      flight: {
        airline: 'Test Airlines'
        // Missing required fields: origin, destination, departureTime, price
      }
    }));

    await axios.post(`${API_BASE_URL}/requests`, formData, {
      headers: formData.getHeaders()
    });
    
    console.error('✗ Should have rejected incomplete flight data');
  } catch (error) {
    if (error.response?.status === 400) {
      console.log('✓ Correctly rejected incomplete flight data:', error.response.data.message);
    } else {
      console.error('✗ Unexpected error:', error.message);
    }
  }
  
  // Test 5c: Missing required accommodation fields
  console.log('\nTest 5c: Missing required accommodation fields');
  try {
    const formData = new FormData();
    formData.append('employeeName', 'Test User');
    formData.append('employeeEmail', 'test@example.com');
    formData.append('category', 'Travel');
    formData.append('amount', '100.00');
    formData.append('currency', 'GBP');
    formData.append('travelDetails', JSON.stringify({
      accommodation: {
        name: 'Test Hotel'
        // Missing required fields: checkInDate, checkOutDate, totalPrice
      }
    }));

    await axios.post(`${API_BASE_URL}/requests`, formData, {
      headers: formData.getHeaders()
    });
    
    console.error('✗ Should have rejected incomplete accommodation data');
  } catch (error) {
    if (error.response?.status === 400) {
      console.log('✓ Correctly rejected incomplete accommodation data:', error.response.data.message);
    } else {
      console.error('✗ Unexpected error:', error.message);
    }
  }
  
  // Test 5d: Empty travel details object
  console.log('\nTest 5d: Empty travel details object');
  try {
    const formData = new FormData();
    formData.append('employeeName', 'Test User');
    formData.append('employeeEmail', 'test@example.com');
    formData.append('category', 'Travel');
    formData.append('amount', '100.00');
    formData.append('currency', 'GBP');
    formData.append('travelDetails', JSON.stringify({}));

    await axios.post(`${API_BASE_URL}/requests`, formData, {
      headers: formData.getHeaders()
    });
    
    console.error('✗ Should have rejected empty travel details');
  } catch (error) {
    if (error.response?.status === 400) {
      console.log('✓ Correctly rejected empty travel details:', error.response.data.message);
    } else {
      console.error('✗ Unexpected error:', error.message);
    }
  }
}

async function runTests() {
  console.log('Starting Travel Details Task 4 Tests...');
  console.log('Make sure the backend server is running on port 5000');
  
  try {
    // Test 1: Create request with travel details
    const requestId = await testCreateRequestWithTravelDetails();
    
    // Test 2: Get request and verify travel details are parsed
    await testGetRequestWithTravelDetails(requestId);
    
    // Test 3: Update request with modified travel details
    await testUpdateRequestWithTravelDetails(requestId);
    
    // Test 4: Create request without travel details (backward compatibility)
    await testCreateRequestWithoutTravelDetails();
    
    // Test 5: Validate travel details structure
    await testInvalidTravelDetails();
    
    console.log('\n=== All tests completed ===');
  } catch (error) {
    console.error('\n=== Tests failed ===');
    process.exit(1);
  }
}

runTests();
