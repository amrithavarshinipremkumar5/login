// server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");

const app = express();

// 1) CORS — allow Live Server (127.0.0.1 and localhost)
app.use(cors({
  origin: ["http://127.0.0.1:5500", "http://localhost:5500"],
  credentials: false
}));

// 2) Parse JSON
app.use(express.json());

// 3) Health check
app.get("/api/auth/health", (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// 4) Routes
// Make sure you have backend/routes/auth.js exporting a router
const authRoutes = require("./routes/auth");
app.use("/api/auth", authRoutes);

// 5) Mongo connect
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/login_system";
mongoose.connect(MONGODB_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => {
    console.error("MongoDB connect error:", err.message);
    process.exit(1);
  });

// 6) Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log("Server running on", PORT);
});
