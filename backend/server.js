const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const userRoutes = require("./src/routes/userRoutes.js");

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;
const userRoutes = require("./routes/users");
app.use("/api/users", userRoutes);
app.use(cors());
app.use(express.json());

app.use("/api/users", userRoutes);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
