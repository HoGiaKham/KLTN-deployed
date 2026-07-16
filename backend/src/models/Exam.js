const mongoose = require('mongoose');

const examQuestionSchema = new mongoose.Schema({
  questionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question',
    required: true
  },
  points: {
    type: Number,
    default: 1,
    min: 0
  }
});

const examSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  subject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
    required: true
  },
  categories: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  }],
  // ✅ NEW: Lớp học (để sinh viên biết làm bài nào)
  class: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class'
  },
  duration: {
    type: Number,
    default: 60,
    min: 1
  },
  bufferTime: {
    type: Number,
    default: 5,
    min: 0,
    description: "Thời gian dự phòng (phút) được cộng vào thời gian làm bài"
  },
  openTime: {
    type: Date
  },
  closeTime: {
    type: Date
    // closeTime = openTime + (duration + bufferTime) (tự động tính, không input)
  },
  maxAttempts: {
    type: Number,
    default: 1,
    min: 1
  },
  showResultImmediately: {
    type: Boolean,
    default: true
  },
  showCorrectAnswers: {
    type: Boolean,
    default: false
  },
  passingScore: {
    type: Number,
    default: 50,
    min: 0,
    max: 100
  },
  shuffleQuestions: {
    type: Boolean,
    default: true
  },
  shuffleOptions: {
    type: Boolean,
    default: true
  },
  status: {
    type: String,
    enum: ['draft', 'published'],
    default: 'draft'
    // ✅ CHANGE: draft mặc định (sau khi tạo là draft)
    // Chỉ published khi click "Xuất đề"
  },
  questions: [examQuestionSchema],
  
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  description: {
    type: String,
    default: ''
  },

  // ✅ THÊM 2 FIELD MỚI - Cho phép sinh viên xem lại
  canViewScore: {
    type: Boolean,
    default: false,  // Mặc định không cho xem điểm
  },
  canViewAnswer: {
    type: Boolean,
    default: false,  // Mặc định không cho xem đáp án
  },
}, {
  timestamps: true
});

module.exports = mongoose.model('Exam', examSchema);