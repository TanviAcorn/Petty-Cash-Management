/**
 * Database Migration Runner
 * Executes SQL migration scripts against the database
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { poolPromise } = require('../config/db');

async function runMigration(migrationFile) {
  try {
    console.log(`\n=== Running Migration: ${migrationFile} ===\n`);
    
    // Read the SQL file
    const sqlFilePath = path.join(__dirname, migrationFile);
    const sqlScript = fs.readFileSync(sqlFilePath, 'utf8');
    
    // Get database connection
    const pool = await poolPromise;
    
    // Execute the migration
    const result = await pool.request().query(sqlScript);
    
    console.log('\n✅ Migration completed successfully!');
    console.log('Result:', result);
    
    return { success: true, result };
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('Error details:', error);
    return { success: false, error };
  }
}

// Run the migration if this file is executed directly
if (require.main === module) {
  const migrationFile = process.argv[2] || 'add_travel_details_column.sql';
  
  runMigration(migrationFile)
    .then(({ success }) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Unexpected error:', error);
      process.exit(1);
    });
}

module.exports = { runMigration };
