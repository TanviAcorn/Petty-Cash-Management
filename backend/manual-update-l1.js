require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const sql = require('mssql');
const readline = require('readline');

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

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function updateL1Manager() {
  try {
    console.log('Connecting to database...\n');
    await sql.connect(config);
    console.log('Connected!\n');
    
    rl.question('Enter User ID to update: ', async (userId) => {
      rl.question('Enter L1 Manager ID (or leave empty for NULL): ', async (managerId) => {
        try {
          const userIdInt = parseInt(userId, 10);
          const managerIdInt = managerId.trim() === '' ? null : parseInt(managerId, 10);
          
          console.log(`\nUpdating user ${userIdInt} with L1 Manager ${managerIdInt}...`);
          
          const result = await sql.query`
            UPDATE petty_Users 
            SET l1_manager_id = ${managerIdInt}
            WHERE id = ${userIdInt}
          `;
          
          console.log('Rows affected:', result.rowsAffected[0]);
          
          // Verify
          const verify = await sql.query`
            SELECT 
              u.id, 
              u.firstName, 
              u.lastName, 
              u.l1_manager_id,
              m.firstName as managerFirstName,
              m.lastName as managerLastName
            FROM petty_Users u
            LEFT JOIN petty_Users m ON u.l1_manager_id = m.id
            WHERE u.id = ${userIdInt}
          `;
          
          if (verify.recordset.length > 0) {
            const user = verify.recordset[0];
            console.log('\n✅ SUCCESS!');
            console.log('User:', `${user.firstName} ${user.lastName}`);
            console.log('L1 Manager ID:', user.l1_manager_id);
            console.log('L1 Manager Name:', user.managerFirstName && user.managerLastName 
              ? `${user.managerFirstName} ${user.managerLastName}` 
              : 'Not assigned');
            console.log('\nNow refresh your browser to see the changes.');
          }
          
          await sql.close();
          rl.close();
          process.exit(0);
        } catch (err) {
          console.error('Error:', err.message);
          await sql.close();
          rl.close();
          process.exit(1);
        }
      });
    });
    
  } catch (err) {
    console.error('Connection error:', err.message);
    process.exit(1);
  }
}

updateL1Manager();
