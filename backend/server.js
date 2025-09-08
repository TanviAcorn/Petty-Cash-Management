const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// ✅ import once
const userRoutes = require("./src/routes/users");
const companyRoutes = require("./src/routes/companies");
const categoryRoutes = require("./src/routes/categories");
const requestRoutes = require("./src/routes/requests");

// ✅ use it once
app.use("/api/users", userRoutes);
app.use("/api/companies", companyRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/requests", requestRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
