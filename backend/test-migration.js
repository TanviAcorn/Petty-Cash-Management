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

async function testMigration() {
  try {
    console.log('Connecting to database...');
    const pool = await sql.connect(config);
    console.log('✅ Connected to database');
    
    // Check if column exists
    console.log('\nChecking if travel_details column exists...');
    const checkResult = await pool.request().query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'petty_cash_requests' 
      AND COLUMN_NAME = 'travel_details'
    `);
    
    if (checkResult.recordset.length > 0) {
      console.log('✅ Column travel_details already exists');
    } else {
      console.log('❌ Column travel_details does not exist');
      console.log('\nAdding travel_details column...');
      
      await pool.request().query(`
        ALTER TABLE petty_cash_requests
        ADD travel_details NVARCHAR(MAX) NULL;
      `);
      
      console.log('✅ Successfully added travel_details column');
    }
    
    // Verify the column was added
    console.log('\nVerifying column...');
    const verifyResult = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'petty_cash_requests' 
      AND COLUMN_NAME = 'travel_details'
    `);
    
    if (verifyResult.recordset.length > 0) {
      console.log('✅ Column verified:');
      console.log(verifyResult.recordset[0]);
    }
    
    await pool.close();
    console.log('\n✅ Migration completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
  }
}

testMigration();
