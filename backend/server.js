// Core / HTTPS
const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");

// Env
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

// App
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const fetch = require("node-fetch"); // MailerSend API

const app = express();
app.use(cors({ origin: true, credentials: false }));
app.use(express.json());

// Serve frontend
app.use(express.static(path.resolve(__dirname, "../frontend")));

// Health
app.get("/", (_req, res) => res.send("API up"));
app.get("/api/auth/health", (_req, res) =>
  res.json({ ok: true, time: new Date().toISOString() })
);

// MailerSend API helper
async function sendResetMail(toEmail, toName, resetUrl) {
  const fromEmail =
    (process.env.MAIL_FROM.match(/<(.*)>/)?.[1]) ||
    "noreply@test-p7kx4xwo7v8g9yjr.mlsender.net";

  const body = {
    from: { email: fromEmail, name: "Login System" },
    to: [{ email: toEmail, name: toName || "User" }],
    subject: "Password reset",
    text: `Reset link: ${resetUrl}`,
    html: `<p>Reset link: <a href="${resetUrl}">${resetUrl}</a></p>`
  };

  const res = await fetch("https://api.mailersend.com/v1/email", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.MAILERSEND_API_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`MailerSend API ${res.status}: ${err}`);
  }
}
app.locals.sendResetMail = sendResetMail;

// Routes
const authRoutes = require(path.resolve(__dirname, "./routes/auth"));
app.use("/api/auth", authRoutes);

// 404
app.use((_req, res) => res.status(404).json({ message: "Not found" }));

// DB
const { MONGODB_URI = "mongodb://localhost:27017/login_system" } = process.env;
mongoose
  .connect(MONGODB_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => {
    console.error("MongoDB connect error:", err.message);
    process.exit(1);
  });

// HTTPS only
const key = fs.readFileSync(path.resolve(__dirname, "../localhost+2-key.pem"));
const cert = fs.readFileSync(path.resolve(__dirname, "../localhost+2.pem"));
const HTTPS_PORT = Number(process.env.HTTPS_PORT || 5443);
https.createServer({ key, cert }, app).listen(HTTPS_PORT, () => {
  console.log("HTTPS on", HTTPS_PORT);
});

// HTTP → HTTPS redirect
http
  .createServer((req, res) => {
    const host = (req.headers.host || "").split(":")[0] || "localhost";
    res.writeHead(301, { Location: `https://${host}:${HTTPS_PORT}${req.url}` });
    res.end();
  })
  .listen(5000, () => console.log("HTTP redirect on 5000 → HTTPS", HTTPS_PORT));
