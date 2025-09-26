const sql = require('mssql');
const { poolPromise } = require('../config/db');

/**
 * Fetches user details by ID from the database
 * @param {number} userId - The ID of the user to fetch
 * @returns {Promise<Object|null>} User details or null if not found
 */
async function getUserById(userId) {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('id', sql.Int, userId)
      .query('SELECT id, email, firstName, lastName, role FROM [dbo].[petty_Users] WHERE id = @id');
    
    return result.recordset[0] || null;
  } catch (error) {
    console.error('Error fetching user by ID:', error);
    throw error;
  }
}

/**
 * Gets the user's email for sending emails
 * @param {Object} user - User object containing email and name
 * @returns {string} Email address to use as sender
 */
function getUserEmail(user) {
  // Return the user's email if available, otherwise fall back to environment variables
  return user?.email || process.env.FROM_EMAIL || process.env.SMTP_USER;
}

module.exports = {
  getUserById,
  getUserEmail
};
