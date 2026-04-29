const sql = require("mssql");
require("dotenv").config();

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT) || 1433,
  connectionTimeout: 15000,   // 15s to establish connection (was unlimited)
  requestTimeout: 30000,      // 30s per query (was unlimited)
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
  options: {
    encrypt: true,
    trustServerCertificate: true,
  },
};

const poolPromise = new sql.ConnectionPool(config)
  .connect()
  .then(pool => {
    console.log("✅ MSSQL connected");
    return pool;
  })
  .catch(err => {
    console.error("❌ DB Connection Failed:", err.message);
    // Return null so the server still starts; routes will return 503 if pool is null
    return null;
  });

module.exports = { poolPromise };

