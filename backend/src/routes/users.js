const express = require("express");
const router = express.Router();
const { poolPromise } = require("../config/db"); // mssql connection

// GET all users
router.get("/", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query("SELECT * FROM Users");
    res.json(result.recordset);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// POST new user
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

// PUT update user
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
      .input("password", password)
      .input("role", role)
      .input("company", company)
      .input("department", department)
      .query(
        `UPDATE Users
         SET firstName = @firstName,
             lastName = @lastName,
             email = @email,
             password = @password,
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

// DELETE user
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
