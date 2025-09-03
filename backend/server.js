const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// ✅ import once
const userRoutes = require("./src/routes/users");

// ✅ use it once
app.use("/api/users", userRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
