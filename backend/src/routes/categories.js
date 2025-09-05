const express = require("express");
const router = express.Router();
const { poolPromise } = require("../config/db");

// GET /api/categories
router.get("/", async (_req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query("SELECT * FROM Categories ORDER BY name");
    const cats = (result.recordset || []).map((r) => ({ id: r.id, name: r.name, description: r.description }));
    res.json(cats);
  } catch (err) {
    console.error("Categories GET error:", err?.message || err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/categories
router.post("/", async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ message: "Name is required" });
    const pool = await poolPromise;
    const insert = await pool
      .request()
      .input("name", String(name).trim())
      .input("description", String(description || "").trim())
      .query(`INSERT INTO Categories (name, description) OUTPUT INSERTED.* VALUES (@name, @description)`);
    const c = insert.recordset?.[0];
    res.status(201).json({ id: c.id, name: c.name, description: c.description });
  } catch (err) {
    console.error("Categories POST error:", err?.message || err);
    res.status(500).json({ message: "Server error" });
  }
});

// PUT /api/categories/:id
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    const pool = await poolPromise;
    await pool
      .request()
      .input("id", id)
      .input("name", String(name || "").trim())
      .input("description", String(description || "").trim())
      .query(`UPDATE Categories SET name = CASE WHEN @name = '' THEN name ELSE @name END, description = @description WHERE id = @id`);
    res.send("Category updated");
  } catch (err) {
    console.error("Categories PUT error:", err?.message || err);
    res.status(500).json({ message: "Server error" });
  }
});

// DELETE /api/categories/:id
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await poolPromise;
    await pool.request().input("id", id).query("DELETE FROM Categories WHERE id = @id");
    res.send("Category deleted");
  } catch (err) {
    console.error("Categories DELETE error:", err?.message || err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
