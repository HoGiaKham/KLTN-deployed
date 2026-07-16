const mongoose = require("mongoose");

const testExamAttemptSchema = new mongoose.Schema(
  {
    exam: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Exam",
      required: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    answers: {
      type: Map,
      of: Number,
      default: {},
    },
    shuffleMappings: {  // ✅ NEW: Lưu shuffle mapping cho mỗi câu
      type: Map,
      of: Object,  // { "questionId": { "0": 2, "1": 0, ... } }
      default: {},
    },
    questionOrder: [  // ✅ NEW: Lưu thứ tự câu hỏi đã shuffle (để xem lại giống lúc làm)
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Question"
      }
    ],
    optionOrder: {  // ✅ NEW: Lưu thứ tự options đã shuffle cho mỗi câu
      type: Map,
      of: Object,  // { "questionId": { "0": 2, "1": 0, ... } }
      default: {},
    },
    score: {
      type: Number,
      required: true,
    },
    totalPoints: {
      type: Number,
      required: true,
    },
    percentage: {
      type: Number,
      default: 0,
    },
    scoreOut10: {  // ✅ NEW: Điểm hệ 10
      type: Number,
      default: 0,
    },
    correctCount: {  // ✅ NEW: Số câu đúng
      type: Number,
      default: 0,
    },
    totalQuestions: {  // ✅ NEW: Tổng số câu
      type: Number,
      default: 0,
    },
    isPassed: {
      type: Boolean,
      default: false,
    },
    timeSpent: {
      type: Number,
      default: 0,
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// 🔒 Unique: Không cho phép sinh viên làm 2 lần cùng 1 exam
testExamAttemptSchema.index({ exam: 1, student: 1 }, { unique: true });

module.exports = mongoose.model("TestExamAttempt", testExamAttemptSchema);