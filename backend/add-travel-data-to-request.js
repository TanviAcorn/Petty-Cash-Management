require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const sql = require('mssql');

const config = {
  server: process.env.DB_SERVER,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  options: {
    encrypt: true,
    trustServerCertificate: false
  }
};

async function addTravelData() {
  try {
    console.log('Connecting to database...');
    await sql.connect(config);
    console.log('Connected!\n');
    
    const requestId = 227;
    
    // Sample travel data
    const travelData = {
      travelType: 'international',
      departureDate: '2026-03-15',
      returnDate: '2026-03-20',
      countryOfTravel: 'France',
      cityOfTravel: 'Paris',
      preferredDepartureAirport: 'London Heathrow',
      destinationAirport: 'Charles de Gaulle',
      reasonOfTravel: 'Business meeting with clients',
      requirements: {
        flights: true,
        hotel: true,
        food: true
      }
    };
    
    console.log(`Updating request ${requestId} with travel data...`);
    
    const result = await sql.query`
      UPDATE petty_cash_requests 
      SET travel_form_data = ${JSON.stringify(travelData)},
          is_travel_request = 1
      WHERE id = ${requestId}
    `;
    
    console.log('Rows affected:', result.rowsAffected[0]);
    
    // Verify
    const verify = await sql.query`
      SELECT id, category_name, travel_form_data, is_travel_request
      FROM petty_cash_requests 
      WHERE id = ${requestId}
    `;
    
    if (verify.recordset.length > 0) {
      const request = verify.recordset[0];
      console.log('\n✅ SUCCESS!');
      console.log('Request ID:', request.id);
      console.log('Category:', request.category_name);
      console.log('Is Travel Request:', request.is_travel_request);
      console.log('Travel Data:', request.travel_form_data ? 'Present' : 'NULL');
      
      if (request.travel_form_data) {
        const parsed = JSON.parse(request.travel_form_data);
        console.log('\nTravel Details:');
        console.log('  Type:', parsed.travelType);
        console.log('  Destination:', parsed.cityOfTravel, ',', parsed.countryOfTravel);
        console.log('  Dates:', parsed.departureDate, 'to', parsed.returnDate);
        console.log('  Reason:', parsed.reasonOfTravel);
      }
      
      console.log('\nNow refresh the L1 Approvals page to see the travel details!');
    }
    
    await sql.close();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    await sql.close();
    process.exit(1);
  }
}

addTravelData();
