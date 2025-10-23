// models/User.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: { type: String, default: "User" },
  email: { type: String, unique: true, required: true },
  passwordHash: { type: String, required: true },
  role: { type: String, default: "user" },
  status: { type: String, enum: ["pending","approved"], default: "pending" }
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);
