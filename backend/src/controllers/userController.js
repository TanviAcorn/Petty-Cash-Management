const { poolPromise } = require("../config/db");

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const pool = await poolPromise;
    // Query petty_Users (the primary user table used across the app)
    // Fall back to Users table if not found, for backward compatibility
    let userByEmail = await pool
      .request()
      .input("email", String(email))
      .query(`
        SELECT TOP 1 *
        FROM petty_Users
        WHERE LOWER(LTRIM(RTRIM(email))) = LOWER(LTRIM(RTRIM(@email)))
      `);

    // Fallback: try legacy Users table
    if (!userByEmail.recordset || userByEmail.recordset.length === 0) {
      userByEmail = await pool
        .request()
        .input("email", String(email))
        .query(`
          SELECT TOP 1 *
          FROM Users
          WHERE LOWER(LTRIM(RTRIM(email))) = LOWER(LTRIM(RTRIM(@email)))
        `);
    }

    if (!userByEmail.recordset || userByEmail.recordset.length === 0) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const u = userByEmail.recordset[0];
    const pwdOk = String(u.password || "").trim() === String(password).trim();
    if (!pwdOk) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    
    const token = `token-${u.id}-${Date.now()}`;
    return res.json({
      token,
      user: {
        id: u.id,
        name: `${u.firstName} ${u.lastName}`,
        email: u.email,
        role: u.role,
        company: u.company,
        department: u.department,
      },
    });
  } catch (err) {
    console.error("Login error:", err?.message || err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query("SELECT * FROM Users");

    const users = result.recordset.map((u) => ({
      id: u.id,
      name: `${u.firstName} ${u.lastName}`,
      email: u.email,
      role: u.role,
      company: u.company,
      department: u.department
    }));

    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.createUser = async (req, res) => {
  try {
    const { firstName, lastName, email, password, role, company, department } = req.body;
    const pool = await poolPromise;
    
    // Check if user already exists
    const existingUser = await pool
      .request()
      .input("email", email)
      .query("SELECT id FROM Users WHERE email = @email");
      
    if (existingUser.recordset.length > 0) {
      return res.status(400).json({ message: "User with this email already exists" });
    }

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
        `INSERT INTO Users (firstName, lastName, email, password, role, company, department)
         VALUES (@firstName, @lastName, @email, @password, @role, @company, @department)`
      );
      
    res.status(201).json({ message: "User created successfully" });
  } catch (err) {
    console.error("Create user error:", err);
    res.status(500).json({ message: err.message });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, email, password, role, company, department } = req.body;
    
    const pool = await poolPromise;
    
    // Check if user exists
    const user = await pool
      .request()
      .input("id", id)
      .query("SELECT id FROM Users WHERE id = @id");
      
    if (user.recordset.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

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
        `UPDATE Users
         SET firstName = @firstName,
             lastName = @lastName,
             email = @email,
             password = CASE WHEN @password IS NULL OR LTRIM(RTRIM(@password)) = '' THEN password ELSE @password END,
             role = @role,
             company = @company,
             department = @department
         WHERE id = @id`
      );
      
    res.json({ message: "User updated successfully" });
  } catch (err) {
    console.error("Update user error:", err);
    res.status(500).json({ message: err.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await poolPromise;
    
    // Check if user exists
    const user = await pool
      .request()
      .input("id", id)
      .query("SELECT id FROM Users WHERE id = @id");
      
    if (user.recordset.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    
    await pool.request().input("id", id).query("DELETE FROM Users WHERE id = @id");
    res.json({ message: "User deleted successfully" });
  } catch (err) {
    console.error("Delete user error:", err);
    res.status(500).json({ message: err.message });
  }
};
