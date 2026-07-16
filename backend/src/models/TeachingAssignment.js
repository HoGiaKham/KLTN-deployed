const mongoose = require("mongoose");

const TeachingAssignmentSchema = new mongoose.Schema(
  {
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      required: true,
    },
    class: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: false,
      default: null,
    },
    semester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Semester",
      required: true,        // BẮT BUỘC PHẢI CÓ
    },
  },
  { timestamps: true }
);

TeachingAssignmentSchema.index(
  { class: 1, subject: 1 },
  { 
    unique: true,
    partialFilterExpression: { class: { $ne: null } }
  }
);

module.exports = mongoose.model("TeachingAssignment", TeachingAssignmentSchema);