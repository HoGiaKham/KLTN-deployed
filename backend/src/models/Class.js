const mongoose = require("mongoose");

const classSchema = new mongoose.Schema({
  className: { type: String, required: true },
  subject: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Subject",
    required: true, // Làm required để tránh lỗi
  },
  teacher: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User",
    default: null,
  },
  semester: {  // ⭐ Thêm field này
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Semester",
    required: true,
  },
  students: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  exams: [{ type: mongoose.Schema.Types.ObjectId, ref: "PracticeExam" }],
  maxStudents: { type: Number, default: 0 },
}, { timestamps: true });

// ✅ Cập nhật unique index: className + subject + semester
classSchema.index(
  { className: 1, subject: 1, semester: 1 },
  { unique: true }
);

module.exports = mongoose.model("Class", classSchema, "classes");