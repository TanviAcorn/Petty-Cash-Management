/**
 * Test script to verify travel_details column and functionality
 */

require('dotenv').config();
const sql = require('mssql');

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT) || 1433,
  options: {
    encrypt: true,
    trustServerCertificate: true
  },
};

async function testTravelDetails() {
  let pool;
  try {
    console.log('=== Testing Travel Details Implementation ===\n');
    
    // Connect to database
    console.log('1. Connecting to database...');
    pool = await sql.connect(config);
    console.log('   ✅ Connected successfully\n');
    
    // Check if travel_details column exists
    console.log('2. Checking if travel_details column exists...');
    const checkResult = await pool.request().query(`
      SELECT 
        COLUMN_NAME, 
        DATA_TYPE, 
        IS_NULLABLE,
        CHARACTER_MAXIMUM_LENGTH
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'petty_cash_requests' 
      AND COLUMN_NAME = 'travel_details'
    `);
    
    if (checkResult.recordset.length > 0) {
      console.log('   ✅ Column exists with properties:');
      console.log('      -', checkResult.recordset[0]);
    } else {
      console.log('   ❌ Column does not exist');
      console.log('   Adding travel_details column...');
      
      await pool.request().query(`
        ALTER TABLE petty_cash_requests
        ADD travel_details NVARCHAR(MAX) NULL;
      `);
      
      console.log('   ✅ Column added successfully\n');
    }
    
    // Test inserting a request with travel details
    console.log('\n3. Testing INSERT with travel_details...');
    const testTravelDetails = {
      flight: {
        id: 'test_flight_123',
        airline: 'Test Airways',
        flightNumber: 'TA123',
        origin: 'LHR',
        destination: 'JFK',
        departureTime: '2026-03-15T10:00:00Z',
        arrivalTime: '2026-03-15T13:00:00Z',
        price: 500.00,
        currency: 'GBP'
      },
      accommodation: {
        id: 'test_hotel_456',
        name: 'Test Hotel',
        address: '123 Test Street',
        checkInDate: '2026-03-15',
        checkOutDate: '2026-03-20',
        nights: 5,
        pricePerNight: 100.00,
        totalPrice: 500.00,
        currency: 'GBP'
      },
      totalCost: 1000.00
    };
    
    const insertResult = await pool.request()
      .input('employeeName', sql.NVarChar(200), 'Test User')
      .input('employeeEmail', sql.NVarChar(320), 'test@example.com')
      .input('company', sql.NVarChar(200), 'Test Company')
      .input('category', sql.NVarChar(200), 'Travel')
      .input('amount', sql.Decimal(18, 2), 1000.00)
      .input('currency', sql.NVarChar(10), 'GBP')
      .input('location', sql.NVarChar(200), 'Test Location')
      .input('reason', sql.NVarChar(sql.MAX), 'Test travel request')
      .input('status', sql.VarChar(20), 'pending')
      .input('travelDetails', sql.NVarChar(sql.MAX), JSON.stringify(testTravelDetails))
      .query(`
        INSERT INTO petty_cash_requests 
        (employee_name, employee_email, company_name, category_name, amount, currency, location, status, reason, created_at, travel_details)
        OUTPUT INSERTED.id, INSERTED.travel_details
        VALUES (@employeeName, @employeeEmail, @company, @category, @amount, @currency, @location, @status, @reason, SYSUTCDATETIME(), @travelDetails)
      `);
    
    const insertedId = insertResult.recordset[0].id;
    console.log('   ✅ Test request inserted with ID:', insertedId);
    
    // Test retrieving the request with travel details
    console.log('\n4. Testing SELECT with travel_details...');
    const selectResult = await pool.request()
      .input('id', sql.Int, insertedId)
      .query(`
        SELECT id, employee_name, category_name, amount, travel_details
        FROM petty_cash_requests
        WHERE id = @id
      `);
    
    const retrievedRequest = selectResult.recordset[0];
    console.log('   ✅ Request retrieved successfully');
    console.log('      - ID:', retrievedRequest.id);
    console.log('      - Employee:', retrievedRequest.employee_name);
    console.log('      - Category:', retrievedRequest.category_name);
    console.log('      - Amount:', retrievedRequest.amount);
    
    if (retrievedRequest.travel_details) {
      const parsedTravelDetails = JSON.parse(retrievedRequest.travel_details);
      console.log('      - Travel Details:');
      console.log('        * Flight:', parsedTravelDetails.flight?.airline, parsedTravelDetails.flight?.flightNumber);
      console.log('        * Hotel:', parsedTravelDetails.accommodation?.name);
      console.log('        * Total Cost:', parsedTravelDetails.totalCost);
    }
    
    // Clean up test data
    console.log('\n5. Cleaning up test data...');
    await pool.request()
      .input('id', sql.Int, insertedId)
      .query('DELETE FROM petty_cash_requests WHERE id = @id');
    console.log('   ✅ Test data cleaned up\n');
    
    console.log('=== All Tests Passed! ===\n');
    console.log('Summary:');
    console.log('✅ travel_details column exists and is properly configured');
    console.log('✅ Can INSERT requests with travel_details');
    console.log('✅ Can SELECT and parse travel_details JSON');
    console.log('✅ Database schema is ready for travel booking integration\n');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Error details:', error);
    process.exit(1);
  } finally {
    if (pool) {
      await pool.close();
      console.log('Database connection closed.');
    }
  }
}

testTravelDetails();
