const express = require("express");
const router = express.Router();
const db = require("../db"); // knex or mssql connection

// GET all users
router.get("/", async (req, res) => {
  try {
    const result = await db("Users").select("*");
    res.json(result);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// POST new user
router.post("/", async (req, res) => {
  try {
    const { firstName, lastName, email, password, role, company, department } = req.body;
    await db("Users").insert({
      firstName, lastName, email, password, role, company, department
    });
    res.status(201).send("User created");
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// PUT update user
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await db("Users").where({ id }).update(req.body);
    res.send("User updated");
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// DELETE user
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await db("Users").where({ id }).del();
    res.send("User deleted");
  } catch (err) {
    res.status(500).send(err.message);
  }
});

module.exports = router;
