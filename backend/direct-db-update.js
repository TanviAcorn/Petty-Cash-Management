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

async function directUpdate() {
  try {
    console.log('Connecting to database...');
    const pool = await sql.connect(config);
    console.log('Connected!\n');
    
    console.log('=== DIRECT DATABASE UPDATE TEST ===\n');
    
    // Check current state
    console.log('1. Checking current state of user 65...');
    const before = await pool.request()
      .input('id', sql.Int, 65)
      .query('SELECT id, firstName, lastName, l1_manager_id FROM petty_Users WHERE id = @id');
    
    console.log('Before:', before.recordset[0]);
    
    // Update with l1_manager_id = 14
    console.log('\n2. Updating user 65 with l1_manager_id = 14...');
    const update = await pool.request()
      .input('id', sql.Int, 65)
      .input('l1ManagerId', sql.Int, 14)
      .query('UPDATE petty_Users SET l1_manager_id = @l1ManagerId WHERE id = @id');
    
    console.log('Rows affected:', update.rowsAffected[0]);
    
    // Check after update
    console.log('\n3. Checking state after update...');
    const after = await pool.request()
      .input('id', sql.Int, 65)
      .query(`
        SELECT 
          u.id, 
          u.firstName, 
          u.lastName, 
          u.l1_manager_id,
          m.firstName as managerFirstName,
          m.lastName as managerLastName
        FROM petty_Users u
        LEFT JOIN petty_Users m ON u.l1_manager_id = m.id
        WHERE u.id = @id
      `);
    
    const result = after.recordset[0];
    console.log('After:', result);
    
    if (result.l1_manager_id === 14) {
      console.log('\n✅ SUCCESS! Database update works!');
      console.log(`L1 Manager: ${result.managerFirstName} ${result.managerLastName}`);
      console.log('\nThe issue is with your running server - it needs to be restarted.');
    } else {
      console.log('\n❌ FAILED! Database was not updated.');
      console.log('There may be a constraint or permission issue.');
    }
    
    process.exit(0);
  } catch (err) {
    console.error('\n❌ ERROR:', err.message);
    console.error('Stack:', err.stack);
    process.exit(1);
  }
}

directUpdate();
