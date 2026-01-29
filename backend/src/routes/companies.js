const express = require("express");
const router = express.Router();
const { poolPromise } = require("../config/db");
const sql = require('mssql');

// GET /api/companies - list companies
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
    whereClause = "WHERE (LOWER(name) LIKE @search OR LOWER(code) LIKE @search OR LOWER(country) LIKE @search)";
    params.search = `%${search.toLowerCase()}%`;
  }

  try {
    const pool = await poolPromise;
    
    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM petty_Companies ${whereClause}`;
    const countRequest = pool.request();
    if (search) {
      countRequest.input('search', sql.NVarChar, params.search);
    }
    const countResult = await countRequest.query(countQuery);
    const totalItems = countResult.recordset[0].total;
    
    // Get paginated data
    const dataQuery = `
      SELECT * FROM petty_Companies 
      ${whereClause}
      ORDER BY name
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `;
    
    const dataRequest = pool.request();
    if (search) {
      dataRequest.input('search', sql.NVarChar, params.search);
    }
    dataRequest.input('offset', sql.Int, offset);
    dataRequest.input('limit', sql.Int, itemsPerPage);
    const result = await dataRequest.query(dataQuery);
    
    const companies = (result.recordset || []).map((c) => ({
      id: c.id,
      name: c.name,
      code: c.code,
      country: c.country,
    }));
    
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    
    res.json({
      data: companies,
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
