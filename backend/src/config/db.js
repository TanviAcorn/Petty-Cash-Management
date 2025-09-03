const sql = require("mssql");
require("dotenv").config();

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  server: process.env.DB_SERVER,   // must be string (e.g., "localhost")
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT) || 1433,
  options: {
    encrypt: true,              // for local dev
    trustServerCertificate: true // required for self-signed certs
  },
};

const poolPromise = new sql.ConnectionPool(config)
  .connect()
  .then(pool => {
    console.log("✅ MSSQL connected");
    return pool;
  })
  .catch(err => console.log("DB Connection Failed: ", err));

module.exports = { poolPromise };

