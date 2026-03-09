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
    await sql.connect(config);
    
    const travelData = {
      travelType: 'international',
      departureDate: '2026-03-08',
      returnDate: '2026-03-15',
      countryOfTravel: 'Germany',
      cityOfTravel: 'Berlin',
      preferredDepartureAirport: 'London Heathrow',
      destinationAirport: 'Berlin Brandenburg',
      nationality: 'Indian',
      visaType: 'Business',
      lengthOfVisa: '90',
      numberOfDays: '7',
      reasonOfTravel: 'to meet a friend',
      requirements: {
        flights: true,
        hotel: true,
        food: true
      }
    };
    
    await sql.query`
      UPDATE petty_cash_requests 
      SET travel_details = ${JSON.stringify(travelData)},
          is_travel_request = 1
      WHERE id = 226
    `;
    
    console.log('✅ Travel data added to request 226');
    console.log('Refresh the L1 Approvals page to see the details!');
    
    await sql.close();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    await sql.close();
    process.exit(1);
  }
}

addTravelData();
