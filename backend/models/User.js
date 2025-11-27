const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true, required: true, lowercase: true, trim: true },
  username: { type: String, unique: true, sparse: true, trim: true },
  passwordHash: String,
  status: { type: String, enum: ["pending", "approved"], default: "pending" },
  role: { type: String, enum: ["user", "admin"], default: "user" },
  resetPermitUntil: { type: Number, default: 0 }
});

module.exports = mongoose.model("User", UserSchema);
