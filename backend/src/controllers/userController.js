const db = require("../config/db");

exports.getAllUsers = async (req, res) => {
  try {
    const users = await db("Users").select("*");
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createUser = async (req, res) => {
  const { name, email, role, company, department } = req.body;
  try {
    const [id] = await db("Users").insert({ name, email, role, company, department });
    res.status(201).json({ user_id: id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateUser = async (req, res) => {
  const { id } = req.params;
  const { name, email, role, company, department } = req.body;
  try {
    await db("Users").where({ user_id: id }).update({ name, email, role, company, department });
    res.json({ message: "User updated" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteUser = async (req, res) => {
  const { id } = req.params;
  try {
    await db("Users").where({ user_id: id }).del();
    res.json({ message: "User deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
