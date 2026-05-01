require('dotenv').config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();

// CORS — allowed origins are driven entirely by environment variables.
// Add origins to FRONTEND_URL in .env (comma-separated for multiple).
// Hardcoded LAN IPs are only used as a local-dev fallback.
const allowedOrigins = new Set([
  'http://localhost:5176',  // local dev frontend
  'http://localhost:5177',  // local dev backend (for same-origin requests)
  'http://localhost:5005',
]);

// Add all origins from FRONTEND_URL env var (production domain goes here)
if (process.env.FRONTEND_URL) {
  process.env.FRONTEND_URL
    .split(',')
    .map(o => o.trim())
    .filter(Boolean)
    .forEach(o => allowedOrigins.add(o));
}

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);

    if (allowedOrigins.has(origin)) {
      callback(null, true);
    } else {
      // In development (NODE_ENV !== 'production'), allow all origins so
      // any developer's machine can connect without editing the config.
      if (process.env.NODE_ENV !== 'production') {
        return callback(null, true);
      }
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

// ✅ import once
const userRoutes = require("./src/routes/users");
const companyRoutes = require("./src/routes/companies");
const categoryRoutes = require("./src/routes/categories");
const requestRoutes = require("./src/routes/requests");
const healthRoutes = require("./src/routes/health");
const locationRoutes = require("./src/routes/locations");
const l1ApprovalsRoutes = require("./src/routes/l1-approvals");
const travelFeedbackRoutes = require("./src/routes/travel-feedback");
const visaTypesRoutes = require("./src/routes/visa-types");
const travelDocumentsRoutes = require("./src/routes/travel-documents");
const travelCostsRoutes = require("./src/routes/travel-costs");
const { startFeedbackScheduler, sendPendingFeedbackEmails, sendPreTravelReminders, sendJourneyStartsTomorrow, sendVisaExpiryAlerts, sendPassportExpiryAlerts } = require("./src/utils/feedbackScheduler");

// ✅ use it once
app.use("/api/users", userRoutes);
app.use("/api/companies", companyRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/requests", requestRoutes);
app.use("/api/health", healthRoutes);
app.use("/api/locations", locationRoutes);
app.use("/api/l1-approvals", l1ApprovalsRoutes);
app.use("/api/travel-feedback", travelFeedbackRoutes);
app.use("/api/visa-types", visaTypesRoutes);

app.use("/api/travel-documents", travelDocumentsRoutes);
app.use("/api/travel-costs", travelCostsRoutes);

// Start scheduled feedback emails
startFeedbackScheduler();

// ── Manual trigger endpoint (admin only) ─────────────────────────────────
// POST /api/admin/run-scheduler?job=feedback|pre-travel|journey|visa|passport|all
app.post('/api/admin/run-scheduler', async (req, res) => {
  const job = req.query.job || 'all';
  const results = {};
  try {
    if (job === 'feedback' || job === 'all') {
      console.log('[ManualTrigger] Running sendPendingFeedbackEmails...');
      await sendPendingFeedbackEmails();
      results.feedback = 'done';
    }
    if (job === 'pre-travel' || job === 'all') {
      console.log('[ManualTrigger] Running sendPreTravelReminders...');
      await sendPreTravelReminders();
      results.preTravelReminders = 'done';
    }
    if (job === 'journey' || job === 'all') {
      console.log('[ManualTrigger] Running sendJourneyStartsTomorrow...');
      await sendJourneyStartsTomorrow();
      results.journeyStartsTomorrow = 'done';
    }
    if (job === 'visa' || job === 'all') {
      console.log('[ManualTrigger] Running sendVisaExpiryAlerts...');
      await sendVisaExpiryAlerts();
      results.visaAlerts = 'done';
    }
    if (job === 'passport' || job === 'all') {
      console.log('[ManualTrigger] Running sendPassportExpiryAlerts...');
      await sendPassportExpiryAlerts();
      results.passportAlerts = 'done';
    }
    res.json({ message: 'Scheduler jobs triggered', results });
  } catch (err) {
    console.error('[ManualTrigger] Error:', err.message);
    res.status(500).json({ message: 'Scheduler trigger failed', error: err.message });
  }
});

// Static file hosting for uploads
// Files are also accessible via /api/file/:filename (see route below)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Expose uploads via /api/file/:filename — this is the primary route used
// by the frontend. It streams the file directly and returns a proper 404
// (not the SPA index.html) when a file is missing, which prevents blank pages.
app.get('/api/file/:filename', (req, res) => {
  const filename = path.basename(req.params.filename); // strip any path traversal
  const filePath = path.join(__dirname, 'uploads', filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ message: 'File not found' });
  }
  // Set Content-Disposition to inline so images/PDFs open in the browser
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.sendFile(filePath);
});

const distPath = path.join(__dirname, "../frontend/dist");
const distIndex = path.join(distPath, "index.html");

if (fs.existsSync(distIndex)) {
  app.use(express.static(distPath));
  app.get("*", (req, res) => {
    res.sendFile(distIndex);
  });
} else {
  app.get("*", (req, res) => {
    res.status(404).json({ message: "Frontend not built. Run `npm run build` in the frontend folder, or run the frontend dev server separately." });
  });
}

app.listen(process.env.PORT || 5005, '0.0.0.0', () => {
  console.log(`Server running on port ${process.env.PORT || 5005}`);
});
