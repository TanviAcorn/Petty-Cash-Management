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

// GET /api/users/passport-info - get logged-in user's passport & nationality data
router.get("/passport-info", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Authentication required' });
    const userId = token.split('-')[1];
    if (!userId) return res.status(401).json({ message: 'Invalid token' });

    const pool = await poolPromise;

    // Ensure passport columns exist
    await pool.request().query(`
      IF COL_LENGTH('dbo.petty_Users', 'passport_number') IS NULL
        ALTER TABLE dbo.petty_Users ADD passport_number NVARCHAR(50) NULL;
      IF COL_LENGTH('dbo.petty_Users', 'nationality') IS NULL
        ALTER TABLE dbo.petty_Users ADD nationality NVARCHAR(100) NULL;
      IF COL_LENGTH('dbo.petty_Users', 'passport_expiry') IS NULL
        ALTER TABLE dbo.petty_Users ADD passport_expiry DATE NULL;
      IF COL_LENGTH('dbo.petty_Users', 'passport_name') IS NULL
        ALTER TABLE dbo.petty_Users ADD passport_name NVARCHAR(200) NULL;
      IF COL_LENGTH('dbo.petty_Users', 'passport_issue_date') IS NULL
        ALTER TABLE dbo.petty_Users ADD passport_issue_date DATE NULL;
    `);

    const result = await pool.request()
      .input('id', sql.Int, parseInt(userId))
      .query('SELECT passport_number, nationality, passport_expiry, passport_name, passport_issue_date FROM petty_Users WHERE id = @id');

    if (result.recordset.length === 0) return res.status(404).json({ message: 'User not found' });

    res.json(result.recordset[0]);
  } catch (err) {
    console.error('passport-info GET error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/users/passport-info - update logged-in user's passport data
router.put("/passport-info", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Authentication required' });
    const userId = token.split('-')[1];
    if (!userId) return res.status(401).json({ message: 'Invalid token' });

    const { passport_number, nationality, passport_expiry, passport_name, passport_issue_date } = req.body;
    const pool = await poolPromise;

    await pool.request()
      .input('id', sql.Int, parseInt(userId))
      .input('passport_number', sql.NVarChar(50), passport_number || null)
      .input('nationality', sql.NVarChar(100), nationality || null)
      .input('passport_expiry', sql.Date, passport_expiry ? new Date(passport_expiry) : null)
      .input('passport_name', sql.NVarChar(200), passport_name || null)
      .input('passport_issue_date', sql.Date, passport_issue_date ? new Date(passport_issue_date) : null)
      .query(`UPDATE petty_Users SET passport_number = @passport_number, nationality = @nationality, passport_expiry = @passport_expiry, passport_name = @passport_name, passport_issue_date = @passport_issue_date WHERE id = @id`);

    res.json({ message: 'Passport info updated' });
  } catch (err) {
    console.error('passport-info PUT error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});
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

// GET /api/users/managers - get all users who can be L1 managers
router.get("/managers", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT id, firstName, lastName, email, role, company, department
      FROM petty_Users
      ORDER BY firstName, lastName
    `);

    const managers = result.recordset.map((u) => ({
      id: u.id,
      name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email.split('@')[0],
      email: u.email,
      role: u.role,
      company: u.company,
      department: u.department
    }));

    res.json(managers);
  } catch (err) {
    console.error('Error fetching managers:', err);
    res.status(500).json({ message: 'Failed to fetch managers' });
  }
});

// GET /api/users - all users
router.get("/", async (req, res) => {
  const { page = 1, limit = 10, search } = req.query;
  
  // Convert pagination parameters to numbers
  const currentPage = parseInt(page, 10);
  const itemsPerPage = parseInt(limit, 10);
  const offset = (currentPage - 1) * itemsPerPage;

  // Build WHERE clause for search — two versions: one for count (no alias), one for data query (u. alias)
  let whereClause = "";
  let whereClauseAliased = "";
  const params = {};
  
  if (search) {
    whereClause = "WHERE (LOWER(firstName) LIKE @search OR LOWER(lastName) LIKE @search OR LOWER(email) LIKE @search OR LOWER(company) LIKE @search OR LOWER(role) LIKE @search)";
    whereClauseAliased = "WHERE (LOWER(u.firstName) LIKE @search OR LOWER(u.lastName) LIKE @search OR LOWER(u.email) LIKE @search OR LOWER(u.company) LIKE @search OR LOWER(u.role) LIKE @search)";
    params.search = `%${search.toLowerCase()}%`;
  }

  try {
    const pool = await poolPromise;
    
    // Get total count (no join, no alias needed)
    const countQuery = `SELECT COUNT(*) as total FROM petty_Users ${whereClause}`;
    const countRequest = pool.request();
    if (search) {
      countRequest.input('search', sql.NVarChar, params.search);
    }
    const countResult = await countRequest.query(countQuery);
    const totalItems = countResult.recordset[0].total;
    
    // Get paginated data with L1 manager info (uses u. alias)
    const dataQuery = `
      SELECT 
        u.*,
        m.firstName as l1ManagerFirstName,
        m.lastName as l1ManagerLastName,
        m.email as l1ManagerEmail
      FROM petty_Users u
      LEFT JOIN petty_Users m ON u.l1_manager_id = m.id
      ${whereClauseAliased}
      ORDER BY u.id
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
    const users = result.recordset.map((u) => {
        id: u.id, 
        firstName: u.firstName,
        l1_manager_id: u.l1_manager_id,
        l1ManagerFirstName: u.l1ManagerFirstName,
        l1ManagerLastName: u.l1ManagerLastName
      });
      
      return {
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email.split('@')[0],
        email: u.email,
        role: u.role || 'User',
        company: u.company || '',
        department: u.department || '',
        l1ManagerId: u.l1_manager_id,
        l1ManagerName: u.l1ManagerFirstName && u.l1ManagerLastName 
          ? `${u.l1ManagerFirstName} ${u.l1ManagerLastName}`.trim() 
          : u.l1ManagerEmail || null,
        createdAt: u.createdAt || u.created_at,
        updatedAt: u.updatedAt || u.updated_at
      };
    });

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
    const { firstName, lastName, email, password, role, company, department, l1ManagerId } = req.body;
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
      .input("l1ManagerId", l1ManagerId || null)
      .query(
        `INSERT INTO petty_Users (firstName, lastName, email, password, role, company, department, l1_manager_id)
         VALUES (@firstName, @lastName, @email, @password, @role, @company, @department, @l1ManagerId)`
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
    const { firstName, lastName, email, password, role, company, department, l1ManagerId } = req.body;
    
    
    // Convert l1ManagerId to proper type
    let l1ManagerValue = null;
    if (l1ManagerId !== null && l1ManagerId !== undefined && l1ManagerId !== '') {
      l1ManagerValue = parseInt(l1ManagerId, 10);
    } else {
    }
    
    
    const pool = await poolPromise;
    const updateResult = await pool
      .request()
      .input("id", sql.Int, parseInt(id, 10))
      .input("firstName", sql.NVarChar, firstName)
      .input("lastName", sql.NVarChar, lastName)
      .input("email", sql.NVarChar, email)
      .input("password", sql.NVarChar, password ?? null)
      .input("role", sql.NVarChar, role)
      .input("company", sql.NVarChar, company)
      .input("department", sql.NVarChar, department)
      .input("l1ManagerId", sql.Int, l1ManagerValue)
      .query(
        `UPDATE petty_Users
         SET firstName = @firstName,
             lastName = @lastName,
             email = @email,
             password = CASE WHEN @password IS NULL OR LTRIM(RTRIM(@password)) = '' THEN password ELSE @password END,
             role = @role,
             company = @company,
             department = @department,
             l1_manager_id = @l1ManagerId
         WHERE id = @id`
      );
    
    
    if (updateResult.rowsAffected[0] === 0) {
    }
    
    // Verify the update by querying the database
    const verifyResult = await pool
      .request()
      .input("userId", sql.Int, parseInt(id, 10))
      .query('SELECT id, firstName, lastName, l1_manager_id FROM petty_Users WHERE id = @userId');
    
    if (verifyResult.recordset.length > 0) {
    }
    
    // Fetch and return the updated user with manager info
    const userResult = await pool
      .request()
      .input("userId", sql.Int, parseInt(id, 10))
      .query(`
        SELECT 
          u.*,
          m.firstName as l1ManagerFirstName,
          m.lastName as l1ManagerLastName,
          m.email as l1ManagerEmail
        FROM petty_Users u
        LEFT JOIN petty_Users m ON u.l1_manager_id = m.id
        WHERE u.id = @userId
      `);
    
    
    if (userResult.recordset.length > 0) {
      const u = userResult.recordset[0];
      
      const updatedUser = {
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email.split('@')[0],
        email: u.email,
        role: u.role || 'User',
        company: u.company || '',
        department: u.department || '',
        l1ManagerId: u.l1_manager_id,
        l1ManagerName: u.l1ManagerFirstName && u.l1ManagerLastName 
          ? `${u.l1ManagerFirstName} ${u.l1ManagerLastName}`.trim() 
          : u.l1ManagerEmail || null,
      };
      return res.json(updatedUser);
    } else {
      return res.send("User updated");
    }
  } catch (err) {
    console.error('=== PUT /users/:id ERROR ===');
    console.error('Error:', err.message);
    console.error('Stack:', err.stack);
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
