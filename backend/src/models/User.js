const mongoose = require("mongoose");

// Trong file User.js
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ["student", "teacher", "admin"], required: true },
  name: { type: String, required: true },
  avatar: { type: String },
  subjects: [{ type: String }],
  className: { type: String, default: "" },
}, { timestamps: true });

userSchema.virtual('avatarUrl').get(function() {
  return this.avatar ? `/uploads/${this.avatar}` : null;
});

userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model("User", userSchema, "user");
