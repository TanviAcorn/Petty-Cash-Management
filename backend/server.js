require('dotenv').config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

// Enhanced CORS configuration
// Note: When origin is '*', credentials MUST be false per CORS spec.
// Replace the CORS configuration with:
// Allowed origins for CORS
const allowedOrigins = [
  'http://172.30.36.47:5176',  // Internal frontend
  'http://localhost:5176',     // Local development
  'http://103.206.209.210:5176' // External access
];

// Add any additional origins from environment variable
if (process.env.FRONTEND_URL) {
  const additionalOrigins = process.env.FRONTEND_URL
    .split(',')
    .map(origin => origin.trim())
    .filter(origin => !allowedOrigins.includes(origin));
  
  allowedOrigins.push(...additionalOrigins);
}

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, etc)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn('CORS blocked for origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  next();
});

// ✅ import once
const userRoutes = require("./src/routes/users");
const companyRoutes = require("./src/routes/companies");
const categoryRoutes = require("./src/routes/categories");
const requestRoutes = require("./src/routes/requests");
const healthRoutes = require("./src/routes/health");
const locationRoutes = require("./src/routes/locations");
const travelRoutes = require("./src/routes/travel");

// ✅ use it once
app.use("/api/users", userRoutes);
app.use("/api/companies", companyRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/requests", requestRoutes);
app.use("/api/health", healthRoutes);
app.use("/api/locations", locationRoutes);
app.use("/api/travel", travelRoutes);

// Static file hosting for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use(express.static(path.join(__dirname, "../frontend/dist")));

app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/dist", "index.html"));
});

app.listen(process.env.PORT || 5005, '0.0.0.0', () => {
  console.log(`Server running on port ${process.env.PORT || 5005}`);
});
