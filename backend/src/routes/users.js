const express = require("express");
const router = express.Router();
const { poolPromise } = require("../config/db"); // mssql connection

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
        SELECT TOP 1 *
        FROM Users
        WHERE LOWER(LTRIM(RTRIM(email))) = LOWER(LTRIM(RTRIM(@email)))
      `);

    if (!userByEmail.recordset || userByEmail.recordset.length === 0) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const u = userByEmail.recordset[0];
    const pwdOk = String(u.password || "").trim() === String(password).trim();
    if (!pwdOk) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    const token = `token-${u.id}-${Date.now()}`; // placeholder token
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
});

// GET /api/users - all users
router.get("/", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query("SELECT * FROM Users");

    // Map to expected structure for frontend
    const users = result.recordset.map((u) => ({
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      name: `${u.firstName} ${u.lastName}`.trim(),
      email: u.email,
      role: u.role,
      company: u.company,
      department: u.department,
    }));

    res.json(users);
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
        `INSERT INTO Users (firstName, lastName, email, password, role, company, department)
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
    await pool.request().input("id", id).query("DELETE FROM Users WHERE id = @id");
    res.send("User deleted");
  } catch (err) {
    res.status(500).send(err.message);
  }
});

module.exports = router;
