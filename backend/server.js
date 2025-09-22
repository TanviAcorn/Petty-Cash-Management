require('dotenv').config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

// Enhanced CORS configuration
// Note: When origin is '*', credentials MUST be false per CORS spec.
// Replace the CORS configuration with:
const corsOptions = {
  origin: [
    'http://172.30.36.47:5176',  // Your frontend URL
    'http://localhost:5176',     // Local development
    // Add any other domains if needed
  ],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());

// ✅ import once
const userRoutes = require("./src/routes/users");
const companyRoutes = require("./src/routes/companies");
const categoryRoutes = require("./src/routes/categories");
const requestRoutes = require("./src/routes/requests");
const healthRoutes = require("./src/routes/health");
const locationRoutes = require("./src/routes/locations");

// ✅ use it once
app.use("/api/users", userRoutes);
app.use("/api/companies", companyRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/requests", requestRoutes);
app.use("/api/health", healthRoutes);
app.use("/api/locations", locationRoutes);

// Static file hosting for uploads
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use(express.static(path.join(__dirname, "../frontend/dist")));

app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/dist", "index.html"));
});

const PORT = process.env.PORT || 5005;
const HOST = '0.0.0.0';
app.listen(PORT, HOST, () => {
    console.log(`Server running on http://${HOST}:${PORT}`);
    console.log(`Access the API at http://${HOST}:${PORT}/api`);
});
