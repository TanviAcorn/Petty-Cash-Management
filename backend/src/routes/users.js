const express = require("express");
const router = express.Router();
const { poolPromise } = require("../config/db");
const sql = require('mssql');

// POST /api/users/login (authenticate user)
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const pool = await poolPromise;
    const userByEmail = await pool
      .request()
      .input("email", String(email))
      .query(`
        SELECT *
        FROM petty_Users
        WHERE LOWER(LTRIM(RTRIM(email))) = LOWER(LTRIM(RTRIM(@email)))
      `);

    if (!userByEmail.recordset || userByEmail.recordset.length === 0) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const u = userByEmail.recordset[0];
    
    // For development: Log the password comparison
    console.log('Stored password:', u.password);
    console.log('Provided password:', password);
    
    const pwdOk = String(u.password || "").trim() === String(password).trim();
    
    if (!pwdOk) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    
    // Generate a simple token
    const token = `token-${u.id}-${Date.now()}`;
    
    // Prepare user data for response
    const userData = {
      id: u.id,
      firstName: u.firstName || '',
      lastName: u.lastName || '',
      name: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email.split('@')[0],
      email: u.email,
      role: u.role || 'User',
      company: u.company || '',
      department: u.department || ''
    };

    return res.json({
      token,
      user: userData
    });
  } catch (err) {
    console.error("Login error:", err?.message || err);
    res.status(500).json({ message: "Server error during login" });
  }
});

// GET /api/users/me - get current user profile
router.get("/me", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Extract user ID from token (assuming token format is 'token-{userId}-{timestamp}')
    const userId = token.split('-')[1];
    if (!userId) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    const pool = await poolPromise;
    const result = await pool
      .request()
      .input('id', userId)
      .query('SELECT * FROM petty_Users WHERE id = @id');

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = result.recordset[0];
    // Don't send password back
    const { password, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (err) {
    console.error('Error fetching user profile:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/users/change-password - change user password
router.put("/change-password", async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new password are required' });
    }

    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Extract user ID from token
    const userId = token.split('-')[1];
    if (!userId) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    const pool = await poolPromise;
    
    // First get the user to verify current password
    const userResult = await pool
      .request()
      .input('id', userId)
      .query('SELECT password FROM petty_Users WHERE id = @id');

    if (userResult.recordset.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = userResult.recordset[0];
    
    // Verify current password
    if (user.password !== currentPassword) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    // Update password
    await pool
      .request()
      .input('id', userId)
      .input('password', newPassword)
      .query('UPDATE petty_Users SET password = @password WHERE id = @id');

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('Error changing password:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/users - all users
router.get("/", async (req, res) => {
  const { page = 1, limit = 10, search } = req.query;
  
  // Convert pagination parameters to numbers
  const currentPage = parseInt(page, 10);
  const itemsPerPage = parseInt(limit, 10);
  const offset = (currentPage - 1) * itemsPerPage;

  // Build WHERE clause for search
  let whereClause = "";
  const params = {};
  
  if (search) {
    whereClause = "WHERE (LOWER(firstName) LIKE @search OR LOWER(lastName) LIKE @search OR LOWER(email) LIKE @search OR LOWER(company) LIKE @search OR LOWER(role) LIKE @search)";
    params.search = `%${search.toLowerCase()}%`;
  }

  try {
    const pool = await poolPromise;
    
    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM petty_Users ${whereClause}`;
    const countRequest = pool.request();
    if (search) {
      countRequest.input('search', sql.NVarChar, params.search);
    }
    const countResult = await countRequest.query(countQuery);
    const totalItems = countResult.recordset[0].total;
    
    // Get paginated data
    const dataQuery = `
      SELECT * FROM petty_Users 
      ${whereClause}
      ORDER BY id
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `;
    
    const dataRequest = pool.request();
    if (search) {
      dataRequest.input('search', sql.NVarChar, params.search);
    }
    dataRequest.input('offset', sql.Int, offset);
    dataRequest.input('limit', sql.Int, itemsPerPage);
    const result = await dataRequest.query(dataQuery);

    // Map to expected structure for frontend
    const users = result.recordset.map((u) => ({
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email.split('@')[0],
      email: u.email,
      role: u.role || 'User',
      company: u.company || '',
      department: u.department || '',
      createdAt: u.createdAt || u.created_at,
      updatedAt: u.updatedAt || u.updated_at
    }));

    const totalPages = Math.ceil(totalItems / itemsPerPage);

    res.json({
      data: users,
      pagination: {
        currentPage,
        itemsPerPage,
        totalItems,
        totalPages,
        hasNextPage: currentPage < totalPages,
        hasPreviousPage: currentPage > 1
      }
    });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// POST /api/users - create user
router.post("/", async (req, res) => {
  try {
    const { firstName, lastName, email, password, role, company, department } = req.body;
    const pool = await poolPromise;
    await pool
      .request()
      .input("firstName", firstName)
      .input("lastName", lastName)
      .input("email", email)
      .input("password", password)
      .input("role", role)
      .input("company", company)
      .input("department", department)
      .query(
        `INSERT INTO petty_Users (firstName, lastName, email, password, role, company, department)
         VALUES (@firstName, @lastName, @email, @password, @role, @company, @department)`
      );
    res.status(201).send("User created");
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// PUT /api/users/:id - update user (keeps old password if none provided)
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, email, password, role, company, department } = req.body;
    const pool = await poolPromise;
    await pool
      .request()
      .input("id", id)
      .input("firstName", firstName)
      .input("lastName", lastName)
      .input("email", email)
      .input("password", password ?? null)
      .input("role", role)
      .input("company", company)
      .input("department", department)
      .query(
        `UPDATE petty_Users
         SET firstName = @firstName,
             lastName = @lastName,
             email = @email,
             password = CASE WHEN @password IS NULL OR LTRIM(RTRIM(@password)) = '' THEN password ELSE @password END,
             role = @role,
             company = @company,
             department = @department
         WHERE id = @id`
      );
    res.send("User updated");
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// DELETE /api/users/:id - delete user
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await poolPromise;
    await pool.request().input("id", id).query("DELETE FROM petty_Users WHERE id = @id");
    res.send("User deleted");
  } catch (err) {
    res.status(500).send(err.message);
  }
});

module.exports = router;
