/**
 * Restores travel_form_data on a request after test-feedback-email.js mock test.
 * Usage: node restore-travel-data.js
 */
require('dotenv').config();
const fs = require('fs');
const sql = require('mssql');
const { poolPromise } = require('./src/config/db');

const TEST_REQUEST_ID = 245;

async function run() {
  const backupPath = `./travel_form_data_backup_${TEST_REQUEST_ID}.json`;
  if (!fs.existsSync(backupPath)) {
    console.error(`❌ Backup file not found: ${backupPath}`);
    process.exit(1);
  }

  const { id, original } = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

  const pool = await poolPromise;
  await pool.request()
    .input('id', sql.Int, id)
    .input('data', sql.NVarChar(sql.MAX), original)
    .query(`UPDATE petty_cash_requests SET travel_form_data = @data WHERE id = @id`);

  // Also clear the mock admin details
  await pool.request()
    .input('id', sql.Int, id)
    .query(`UPDATE petty_cash_requests SET travel_admin_details = NULL WHERE id = @id`);

  fs.unlinkSync(backupPath);
  console.log(`✅ Restored original travel_form_data on request #${id}`);
  process.exit(0);
}

run().catch(err => { console.error('❌', err.message); process.exit(1); });
