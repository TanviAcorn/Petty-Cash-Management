const express = require('express');
const router = express.Router();
const sql = require('mssql');
const { poolPromise } = require('../config/db');

// GET /api/locations
router.get("/", async (_req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .query("SELECT * FROM petty_Locations ORDER BY location");
        
        const locations = (result.recordset || []).map((r) => ({
            id: r.id,
            name: r.location,
            budget: r.budget,
            usedAmount: r.used_amount,
            remainingAmount: r.remaining_amount
        }));
        
        res.json(locations);
    } catch (err) {
        console.error("Error fetching locations:", err?.message || err);
        res.status(500).json({ 
            success: false,
            message: "Failed to fetch locations",
            error: err?.message
        });
    }
});

// POST /api/locations
router.post("/", async (req, res) => {
    try {
        const { location, budget = 0 } = req.body;
        
        if (!location || typeof location !== 'string' || location.trim() === '') {
            return res.status(400).json({ 
                success: false,
                message: "Location name is required and must be a non-empty string" 
            });
        }

        const budgetValue = parseFloat(budget);
        if (isNaN(budgetValue) || budgetValue < 0) {
            return res.status(400).json({ 
                success: false,
                message: "Budget must be a non-negative number" 
            });
        }

        const pool = await poolPromise;
        const result = await pool.request()
            .input("location", sql.NVarChar(100), location.trim())
            .input("budget", sql.Decimal(18, 2), budgetValue)
            .query(`
                INSERT INTO petty_Locations (location, budget, used_amount, remaining_amount)
                OUTPUT INSERTED.id, INSERTED.location as name, INSERTED.budget, 
                       INSERTED.used_amount as usedAmount, INSERTED.remaining_amount as remainingAmount
                VALUES (@location, @budget, 0, @budget)
            `);

        if (!result.recordset || result.recordset.length === 0) {
            throw new Error('Failed to create location');
        }

        res.status(201).json({
            success: true,
            data: result.recordset[0]
        });

    } catch (err) {
        console.error("Error creating location:", err?.message || err);
        
        if (err.number === 2627) { // SQL Server duplicate key error
            return res.status(409).json({ 
                success: false,
                message: "A location with this name already exists" 
            });
        }

        res.status(500).json({ 
            success: false,
            message: "Failed to create location",
            error: err?.message 
        });
    }
});

// PUT /api/locations/:id
router.put("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { location, budget } = req.body;

        if (location !== undefined && (typeof location !== 'string' || location.trim() === '')) {
            return res.status(400).json({ 
                success: false,
                message: "Location name must be a non-empty string" 
            });
        }

        const budgetValue = budget !== undefined ? parseFloat(budget) : undefined;
        if (budget !== undefined && (isNaN(budgetValue) || budgetValue < 0)) {
            return res.status(400).json({ 
                success: false,
                message: "Budget must be a non-negative number" 
            });
        }

        const pool = await poolPromise;
        const request = pool.request()
            .input("id", sql.Int, parseInt(id));

        let query = "UPDATE petty_Locations SET ";
        const updates = [];
        
        if (location !== undefined) {
            request.input("location", sql.NVarChar(100), location.trim());
            updates.push("location = @location");
        }
        
        if (budget !== undefined) {
            request.input("budget", sql.Decimal(18, 2), budgetValue);
            updates.push("budget = @budget");
            
            // Only update remaining_amount if budget is being updated
            updates.push("remaining_amount = @budget - used_amount");
        }

        if (updates.length === 0) {
            return res.status(400).json({ 
                success: false,
                message: "No valid fields to update" 
            });
        }

        query += updates.join(", ") + " WHERE id = @id";
        
        const result = await request.query(query);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ 
                success: false,
                message: "Location not found" 
            });
        }

        res.json({ 
            success: true,
            message: "Location updated successfully" 
        });

    } catch (err) {
        console.error("Error updating location:", err?.message || err);
        
        if (err.number === 2627) { // SQL Server duplicate key error
            return res.status(409).json({ 
                success: false,
                message: "A location with this name already exists" 
            });
        }

        res.status(500).json({ 
            success: false,
            message: "Failed to update location",
            error: err?.message 
        });
    }
});

// DELETE /api/locations/:id
router.delete("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        
        const pool = await poolPromise;
        const result = await pool.request()
            .input("id", sql.Int, parseInt(id))
            .query("DELETE FROM petty_Locations WHERE id = @id");

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ 
                success: false,
                message: "Location not found" 
            });
        }

        res.json({ 
            success: true,
            message: "Location deleted successfully" 
        });

    } catch (err) {
        console.error("Error deleting location:", err?.message || err);
        
        // Handle foreign key constraint violation
        if (err.number === 547) {
            return res.status(400).json({ 
                success: false,
                message: "Cannot delete location as it is being used by other records" 
            });
        }

        res.status(500).json({ 
            success: false,
            message: "Failed to delete location",
            error: err?.message 
        });
    }
});

//update location budget when a new request is made:
// PATCH /api/locations/:id/update-budget
router.patch("/:id/update-budget", async (req, res) => {
    try {
        const { id } = req.params;
        const { amount, currency, category } = req.body;

        if (!amount || isNaN(amount) || amount <= 0) {
            return res.status(400).json({ 
                success: false,
                message: "Valid amount is required" 
            });
        }

        const pool = await poolPromise;

        // Get location details
        const locationResult = await pool.request()
            .input("id", sql.Int, id)
            .query("SELECT * FROM petty_Locations WHERE id = @id");

        if (locationResult.recordset.length === 0) {
            return res.status(404).json({ success: false, message: "Location not found" });
        }

        const location = locationResult.recordset[0];

        // Restricted locations
        const restrictedLocations = ["Unit 2B", "Hitchin", "TFC", "TFC - Office"];
        const restrictedCategory = "Amenities";

        // Decide which budget to enforce
        let effectiveBudget = location.budget;
        if (restrictedLocations.includes(location.location) && category === restrictedCategory) {
            effectiveBudget = 30;
        }

        // Exchange rate (stubbed for now)
        const exchangeRate = typeof getExchangeRate === "function" 
            ? await getExchangeRate(currency, "GBP") 
            : 1;

        const amountInGBP = parseFloat(amount) / exchangeRate;

        const newUsedAmount = parseFloat(location.used_amount) + amountInGBP;
        const remainingAmount = effectiveBudget - newUsedAmount;

        if (remainingAmount < 0) {
            return res.status(400).json({
                success: false,
                message: `Insufficient budget. Max allowed: £${effectiveBudget}`
            });
        }

        // Update DB
        await pool.request()
            .input("id", sql.Int, id)
            .input("usedAmount", sql.Decimal(10, 2), newUsedAmount)
            .input("remainingAmount", sql.Decimal(10, 2), remainingAmount)
            .query(`
                UPDATE petty_Locations 
                SET used_amount = @usedAmount, remaining_amount = @remainingAmount
                WHERE id = @id
            `);

        res.json({
            success: true,
            data: {
                id: location.id,
                name: location.location,
                budget: effectiveBudget,
                usedAmount: newUsedAmount,
                remainingAmount
            }
        });

    } catch (err) {
        console.error("Error updating location budget:", err?.message || err);
        res.status(500).json({
            success: false,
            message: "Failed to update location budget",
            error: err?.message
        });
    }
});

module.exports = router;