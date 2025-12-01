const fetch = require('node-fetch');
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const router = express.Router();
const User = require("../models/User");
const nodemailer = require("nodemailer"); // only if USE_SMTP=true

const FRONT_BASE = process.env.APP_BASE_URL || `https://localhost:5443`;
console.log(
  "SMTP_USER present?",
  !!process.env.SMTP_USER,
  "SMTP_PASS present?",
  !!process.env.SMTP_PASS
);

// SMTP transporter (used only if USE_SMTP=true)
function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.mailersend.net",
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    requireTLS: true,
    auth: {
      user: process.env.SMTP_USER || process.env.SMTP_USERNAME,
      pass: process.env.SMTP_PASS
    }
  });
}

// Unified sendEmail wrapper (API default)
async function sendEmail({ toEmail, toName, subject, html, text }) {
  if (process.env.USE_SMTP === "true") {
    const t = createTransporter();
    await t.sendMail({
      from:
        (process.env.MAIL_FROM.match(/<(.*)>/)?.[1]) ||
        "noreply@test-p7kx4xwo7v8g9yjr.mlsender.net",
      to: `${toName || "User"} <${toEmail}>`,
      subject,
      html,
      text
    });
  }  else {
  const fromEmail =
    (process.env.MAIL_FROM.match(/<(.*)>/)?.[1]) ||
    "noreply@test-p7kx4xwo7v8g9yjr.mlsender.net";

  // Add this line to confirm token is loaded
  console.log(
    'Bearer present?',
    !!process.env.MAILERSEND_API_TOKEN,
    'len',
    (process.env.MAILERSEND_API_TOKEN || '').length
  );

  const res = await fetch("https://api.mailersend.com/v1/email", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.MAILERSEND_API_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: { email: fromEmail, name: "Login System" },
      to: [{ email: toEmail, name: toName || "User" }],
      subject,
      text: text || "",
      html: html || ""
    })
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`MailerSend API ${res.status}: ${err}`);
  }
}
}
async function sendConfirmEmail(to, yesLink, noLink) {
  const html = `
    <div style="font-family:Segoe UI,Arial,sans-serif">
      <h2>Someone is trying to change your password</h2>
      <p>If this was you, click Yes to continue. If not, click No to stop it.</p>
      <p>
        <a href="${yesLink}" style="background:#1a73e8;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;margin-right:8px;display:inline-block">Yes, it's me</a>
        <a href="${noLink}"  style="background:#eee;color:#111;padding:10px 16px;border-radius:6px;text-decoration:none;display:inline-block">No, it's not me</a>
      </p>
      <p>This link expires in 15 minutes.</p>
    </div>`;
  await sendEmail({
    toEmail: to,
    toName: "User",
    subject: "Confirm password reset",
    html,
    text: `Yes: ${yesLink}\nNo: ${noLink}`
  });
}

async function sendChangedEmail(to) {
  await sendEmail({
    toEmail: to,
    toName: "User",
    subject: "Password changed",
    html: "<p>Your password was updated successfully.</p>",
    text: "Your password was updated successfully."
  });
}

// Username availability
router.get("/check-username", async (req, res) => {
  try {
    const u = String(req.query.u || "").trim();
    if (!u) return res.json({ taken: false });
    const exists = await User.exists({ username: u });
    return res.json({ taken: !!exists });
  } catch {
    return res.status(500).json({ message: "Check failed" });
  }
});

// Signup
router.post("/signup", async (req, res) => {
  try {
    const { name, email, username, password } = req.body || {};
    if (!name || !email || !username || !password)
      return res.status(400).json({ message: "All fields required" });

    const e = String(email).trim().toLowerCase();
    const u = String(username).trim();

    if (!/^[A-Za-z0-9]{3,20}$/.test(u))
      return res.status(400).json({ message: "Invalid username format" });

    const strong =
      password.length >= 8 &&
      /^[A-Z]/.test(password) &&
      /[A-Za-z]/.test(password) &&
      /\d/.test(password) &&
      /[^A-Za-z0-9]/.test(password);
    if (!strong) return res.status(400).json({ message: "Password rules fail" });

    const conflict = await User.findOne({ $or: [{ email: e }, { username: u }] });
    if (conflict)
      return res
        .status(409)
        .json({ message: "Email or username already exists" });

    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name: String(name).trim(),
      email: e,
      username: u,
      passwordHash: hash,
      status: "pending",
      role: "user"
    });

    return res.status(201).json({
      ok: true,
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        status: user.status
      }
    });
  } catch {
    return res.status(500).json({ message: "Signup failed" });
  }
});

// Admin approve
// Admin approve
// Admin approve
  router.patch("/approve/:id", async (req, res) => {
  try {
    const id = String(req.params.id || "").trim();
    console.log("APPROVE HIT id =", JSON.stringify(id));
   // <-- add

    const user = await User.findByIdAndUpdate(
      id,
      { $set: { status: "approved" } },
      { new: true }
    );

    if (!user) {
      console.log("APPROVE: user not found");
      return res.status(404).json({ message: "User not found" });
    }

    return res.json({
      ok: true,
      user: { id: user._id, email: user.email, status: user.status }
    });
  } catch (err) {
    console.error("APPROVE ERROR:", err);   // <-- add
    return res.status(500).json({ message: "Approve failed" });
  }
});

// Login
router.post("/login", async (req, res) => {
  try {
    const { email, username, password } = req.body || {};
    if ((!email && !username) || !password)
      return res
        .status(400)
        .json({ message: "Email/username and password required" });

    let user;
    if (email) {
      const e = String(email).trim().toLowerCase();
      user = await User.findOne({ email: e });
    } else if (username) {
      const u = String(username).trim();
      user = await User.findOne({ username: u });
    }
    if (!user) return res.status(404).json({ ok: false, message: "User not found" });

    const ok = await bcrypt.compare(password, user.passwordHash || "");
    if (!ok) return res.status(401).json({ ok: false, message: "Invalid password" });

    if (user.status !== "approved")
      return res
        .status(403)
        .json({ ok: false, message: "Account awaiting admin approval" });

    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET || "dev_secret",
      { expiresIn: "1d" }
    );

    res.json({
      ok: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        status: user.status,
        role: user.role
      }
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ ok: false, message: "Login failed" });
  }
});

// Forgot
router.post("/forgot", async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ message: "Email required" });

    const e = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: e });
    if (user) {
      const cToken = jwt.sign(
        { kind: "confirm", id: user._id, email: e },
        process.env.JWT_SECRET || "dev_secret",
        { expiresIn: "15m" }
      );
      const HOST_BASE = process.env.HOST_BASE || `https://localhost:5443`;
      const yesLink = `${HOST_BASE}/api/auth/forgot-confirm-oneTap?token=${encodeURIComponent(
        cToken
      )}&allow=true`;
      const noLink = `${HOST_BASE}/api/auth/forgot-confirm-oneTap?token=${encodeURIComponent(
        cToken
      )}&allow=false`;
      await sendConfirmEmail(e, yesLink, noLink);
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error("Forgot error:", err && err.code, err && err.message);
    return res.status(500).json({ message: "Failed to start reset" });
  }
});

// Confirm via POST
router.post("/forgot-confirm", async (req, res) => {
  try {
    const { token, allow } = req.body || {};
    if (!token) return res.status(400).json({ message: "Token required" });
    const p = jwt.verify(token, process.env.JWT_SECRET || "dev_secret");
    if (p.kind !== "confirm")
      return res.status(400).json({ message: "Invalid token" });

    const user = await User.findById(p.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (!allow) {
      user.resetPermitUntil = 0;
      await user.save();
      return res.json({ ok: true, cancelled: true });
    }
    user.resetPermitUntil = Date.now() + 15 * 60 * 1000;
    await user.save();
    return res.json({ ok: true, permittedUntil: user.resetPermitUntil });
  } catch {
    return res.status(400).json({ message: "Invalid or expired link" });
  }
});

// Confirm via GET (email buttons)
router.get("/forgot-confirm-oneTap", async (req, res) => {
  try {
    const { token, allow } = req.query;
    if (!token) return res.status(400).send("Token required");
    const p = jwt.verify(token, process.env.JWT_SECRET || "dev_secret");
    if (p.kind !== "confirm") return res.status(400).send("Invalid token");

    const user = await User.findById(p.id);
    if (!user) return res.status(404).send("User not found");

    if (String(allow) !== "true") {
      return res.redirect(`${FRONT_BASE}/index.html`);
    }

    const rToken = jwt.sign(
      { kind: "pwd", id: user._id },
      process.env.JWT_SECRET || "dev_secret",
      { expiresIn: "15m" }
    );

    return res.redirect(
      `${FRONT_BASE}/reset.html?token=${encodeURIComponent(rToken)}`
    );
  } catch {
    return res.status(400).send("Invalid or expired link");
  }
});

// Issue reset after confirm
router.post("/issue-reset", async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ message: "Email required" });
    const e = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: e });
    if (!user) return res.status(404).json({ message: "User not found" });
    if (!user.resetPermitUntil || user.resetPermitUntil < Date.now())
      return res.status(403).json({ message: "Confirmation required" });

    const token = jwt.sign(
      { kind: "pwd", id: user._id },
      process.env.JWT_SECRET || "dev_secret",
      { expiresIn: "15m" }
    );
    user.resetPermitUntil = 0;
    await user.save();
    res.json({ ok: true, token });
  } catch {
    res.status(500).json({ message: "Failed to issue reset token" });
  }
});

// Reset final
router.post("/reset", async (req, res) => {
  try {
    const { token, password } = req.body || {};
    if (!token || !password)
      return res.status(400).json({ message: "Invalid request" });

    const strong =
      password.length >= 8 &&
      /^[A-Z]/.test(password) &&
      /[A-Za-z]/.test(password) &&
      /\d/.test(password) &&
      /[^A-Za-z0-9]/.test(password);
    if (!strong)
      return res.status(400).json({ message: "Password rules fail" });

    const p = jwt.verify(token, process.env.JWT_SECRET || "dev_secret");
    if (p.kind !== "pwd")
      return res.status(400).json({ message: "Invalid token" });

    const user = await User.findById(p.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const hash = await bcrypt.hash(password, 10);
    user.passwordHash = hash;
    await user.save();

    try {
      await sendChangedEmail(user.email);
    } catch {}
    res.json({ ok: true });
  } catch {
    res.status(400).json({ message: "Invalid or expired token" });
  }
});
router.get('/debug/fetch', async (_req, res) => {
  try {
    const r = await fetch('https://httpbin.org/status/204');
    res.json({ ok: true, status: r.status });
  } catch (e) {
    res.status(500).json({ ok: false, err: String(e) });
  }
});


module.exports = router;
