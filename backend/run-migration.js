const sql = require('mssql');
const { poolPromise } = require('./src/config/db');
const fs = require('fs');

(async () => {
  try {
    const pool = await poolPromise;
    const migration = fs.readFileSync('./src/migrations/add_l1_manager_and_travel_fields.sql', 'utf8');
    await pool.request().query(migration);
    console.log('✅ Migration completed successfully');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
})();
