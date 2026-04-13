const express = require("express");
const router = express.Router();
const { poolPromise } = require("../config/db");
const sql = require('mssql');
const crypto = require('crypto');
const { sendEmail } = require('../utils/mailer');

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
      ORDER BY u.firstName, u.lastName
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
      console.error('PUT /users/:id — no rows updated for id:', id);
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

// POST /api/users/forgot-password
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const pool = await poolPromise;

    // Ensure reset token columns exist
    await pool.request().query(`
      IF COL_LENGTH('dbo.petty_Users','reset_token') IS NULL
        ALTER TABLE dbo.petty_Users ADD reset_token NVARCHAR(64) NULL;
      IF COL_LENGTH('dbo.petty_Users','reset_token_expiry') IS NULL
        ALTER TABLE dbo.petty_Users ADD reset_token_expiry DATETIME2 NULL;
    `);

    const result = await pool.request()
      .input('email', sql.NVarChar(320), email.toLowerCase().trim())
      .query('SELECT id, firstName, lastName FROM petty_Users WHERE LOWER(LTRIM(RTRIM(email))) = @email');

    // Always return success to prevent email enumeration
    if (!result.recordset.length) {
      return res.json({ message: 'If that email exists, a reset link has been sent.' });
    }

    const user = result.recordset[0];
    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await pool.request()
      .input('id', sql.Int, user.id)
      .input('token', sql.NVarChar(64), token)
      .input('expiry', sql.DateTime2, expiry)
      .query('UPDATE petty_Users SET reset_token = @token, reset_token_expiry = @expiry WHERE id = @id');

    const baseUrl = (process.env.FRONTEND_URL || 'http://localhost:5176').split(',')[0].trim();
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;
    const name = `${user.firstName || ''} ${user.lastName || ''}`.trim() || email;

    await sendEmail({
      to: email,
      subject: 'Reset Your PocketPro HR Password',
      html: `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f3f4f6;">
  <div style="max-width:600px;margin:0 auto;padding:20px;">
    <div style="background:#2563EB;padding:32px 24px;border-radius:12px 12px 0 0;text-align:center;">
      <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">Reset Your Password</h1>
      <p style="margin:8px 0 0;color:#dbeafe;font-size:14px;">PocketPro HR</p>
    </div>
    <div style="background:#fff;padding:32px 24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
      <p style="color:#374151;font-size:15px;line-height:1.6;">Hi <strong>${name}</strong>,</p>
      <p style="color:#374151;font-size:15px;line-height:1.6;">
        We received a request to reset your password. Click the button below to set a new password.
        This link will expire in <strong>1 hour</strong>.
      </p>
      <div style="text-align:center;margin:32px 0;">
        <a href="${resetUrl}" style="display:inline-block;background:#2563EB;color:#fff;padding:14px 36px;text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;">
          Reset Password
        </a>
      </div>
      <p style="color:#6b7280;font-size:13px;line-height:1.6;">
        If you didn't request a password reset, you can safely ignore this email. Your password will not change.
      </p>
      <p style="color:#9ca3af;font-size:12px;text-align:center;margin-top:24px;">PocketPro HR — Automated Notification</p>
    </div>
  </div>
</body></html>`
    });

    res.json({ message: 'If that email exists, a reset link has been sent.' });
  } catch (err) {
    console.error('forgot-password error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/users/reset-password
router.post("/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ message: 'Token and password are required' });
    if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });

    const pool = await poolPromise;

    const result = await pool.request()
      .input('token', sql.NVarChar(64), token)
      .input('now', sql.DateTime2, new Date())
      .query('SELECT id FROM petty_Users WHERE reset_token = @token AND reset_token_expiry > @now');

    if (!result.recordset.length) {
      return res.status(400).json({ message: 'Reset link is invalid or has expired.' });
    }

    const userId = result.recordset[0].id;

    await pool.request()
      .input('id', sql.Int, userId)
      .input('password', sql.NVarChar(200), password)
      .query('UPDATE petty_Users SET password = @password, reset_token = NULL, reset_token_expiry = NULL WHERE id = @id');

    res.json({ message: 'Password reset successfully. You can now log in.' });
  } catch (err) {
    console.error('reset-password error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
