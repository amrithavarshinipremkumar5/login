const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const router = express.Router();
const User = require("../models/User");

// Auth middleware (JWT)
const auth = (req, res, next) => {
  try{
    const h = req.headers.authorization || "";
    const token = h.startsWith("Bearer ") ? h.slice(7) : null;
    if(!token) return res.status(401).json({ message: "No token" });
    req.user = jwt.verify(token, process.env.JWT_SECRET || "dev_secret");
    next();
  }catch{
    return res.status(401).json({ message: "Invalid token" });
  }
};

// Admin-only middleware
const adminOnly = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin only" });
  }
  next();
};

// Signup
router.post("/signup", async (req, res) => {
  try {
    const { name = "User", email, password } = req.body;
    if(!email || !password) return res.status(400).json({ message: "Email and password required" });

    const exists = await User.findOne({ email });
    if(exists) return res.status(409).json({ message: "Email already registered" });

    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email,
      passwordHash: hash,
      status: "pending",
      role: "user"
    });

    res.status(201).json({ id: user._id, email: user.email, status: user.status });
  } catch (err) {
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Login
router.post("/login", async (req, res) => {
  try{
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if(!user) return res.status(401).json({ message: "Invalid credentials" });
    if(user.status !== "approved") return res.status(403).json({ message: "Account pending approval" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if(!ok) return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET || "dev_secret",
      { expiresIn: "1d" }
    );
    res.json({ token });
  }catch(err){
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Approve user (admin protected)
router.patch("/:userId/approve", auth, adminOnly, async (req, res) => {
  try{
    const { userId } = req.params;
    const user = await User.findByIdAndUpdate(userId, { status: "approved" }, { new: true });
    if(!user) return res.status(404).json({ message: "User not found" });
    res.json({ id: user._id, status: user.status });
  }catch(err){
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Current user info
router.get("/me", auth, (req, res) => {
  res.json({ id: req.user.id, email: req.user.email, role: req.user.role });
});

module.exports = router;
