const express = require("express");
const router = express.Router();
const { poolPromise } = require("../config/db");

// GET /api/companies - list companies
router.get("/", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query("SELECT * FROM petty_Companies ORDER BY name");
    const companies = (result.recordset || []).map((c) => ({
      id: c.id,
      name: c.name,
      code: c.code,
      country: c.country,
    }));
    res.json(companies);
  } catch (err) {
    console.error("Companies GET error:", err?.message || err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/companies - create company
router.post("/", async (req, res) => {
  try {
    const { name, code, country } = req.body;
    if (!name || !code) {
      return res.status(400).json({ message: "Name and code are required" });
    }
    const pool = await poolPromise;
    const insert = await pool
      .request()
      .input("name", String(name).trim())
      .input("code", String(code).trim())
      .input("country", String(country || "").trim())
      .query(
        `INSERT INTO petty_Companies (name, code, country)
         OUTPUT INSERTED.*
         VALUES (@name, @code, @country)`
      );

    const c = insert.recordset?.[0];
    res.status(201).json({ id: c.id, name: c.name, code: c.code, country: c.country });
  } catch (err) {
    console.error("Companies POST error:", err?.message || err);
    res.status(500).json({ message: "Server error" });
  }
});

// PUT /api/companies/:id - update company
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, country } = req.body;
    const pool = await poolPromise;
    await pool
      .request()
      .input("id", id)
      .input("name", String(name || "").trim())
      .input("code", String(code || "").trim())
      .input("country", String(country || "").trim())
      .query(
        `UPDATE petty_Companies
         SET name = CASE WHEN @name = '' THEN name ELSE @name END,
             code = CASE WHEN @code = '' THEN code ELSE @code END,
             country = @country
         WHERE id = @id`
      );
    res.send("Company updated");
  } catch (err) {
    console.error("Companies PUT error:", err?.message || err);
    res.status(500).json({ message: "Server error" });
  }
});

// DELETE /api/companies/:id - delete company
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await poolPromise;
    await pool.request().input("id", id).query("DELETE FROM petty_Companies WHERE id = @id");
    res.send("Company deleted");
  } catch (err) {
    console.error("Companies DELETE error:", err?.message || err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
