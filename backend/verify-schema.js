const { poolPromise } = require('./src/config/db');

async function verifySchema() {
  try {
    const pool = await poolPromise;
    
    // Ensure travel_details column exists
    await pool.request().query(`
      IF COL_LENGTH('dbo.petty_cash_requests', 'travel_details') IS NULL
      BEGIN
        ALTER TABLE dbo.petty_cash_requests ADD travel_details NVARCHAR(MAX) NULL;
        PRINT 'Added travel_details column';
      END
      ELSE
      BEGIN
        PRINT 'travel_details column already exists';
      END
    `);
    
    // Verify column exists
    const result = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'petty_cash_requests' 
      AND COLUMN_NAME = 'travel_details'
    `);
    
    if (result.recordset.length > 0) {
      console.log('SUCCESS: travel_details column verified');
      console.log(result.recordset[0]);
      process.exit(0);
    } else {
      console.log('ERROR: Column not found');
      process.exit(1);
    }
  } catch (error) {
    console.error('ERROR:', error.message);
    process.exit(1);
  }
}

verifySchema();
