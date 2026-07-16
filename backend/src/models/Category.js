const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // ⭐ Thêm field này
}, { timestamps: true });

module.exports = mongoose.model("Category", categorySchema);