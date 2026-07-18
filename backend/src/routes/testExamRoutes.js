const express = require('express');
const router = express.Router();
const Exam = require('../models/Exam');
const Question = require('../models/Question');
const TestExamAttempt = require('../models/TestExamAttempt');
const Category = require('../models/Category');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const moment = require('moment-timezone');
const claudeAIService = require('../services/claudeAIService');

const parseVietnamDatetimeLocalToUTC = (dateTimeString) => {
  if (!dateTimeString) return null;
  return moment.tz(dateTimeString, 'YYYY-MM-DDTHH:mm', 'Asia/Ho_Chi_Minh').utc().toDate();
};

// Cấu hình multer để upload ảnh
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// ✅ HELPER: Tính closeTime = openTime + duration + bufferTime
const calculateCloseTime = (openTime, duration, bufferTime = 5) => {
  if (!openTime || !duration) return null;
  const close = new Date(openTime);
  close.setMinutes(close.getMinutes() + duration + bufferTime);
  return close;
};

// Helper: Parse datetime-local string (Vietnam time) and convert to UTC
// Input: "2025-01-15T10:30" (Vietnam) -> Output: UTC Date (2025-01-15T03:30Z)
// Subtract 7 hours to convert from Vietnam local time to UTC
// ✅ HELPER: Kiểm tra đề có được phép chỉnh sửa không (draft + chưa tới openTime)
const canEditExam = (exam) => {
  // ✅ Nếu đã publish → không thể sửa
  if (exam.status === 'published') return false;
  
  // ✅ Nếu draft nhưng tới openTime → không thể sửa
  if (exam.openTime) {
    const now = new Date();
    return now < new Date(exam.openTime);
  }
  return true;
};

// ✅ HELPER: Kiểm tra có thể xóa không (draft hoặc published + chưa tới openTime)
const canDeleteExam = (exam) => {
  // ✅ Draft luôn xóa được
  if (exam.status === 'draft') return true;
  
  // ✅ Published: xóa được nếu chưa tới openTime
  if (exam.openTime) {
    const now = new Date();
    return now < new Date(exam.openTime);
  }
  return false;
};

// ==================== 🔒 KIỂM TRA SINH VIÊN ĐÃ LÀM BÀI CHƯA ====================

/**
 * 🔒 GET /:examId/check-attempt?studentId=xxx
 * Kiểm tra xem sinh viên đã làm bài kiểm tra này chưa
 */
router.get("/:examId/check-attempt", async (req, res) => {
  try {
    const { examId } = req.params;
    const studentId = req.query.studentId;

    if (!studentId) {
      return res.status(400).json({ error: "Thiếu thông tin sinh viên" });
    }

    // ✅ FIX: Validate examId và studentId là ObjectId
    if (!mongoose.Types.ObjectId.isValid(examId)) {
      console.warn(`⚠️ Invalid examId: ${examId}`);
      return res.json({ hasAttempted: false });
    }

    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      console.warn(`⚠️ Invalid studentId: ${studentId}`);
      return res.json({ hasAttempted: false });
    }

    const attempt = await TestExamAttempt.findOne({
      exam: examId,
      student: studentId,
    }).sort({ submittedAt: -1 });

    if (attempt) {
      return res.json({
        hasAttempted: true,
        score: attempt.score,
        totalPoints: attempt.totalPoints,
        percentage: attempt.percentage,
        submittedAt: attempt.submittedAt,
        isPassed: attempt.isPassed,
      });
    }

    res.json({ hasAttempted: false });
  } catch (err) {
    console.error("❌ Error checking exam attempt:", err);
    res.status(500).json({ error: err.message });
  }
});

// ==================== 📤 NỘP BÀI - KIỂM TRA 1 LẦN LÀM ====================

/**
 * 🔒 POST /:examId/submit
 * Nộp bài - Lưu kết quả + Block lần 2
 */
router.post("/:examId/submit", async (req, res) => {
  try {
    const { examId } = req.params;
    const { answers, timeSpent, studentId, shuffleMappings, questionOrder, optionOrder } = req.body; // ✅ NEW: Accept optionOrder

    if (!studentId) {
      return res.status(400).json({ error: "Thiếu thông tin sinh viên" });
    }

    // 1. Check xem sinh viên đã làm bài này chưa
    const existingAttempt = await TestExamAttempt.findOne({
      exam: examId,
      student: studentId,
    });

    if (existingAttempt) {
      return res.status(400).json({
        error: "Bạn đã hoàn thành bài kiểm tra này. Mỗi sinh viên chỉ được phép làm 1 lần.",
      });
    }

    // 2. Lấy thông tin đề thi
    const exam = await Exam.findById(examId).populate("questions.questionId");

    if (!exam) {
      return res.status(404).json({ error: "Không tìm thấy đề thi" });
    }

    if (!exam.questions || exam.questions.length === 0) {
      return res.status(400).json({ error: "Đề thi không có câu hỏi" });
    }

    // 3. Tính điểm
    let score = 0;
    let totalPoints = 0;
    let correctCount = 0; // ✅ NEW: Count số câu đúng

    // ✅ FIX: Lọc bỏ các câu hỏi null trước khi tính điểm
    exam.questions
      .filter(q => q && q.questionId) // ✅ Bỏ qua nếu questionId là null/undefined
      .forEach((q) => {
        const question = q.questionId;
        const userAnswer = answers[question._id];
        const correctAnswer = question.originalCorrectAnswer !== undefined
          ? question.originalCorrectAnswer
          : question.correctAnswer;

        totalPoints += q.points || 1;

        if (userAnswer === correctAnswer) {
          correctCount++; // ✅ NEW: Tăng số câu đúng
          score += q.points || 1;
        }
      });

    const percentage = totalPoints > 0 ? (score / totalPoints) * 100 : 0;
    const percentageOut10 = percentage / 10; // ✅ NEW: Convert to 10-point scale
    const isPassed = percentage >= (exam.passingScore || 50);

    // 4. Lưu kết quả vào database
    const scoreOut10 = parseFloat((score / totalPoints * 10).toFixed(2)); // ✅ NEW: Calculate 10-point score
    const attempt = new TestExamAttempt({
      exam: examId,
      student: studentId,
      answers,
      shuffleMappings: shuffleMappings || {}, // ✅ NEW: Store shuffle mappings
      questionOrder: questionOrder || [], // ✅ NEW: Store question order for consistent review
      optionOrder: optionOrder || {}, // ✅ NEW: Store option order for consistent review
      score: parseFloat(score.toFixed(2)),
      totalPoints: parseFloat(totalPoints.toFixed(2)),
      percentage: parseFloat(percentage.toFixed(2)),
      scoreOut10, // ✅ NEW: Store 10-point score
      correctCount, // ✅ NEW: Store correct count
      totalQuestions: exam.questions.length, // ✅ NEW: Store total questions
      isPassed,
      timeSpent,
      submittedAt: new Date(),
    });

    await attempt.save();

    // 5. Update danh sách sinh viên đã làm bài
    await Exam.findByIdAndUpdate(
      examId,
      { $addToSet: { attemptedBy: studentId } },
      { new: true }
    );

    // 6. Trả về kết quả
    res.json({
      success: true,
      correctCount, // ✅ NEW: Số câu đúng
      totalQuestions: exam.questions.length, // ✅ NEW: Tổng số câu
      score,
      totalPoints,
      earnedPoints: score.toFixed(2),
      percentage: percentage.toFixed(2),
      percentageOut10: percentageOut10.toFixed(2), // ✅ NEW: Điểm hệ 10
      scoreOut10: (score / totalPoints * 10).toFixed(2), // ✅ NEW: Điểm hệ 10 (từ points)
      isPassed,
      message: isPassed
        ? "Chúc mừng! Bạn đã đạt yêu cầu"
        : "Bạn chưa đạt yêu cầu",
    });
  } catch (err) {
    console.error("Error submitting exam:", err);
    res.status(500).json({ error: err.message });
  }
});

// ==================== 📊 LẤY KẾT QUẢ SINH VIÊN ====================

/**
 * GET /:examId/my-result?studentId=xxx
 * Lấy kết quả của sinh viên
 */
router.get("/:examId/my-result", async (req, res) => {
  try {
    const { examId } = req.params;
    const studentId = req.query.studentId;

    if (!studentId) {
      return res.status(400).json({ error: "Thiếu thông tin sinh viên" });
    }

    const attempt = await TestExamAttempt.findOne({
      exam: examId,
      student: studentId,
    });

    if (!attempt) {
      return res.json({ hasAttempted: false });
    }

    // ✅ FIX: Convert MongoDB Map to plain object
    let answersObj = {};
    if (attempt.answers) {
      if (attempt.answers instanceof Map) {
        answersObj = Object.fromEntries(attempt.answers);
      } else if (typeof attempt.answers === 'object') {
        answersObj = attempt.answers;
      }
    }

    // ✅ NEW: Convert shuffleMappings to plain object
    let shuffleMappingsObj = {};
    if (attempt.shuffleMappings) {
      if (attempt.shuffleMappings instanceof Map) {
        shuffleMappingsObj = Object.fromEntries(attempt.shuffleMappings);
      } else if (typeof attempt.shuffleMappings === 'object') {
        shuffleMappingsObj = attempt.shuffleMappings;
      }
    }

    // ✅ NEW: Convert optionOrder to plain object
    let optionOrderObj = {};
    if (attempt.optionOrder) {
      if (attempt.optionOrder instanceof Map) {
        optionOrderObj = Object.fromEntries(attempt.optionOrder);
      } else if (typeof attempt.optionOrder === 'object') {
        optionOrderObj = attempt.optionOrder;
      }
    }

    res.json({
      hasAttempted: true,
      score: attempt.score,
      totalPoints: attempt.totalPoints,
      percentage: attempt.percentage,
      scoreOut10: attempt.scoreOut10, // ✅ NEW: Return 10-point score
      correctCount: attempt.correctCount, // ✅ NEW: Return correct count
      totalQuestions: attempt.totalQuestions, // ✅ NEW: Return total questions
      isPassed: attempt.isPassed,
      submittedAt: attempt.submittedAt,
      answers: answersObj, // ✅ Trả về answers dạng plain object
      shuffleMappings: shuffleMappingsObj, // ✅ NEW: Trả về shuffle mappings
      questionOrder: attempt.questionOrder || [], // ✅ NEW: Trả về thứ tự câu đã shuffle
      optionOrder: optionOrderObj, // ✅ NEW: Trả về thứ tự options đã shuffle
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /:examId/my-result-detailed?studentId=xxx
 * Lấy chi tiết kết quả với điểm từng câu
 */
router.get("/:examId/my-result-detailed", async (req, res) => {
  try {
    const { examId } = req.params;
    const studentId = req.query.studentId;

    if (!studentId) {
      return res.status(400).json({ error: "Thiếu thông tin sinh viên" });
    }

    // Lấy thông tin nộp bài (không dùng .lean() để giữ Map structure)
    const attempt = await TestExamAttempt.findOne({
      exam: examId,
      student: studentId,
    });

    if (!attempt) {
      return res.json({ hasAttempted: false });
    }

    // Lấy chi tiết exam + câu hỏi
    const exam = await Exam.findById(examId)
      .populate('questions.questionId', '_id title options correctAnswer')
      .lean();

    if (!exam) {
      return res.status(404).json({ error: "Exam not found" });
    }

    // Convert MongoDB Map to plain object for easier access
    // MongooseMap không thể dùng Object.fromEntries() trực tiếp
    // Phải convert qua toObject() trước
    let answersObj = {};

    try {
      if (attempt.toObject && typeof attempt.toObject === 'function') {
        // Cách tốt nhất: dùng toObject() của Mongoose document
        const attemptObj = attempt.toObject();
        answersObj = attemptObj.answers || {};
      } else if (attempt.answers instanceof Map) {
        // Nếu là Map bình thường
        answersObj = Object.fromEntries(attempt.answers);
      } else {
        // Nếu đã là object bình thường rồi
        answersObj = attempt.answers || {};
      }
    } catch (e) {
      console.error("Error converting answers:", e);
      answersObj = {};
    }

    const questionDetails = exam.questions.map((q, idx) => {
      const questionId = q.questionId._id.toString();

      // Truy cập MongooseMap bằng .get() method (không dùng bracket notation)
      let userAnswer;

      // Cách 1: Nếu answersObj là Map, dùng .get()
      if (answersObj instanceof Map || (answersObj.get && typeof answersObj.get === 'function')) {
        userAnswer = answersObj.get(questionId);
      } else if (typeof answersObj === 'object' && answersObj !== null) {
        // Cách 2: Nếu là object bình thường, dùng bracket notation
        userAnswer = answersObj[questionId];
      }

      const correctAnswer = q.questionId.correctAnswer;

      // Convert both to numbers for reliable comparison
      const userAnswerNum = userAnswer !== undefined && userAnswer !== null ? Number(userAnswer) : null;
      const correctAnswerNum = Number(correctAnswer);

      // Kiểm tra đúng/sai
      const isCorrect = userAnswerNum === correctAnswerNum && userAnswerNum !== null;
      const earnedPoints = isCorrect ? (q.points || 0) : 0;

      return {
        questionNum: idx + 1,
        questionId: questionId,
        title: q.questionId.title,
        options: q.questionId.options,
        userAnswer: userAnswerNum !== null ? userAnswerNum : null,
        correctAnswer: correctAnswerNum,
        isCorrect: isCorrect,
        points: q.points || 0,
        earnedPoints: earnedPoints,
        userAnswerLabel: userAnswerNum !== null
          ? String.fromCharCode(65 + userAnswerNum)
          : "Không trả lời",
        correctAnswerLabel: String.fromCharCode(65 + correctAnswerNum)
      };
    });

    res.json({
      hasAttempted: true,
      score: attempt.score,
      totalPoints: attempt.totalPoints,
      percentage: attempt.percentage,
      isPassed: attempt.isPassed,
      submittedAt: attempt.submittedAt,
      timeSpent: attempt.timeSpent,
      questions: questionDetails
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== 📊 THỐNG KÊ ĐỀ THI ====================
// GET /api/exams/teacher/:teacherId/subjects
router.get("/teacher/:teacherId/subjects", async (req, res) => {
  try {
    const { teacherId } = req.params;
    const exams = await Exam.find({ teacher: teacherId }).populate("subject");
    
    const summary = exams.reduce((acc, exam) => {
      const id = exam.subject._id.toString();
      acc[id] = (acc[id] || 0) + 1;
      return acc;
    }, {});

    const result = Object.entries(summary).map(([subject, count]) => ({
      subject,
      count
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
/**
 * GET /:examId/statistics
 * Thống kê tổng quan
 */
router.get("/:examId/statistics", async (req, res) => {
  try {
    const { examId } = req.params;

    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json({ error: "Không tìm thấy đề thi" });
    }

    const attempts = await TestExamAttempt.find({ exam: examId });

    if (attempts.length === 0) {
      return res.json({
        totalAttempts: 0,
        totalStudents: 0,
        averageScore: 0,
        passedCount: 0,
        failedCount: 0,
        passPercentage: 0,
      });
    }

    const passedCount = attempts.filter((a) => a.isPassed).length;
    const failedCount = attempts.filter((a) => !a.isPassed).length;
    const totalScores = attempts.reduce((sum, a) => sum + a.percentage, 0);
    const averageScore = totalScores / attempts.length;

    res.json({
      totalAttempts: attempts.length,
      totalStudents: attempts.length,
      averageScore: parseFloat(averageScore.toFixed(2)),
      passedCount,
      failedCount,
      passPercentage: parseFloat(
        ((passedCount / attempts.length) * 100).toFixed(2)
      ),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ LẤY DANH SÁCH ĐỀ THI PUBLISHED CHO SINH VIÊN
router.get("/student/published", async (req, res) => {
  try {
    const { studentClassId } = req.query;
    
    if (!studentClassId) {
      return res.status(400).json({ message: 'Thiếu studentClassId' });
    }

    const exams = await Exam.find({
      status: 'published',
      class: studentClassId
    })
      .populate('subject', 'name _id')
      .populate('categories', 'name _id')
      .populate('class', 'className')
      .sort({ openTime: -1 });
    
    console.log(`✅ Found ${exams.length} published exams for student in class ${studentClassId}`);
    res.json(exams);
  } catch (err) {
    console.error("❌ Error fetching student exams:", err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ LẤY CHI TIẾT ĐỀ THI CHO SINH VIÊN
router.get("/student/:examId/take", async (req, res) => {
  try {
    const { studentId } = req.query;
    
    console.log(`📝 Student attempting to take exam: ${req.params.examId}`);
    
    if (!mongoose.Types.ObjectId.isValid(req.params.examId)) {
      console.error("❌ Invalid exam ID");
      return res.status(400).json({ error: "Invalid exam ID" });
    }
    
    const exam = await Exam.findById(req.params.examId)
      .populate('subject', 'name _id')
      .populate('categories', 'name _id')
      .populate('class', 'name _id className')
      .populate({
        path: 'questions.questionId',
        model: 'Question'
        // ✅ REMOVED lean: false - Mongoose sẽ auto-include virtual fields khi populate
      });
    
    if (!exam) {
      console.error("❌ Exam not found");
      return res.status(404).json({ error: "Exam not found" });
    }
    
    console.log(`✅ Exam found: ${exam.title}`);
    
    if (exam.status !== 'published') {
      console.error("❌ Exam is not published");
      return res.status(403).json({ error: "Exam is not published" });
    }
    
    const now = new Date();
    if (exam.openTime && now < new Date(exam.openTime)) {
      console.error("❌ Exam has not started yet");
      return res.status(403).json({ error: "Exam has not started yet" });
    }
    
    // ✅ FIX: Lọc bỏ các câu hỏi null (nếu questionId không tồn tại)
    let examQuestions = exam.questions
      .filter(q => q && q.questionId) // ✅ Bỏ qua nếu questionId là null/undefined
      .map(q => ({
        _id: q._id,
        questionId: q.questionId,
        points: q.points
      }));

    if (exam.shuffleQuestions) {
      // ✅ FIX: Sử dụng studentId để seed random, mỗi student có order khác nhau
      // Nhưng cùng student reload lại vẫn có order giống nhau (consistency)
      const seed = studentId ? studentId.toString() : Math.random().toString();

      // Seeded random number generator (Fisher-Yates shuffle với seed)
      const seededShuffle = (arr) => {
        const result = [...arr];
        let seedNum = 0;

        // Tính toán seed từ studentId
        for (let i = 0; i < seed.length; i++) {
          seedNum += seed.charCodeAt(i);
        }

        // Fisher-Yates shuffle với seeded random
        for (let i = result.length - 1; i > 0; i--) {
          // Pseudo-random từ seed
          seedNum = (seedNum * 9301 + 49297) % 233280;
          const j = Math.floor((seedNum / 233280) * (i + 1));

          [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
      };

      examQuestions = seededShuffle(examQuestions);
      console.log(`🔀 Questions shuffled consistently for student: ${studentId}`);
    }

    if (exam.shuffleOptions) {
      const seed = studentId ? studentId.toString() : Math.random().toString();

      // Seeded random number generator cho shuffle options
      const seededShuffleOptions = (indices, seed) => {
        const result = [...indices];
        let seedNum = 0;

        // Tính toán seed từ studentId + questionId để mỗi câu có shuffle khác
        for (let i = 0; i < seed.length; i++) {
          seedNum += seed.charCodeAt(i);
        }

        // Fisher-Yates shuffle
        for (let i = result.length - 1; i > 0; i--) {
          seedNum = (seedNum * 9301 + 49297) % 233280;
          const j = Math.floor((seedNum / 233280) * (i + 1));
          [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
      };

      examQuestions = examQuestions.map((eq, qIndex) => {
        const question = eq.questionId;
        if (!question) return eq;

        const indices = question.options.map((_, idx) => idx);
        // ✅ FIX: Combine seed từ studentId + questionId + qIndex để mỗi student & mỗi câu & mỗi vị trí có shuffle khác
        const combinedSeed = seed + eq._id.toString() + qIndex.toString();
        const shuffledIndices = seededShuffleOptions(indices, combinedSeed);

        // ✅ FIX: Tạo mapping từ shuffled index sang original index
        const shuffleMapping = {};
        shuffledIndices.forEach((originalIdx, newIdx) => {
          shuffleMapping[newIdx] = originalIdx;
        });

        // ✅ FIX: Convert to plain object và include virtual fields
        let questionObj;
        if (question.toObject) {
          questionObj = question.toObject({ virtuals: true });
        } else {
          questionObj = question;
        }

        // ✅ FIX: Đảm bảo imageUrl được include (nếu virtual field không được include)
        if (!questionObj.imageUrl && questionObj.image) {
          questionObj.imageUrl = `/uploads/${questionObj.image}`;
        }

        return {
          ...eq,
          questionId: {
            ...questionObj,
            options: shuffledIndices.map(idx => question.options[idx]),
            correctAnswer: shuffledIndices.indexOf(question.correctAnswer),
            originalCorrectAnswer: question.correctAnswer,
            shuffleMapping: shuffleMapping // ✅ Gửi mapping về frontend
          }
        };
      });
      console.log(`🔀 Options shuffled consistently for student: ${studentId}`);
    } else {
      // ✅ FIX: Nếu không shuffle options, vẫn cần ensure virtual fields được include
      examQuestions = examQuestions.map(eq => {
        const question = eq.questionId;
        let questionObj;
        if (question.toObject) {
          questionObj = question.toObject({ virtuals: true });
        } else {
          questionObj = question;
        }

        // ✅ FIX: Đảm bảo imageUrl được include (nếu virtual field không được include)
        if (!questionObj.imageUrl && questionObj.image) {
          questionObj.imageUrl = `/uploads/${questionObj.image}`;
        }

        return {
          ...eq,
          questionId: questionObj
        };
      });
    }

    console.log(`✅ Returning exam with ${examQuestions.length} questions`);

    // ✅ DEBUG: Log imageUrl để kiểm tra
    examQuestions.forEach((eq, idx) => {
      if (eq.questionId && eq.questionId.image) {
        console.log(`📸 Question ${idx + 1}: image="${eq.questionId.image}", imageUrl="${eq.questionId.imageUrl}"`);
      }
    });

    // 🕐 Tính endTime từ server để tránh reset timer khi client reload
    const totalTime = (exam.duration || 60) + (exam.bufferTime || 5);
    const endTime = new Date(now.getTime() + totalTime * 60 * 1000);

    res.json({
      ...exam.toObject(),
      questions: examQuestions,
      serverTime: now, // Thời gian server hiện tại
      endTime: endTime // Thời gian kết thúc tính từ server
    });
  } catch (err) {
    console.error("❌ Error fetching exam for student:", err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ GET all exams
router.get('/', async (req, res) => {
  try {
    const { teacherId } = req.query;

    let filter = {};
    if (teacherId) {
      filter.createdBy = teacherId;
    }

    const exams = await Exam.find(filter)
      .populate('subject', 'name _id')
      .populate('categories', 'name _id')
      .populate('class', 'name _id className');

    // Đếm số lượng attempt (sinh viên đã làm bài) cho mỗi exam
    const examsWithAttemptCount = await Promise.all(
      exams.map(async (exam) => {
        const attemptCount = await TestExamAttempt.countDocuments({ exam: exam._id });
        return {
          ...exam.toObject(),
          attemptCount
        };
      })
    );

    console.log(`✅ Found ${exams.length} exams${teacherId ? ` for teacher ${teacherId}` : ''}`);
    res.json(examsWithAttemptCount);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ✅ POST create exam
router.post('/', async (req, res) => {
  try {
    // Convert datetime-local to UTC for storage
    const openTime = parseVietnamDatetimeLocalToUTC(req.body.openTime);

    let closeTime = null;
    if (openTime && req.body.duration) {
      closeTime = calculateCloseTime(openTime, req.body.duration, req.body.bufferTime || 5);
    }

    console.log(`📝 Creating exam with openTime: "${req.body.openTime}"`);
    console.log(`   Parsed as UTC: ${openTime}`);
    console.log(`   ISO format: ${openTime ? openTime.toISOString() : 'null'}`);

    const examData = {
      ...req.body,
      openTime,
      closeTime,
      maxAttempts: 1,
      status: 'draft',
      shuffleQuestions: true,
      shuffleOptions: true,
      createdBy: req.body.createdBy,
      bufferTime: req.body.bufferTime || 5
    };

    const exam = new Exam(examData);
    await exam.save();
    console.log(`✅ Exam created: ${exam.title} (status=draft)`);
    console.log(`   openTime (raw): ${exam.openTime}`);
    console.log(`   openTime (ISO): ${exam.openTime ? exam.openTime.toISOString() : 'null'}`);
    console.log(`   closeTime: ${exam.closeTime}`);
    console.log(`   duration: ${exam.duration} phút + bufferTime: ${exam.bufferTime} phút`);
    res.status(201).json(exam);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ==================== 🤖 TẠO ĐỀ THI AI ====================

/**
 * 🤖 POST /generate-ai-exam
 * Tạo đề thi mới dựa trên đề thi mẫu sử dụng Claude AI
 *
 * Request body:
 * {
 *   sourceExamId: string,        // ID đề thi mẫu
 *   title: string,                // Tên đề thi mới
 *   class: string,                // ID lớp học mới
 *   subject: string,              // ID môn học
 *   duration: number,             // Thời gian làm bài (phút)
 *   openTime: string,             // Thời gian mở đề (datetime-local)
 *   bufferTime: number,           // Thời gian dự phòng (phút)
 *   passingScore: number,         // Điểm đạt yêu cầu (%)
 *   description: string,          // Mô tả đề thi
 *   createdBy: string,            // ID giảng viên
 *   newCategoryName: string       // Tên danh mục mới cho câu hỏi AI
 * }
 */
router.post('/generate-ai-exam', async (req, res) => {
  try {
    const {
      sourceExamId,
      title,
      class: classId,
      subject: subjectId,
      duration,
      openTime: openTimeString,
      bufferTime,
      passingScore,
      description,
      createdBy,
      newCategoryName,
      showResultImmediately,
      showCorrectAnswers
    } = req.body;

    console.log('🤖 Starting AI exam generation...');
    console.log('📥 Request body:', req.body);
    console.log(`   Source exam: ${sourceExamId}`);
    console.log(`   New title: ${title}`);
    console.log(`   New category: ${newCategoryName}`);
    console.log(`   Class: ${classId}`);
    console.log(`   Subject: ${subjectId}`);
    console.log(`   CreatedBy: ${createdBy}`);

    // 1. Validate input
    if (!sourceExamId || !title || !classId || !subjectId || !createdBy || !newCategoryName) {
      const missing = [];
      if (!sourceExamId) missing.push('sourceExamId');
      if (!title) missing.push('title');
      if (!classId) missing.push('class');
      if (!subjectId) missing.push('subject');
      if (!createdBy) missing.push('createdBy');
      if (!newCategoryName) missing.push('newCategoryName');

      console.log('❌ Validation failed - Missing fields:', missing);
      return res.status(400).json({
        error: 'Thiếu thông tin bắt buộc',
        missing: missing
      });
    }

    // 2. Lấy đề thi mẫu
    const sourceExam = await Exam.findById(sourceExamId)
      .populate({
        path: 'questions.questionId',
        populate: { path: 'categoryId', select: 'name _id' }
      })
      .populate('categories', 'name _id')
      .populate('subject', 'name _id');

    if (!sourceExam) {
      return res.status(404).json({ error: 'Không tìm thấy đề thi mẫu' });
    }

    console.log(`   Found source exam: ${sourceExam.title}`);
    console.log(`   Number of questions: ${sourceExam.questions.length}`);

    // 3. Lấy danh sách câu hỏi từ đề mẫu (loại bỏ câu có ảnh)
    const allQuestions = sourceExam.questions.map(q => q.questionId);
    const textOnlyQuestions = allQuestions.filter(q => !q.image);
    const questionsWithImages = allQuestions.filter(q => q.image);

    if (questionsWithImages.length > 0) {
      console.log(`   ⚠️ Skipping ${questionsWithImages.length} questions with images`);
      console.log(`   ✅ Using ${textOnlyQuestions.length} text-only questions`);
    }

    const sampleQuestions = textOnlyQuestions.map(questionData => {
      return {
        title: questionData.title,
        options: questionData.options,
        correctAnswer: questionData.correctAnswer,
        difficulty: questionData.difficulty,
        categoryId: questionData.categoryId,
      };
    });

    if (sampleQuestions.length === 0) {
      return res.status(400).json({
        error: 'Đề thi mẫu không có câu hỏi text nào (tất cả đều có ảnh). AI chỉ có thể tạo câu hỏi từ câu hỏi text.'
      });
    }

    // 4. Tạo danh mục mới cho câu hỏi AI
    console.log(`   Creating new category: ${newCategoryName}`);
    const newCategory = new Category({
      name: newCategoryName,
      description: `Danh mục câu hỏi AI được tạo từ đề thi: ${sourceExam.title}`,
      subjectId: subjectId,
      createdBy: createdBy,
    });
    await newCategory.save();
    console.log(`   ✅ Category created: ${newCategory._id}`);

    // 5. Gọi Claude AI để tạo câu hỏi mới
    console.log('   🤖 Calling Claude AI to generate questions...');
    const generatedQuestions = await claudeAIService.generateQuestions(
      sampleQuestions,
      {
        numberOfQuestions: sampleQuestions.length,
        subject: sourceExam.subject?.name || 'Chưa xác định',
        categories: sourceExam.categories || [],
      }
    );

    console.log(`   ✅ AI generated ${generatedQuestions.length} questions`);

    // 6. Lưu câu hỏi mới vào database
    const savedQuestions = [];
    for (let i = 0; i < generatedQuestions.length; i++) {
      const gq = generatedQuestions[i];
      const newQuestion = new Question({
        title: gq.title,
        options: gq.options,
        correctAnswer: gq.correctAnswer,
        difficulty: gq.difficulty,
        categoryId: newCategory._id,
      });
      await newQuestion.save();
      savedQuestions.push(newQuestion);
      console.log(`   ✅ Saved question ${i + 1}/${generatedQuestions.length}`);
    }

    // 7. Tạo đề thi mới với câu hỏi AI
    const openTime = parseVietnamDatetimeLocalToUTC(openTimeString);
    let closeTime = null;
    if (openTime && duration) {
      closeTime = calculateCloseTime(openTime, duration, bufferTime || 5);
    }

    const newExamData = {
      title,
      subject: subjectId,
      categories: [newCategory._id],
      class: classId,
      duration: duration || sourceExam.duration,
      bufferTime: bufferTime || sourceExam.bufferTime || 5,
      openTime,
      closeTime,
      maxAttempts: 1,
      showResultImmediately: showResultImmediately !== undefined ? showResultImmediately : sourceExam.showResultImmediately,
      showCorrectAnswers: showCorrectAnswers !== undefined ? showCorrectAnswers : sourceExam.showCorrectAnswers,
      passingScore: passingScore || sourceExam.passingScore,
      shuffleQuestions: true,
      shuffleOptions: true,
      status: 'draft',
      createdBy,
      description: description || `Đề thi AI được tạo từ: ${sourceExam.title}`,
      questions: savedQuestions.map(q => ({
        questionId: q._id,
        points: 100 / savedQuestions.length,
      })),
    };

    const newExam = new Exam(newExamData);
    await newExam.save();

    console.log(`✅ AI Exam created successfully: ${newExam.title}`);
    console.log(`   Exam ID: ${newExam._id}`);
    console.log(`   Category ID: ${newCategory._id}`);
    console.log(`   Total questions: ${savedQuestions.length}`);

    // 8. Populate và trả về
    const populatedExam = await Exam.findById(newExam._id)
      .populate('subject', 'name _id')
      .populate('categories', 'name _id')
      .populate('class', 'name _id className')
      .populate({
        path: 'questions.questionId',
        populate: { path: 'categoryId', select: 'name _id' }
      });

    res.status(201).json({
      success: true,
      message: 'Tạo đề thi AI thành công',
      exam: populatedExam,
      newCategory: {
        _id: newCategory._id,
        name: newCategory.name,
      },
      questionsGenerated: savedQuestions.length,
      sourceQuestionsTotal: allQuestions.length,
      sourceQuestionsWithImages: questionsWithImages.length,
      sourceQuestionsUsed: textOnlyQuestions.length,
    });

  } catch (err) {
    console.error('❌ Error generating AI exam:', err);
    console.error('❌ Error stack:', err.stack);
    res.status(500).json({
      error: 'Lỗi khi tạo đề thi AI',
      message: err.message,
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// GET exam by id
router.get('/:id', async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id)
      .populate('subject', 'name _id')
      .populate('categories', 'name _id')
      .populate('class', 'name _id className')
      .populate({
        path: 'questions.questionId',
        // ✅ Note: imageUrl sẽ auto-generate từ image field (virtual field)
        populate: { path: 'categoryId', select: 'name _id' }
      });
    if (!exam) return res.status(404).json({ message: 'Exam not found' });

    console.log(`📋 GET exam ${req.params.id}:`);
    console.log(`   openTime (DB): ${exam.openTime}`);
    console.log(`   openTime (ISO): ${exam.openTime ? exam.openTime.toISOString() : 'null'}`);

    // ✅ NEW: Ensure virtuals are included (imageUrl)
    res.json(exam.toObject ? exam.toObject({ virtuals: true }) : exam);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ✅ PUT update exam
router.put('/:id', async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) return res.status(404).json({ message: 'Exam not found' });

    if (!canEditExam(exam)) {
      return res.status(403).json({ message: 'Không thể chỉnh sửa đề thi này' });
    }

    let closeTime = exam.closeTime;
    const newOpenTime = parseVietnamDatetimeLocalToUTC(req.body.openTime) || exam.openTime;
    const newDuration = req.body.duration || exam.duration;
    const newBufferTime = req.body.bufferTime !== undefined ? req.body.bufferTime : exam.bufferTime || 5;

    console.log(`✏️ Updating exam with openTime: "${req.body.openTime}"`);
    console.log(`   Parsed as UTC: ${newOpenTime}`);
    console.log(`   ISO format: ${newOpenTime ? newOpenTime.toISOString() : 'null'}`);

    if (newOpenTime || newDuration) {
      closeTime = calculateCloseTime(newOpenTime, newDuration, newBufferTime);
    }

    // Create updateData WITHOUT spreading req.body to avoid overwriting processed values
    const updateData = {
      title: req.body.title,
      subject: req.body.subject,
      categories: req.body.categories,
      class: req.body.class,
      duration: req.body.duration,
      showResultImmediately: req.body.showResultImmediately,
      showCorrectAnswers: req.body.showCorrectAnswers,
      passingScore: req.body.passingScore,
      description: req.body.description,
      openTime: newOpenTime,
      closeTime,
      bufferTime: newBufferTime,
      maxAttempts: 1,
      shuffleQuestions: true,
      shuffleOptions: true
    };

    const updatedExam = await Exam.findByIdAndUpdate(req.params.id, updateData, { new: true });

    console.log(`✅ Exam updated: ${updatedExam.title}`);
    console.log(`   closeTime recalculated: ${updatedExam.closeTime}`);
    console.log(`   bufferTime: ${updatedExam.bufferTime} phút`);
    res.json(updatedExam);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE exam
router.delete('/:id', async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) return res.status(404).json({ message: 'Exam not found' });

    if (!canDeleteExam(exam)) {
      console.log(`❌ Exam locked - cannot delete`);
      return res.status(403).json({ message: 'Không thể xóa đề thi này' });
    }

    await Exam.findByIdAndDelete(req.params.id);
    console.log(`✅ Exam deleted: ${exam.title}`);
    res.json({ message: 'Exam deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ✅ PATCH publish exam
router.patch('/:id/publish', async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) return res.status(404).json({ message: 'Exam not found' });

    if (exam.status !== 'draft') {
      return res.status(400).json({ message: 'Chỉ có thể xuất đề draft' });
    }

    const updatedExam = await Exam.findByIdAndUpdate(
      req.params.id,
      { status: 'published' },
      { new: true }
    );
    
    console.log(`✅ Exam published: ${updatedExam.title}`);
    res.json(updatedExam);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET questions in exam
router.get('/:id/questions', async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id).populate({
      path: 'questions.questionId',
      // ✅ Note: imageUrl sẽ auto-generate từ image field (virtual field)
      populate: { path: 'categoryId', select: 'name _id' }
    });
    if (!exam) return res.status(404).json({ message: 'Exam not found' });
    res.json(exam.questions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ✅ POST add manual question
router.post('/:id/questions/manual', upload.single('image'), async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) return res.status(404).json({ message: 'Exam not found' });

    if (!canEditExam(exam)) {
      console.log(`❌ Exam locked - cannot add questions`);
      return res.status(403).json({ message: 'Không thể thêm câu hỏi vào đề thi này' });
    }

    const questionData = {
      title: req.body.title,
      options: JSON.parse(req.body.options || '[]'),
      correctAnswer: parseInt(req.body.correctAnswer) || 0,
      difficulty: req.body.difficulty || 'Trung bình',
      categoryId: exam.categories[0],
      // ✅ FIX: Lưu vào field 'image' (không phải 'imageUrl')
      // Virtual field sẽ auto-convert image → imageUrl
      image: req.file ? req.file.filename : undefined
    };

    const question = new Question(questionData);
    await question.save();

    const totalPoints = 100;
    const newTotalQuestions = exam.questions.length + 1;
    const pointsPerQuestion = totalPoints / newTotalQuestions;

    exam.questions.push({ questionId: question._id, points: pointsPerQuestion });
    await exam.save();

    console.log(`✅ Question added. New average points: ${pointsPerQuestion}`);
    res.status(201).json(question);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ✅ POST add bulk questions
router.post('/:id/questions/bulk', async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) return res.status(404).json({ message: 'Exam not found' });

    if (!canEditExam(exam)) {
      console.log(`❌ Exam locked - cannot add questions`);
      return res.status(403).json({ message: 'Không thể thêm câu hỏi vào đề thi này' });
    }

    const { questionIds } = req.body;
    if (!questionIds || !Array.isArray(questionIds)) {
      return res.status(400).json({ message: 'questionIds must be an array' });
    }

    const totalPoints = 100;
    const newTotalQuestions = exam.questions.length + questionIds.length;
    const pointsPerQuestion = totalPoints / newTotalQuestions;

    const newQuestions = questionIds.map(id => ({ 
      questionId: id, 
      points: pointsPerQuestion 
    }));
    
    exam.questions.push(...newQuestions);
    await exam.save();

    console.log(`✅ ${questionIds.length} questions added. New average points: ${pointsPerQuestion}`);
    res.status(201).json({ message: 'Questions added', pointsPerQuestion });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ✅ DELETE question from exam
router.delete('/:id/questions/:questionItemId', async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) return res.status(404).json({ message: 'Exam not found' });

    if (!canEditExam(exam)) {
      console.log(`❌ Exam locked - cannot delete questions`);
      return res.status(403).json({ message: 'Không thể xóa câu hỏi khỏi đề thi này' });
    }

    const questionItem = exam.questions.id(req.params.questionItemId);
    if (!questionItem) return res.status(404).json({ message: 'Question item not found' });

    // ✅ FIX: Dùng .pull() thay vì .remove() (Mongoose v6+)
    exam.questions.pull(req.params.questionItemId);

    const totalPoints = 100;
    const newTotalQuestions = exam.questions.length;
    if (newTotalQuestions > 0) {
      const pointsPerQuestion = totalPoints / newTotalQuestions;
      exam.questions.forEach(q => {
        q.points = pointsPerQuestion;
      });
    }

    await exam.save();

    console.log(`✅ Question removed. New average points recalculated`);
    res.json({ message: 'Question removed' });
  } catch (err) {
    console.error('❌ Error deleting question:', err);
    res.status(500).json({ message: err.message });
  }
});

// PATCH update question points
router.patch('/:id/questions/:questionItemId/points', async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) return res.status(404).json({ message: 'Exam not found' });

    const questionItem = exam.questions.id(req.params.questionItemId);
    if (!questionItem) return res.status(404).json({ message: 'Question item not found' });

    questionItem.points = parseFloat(req.body.points) || 1;
    await exam.save();

    res.json(questionItem);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET bank questions
router.get('/:id/bank-questions', async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id).populate('categories');
    if (!exam) return res.status(404).json({ message: 'Exam not found' });

    const categoryIds = exam.categories.map(c => c._id);
    const existingQuestionIds = exam.questions.map(q => q.questionId);

    const bankQuestions = await Question.find({
      categoryId: { $in: categoryIds },
      _id: { $nin: existingQuestionIds }
    }).populate('categoryId', 'name');

    console.log(`✅ Found ${bankQuestions.length} available questions`);
    res.json(bankQuestions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ✅ NEW: GET class list for teacher (từ teaching assignments)
router.get("/teacher/:teacherId/classes", async (req, res) => {
  try {
    const TeachingAssignment = require('../models/TeachingAssignment');
    const Class = require('../models/Class');

    // Lấy danh sách lớp mà giáo viên được phân công
    const assignments = await TeachingAssignment.find({
      teacher: req.params.teacherId
    }).populate('class').lean();

    // Lọc các lớp không null
    const classes = assignments
      .map(a => a.class)
      .filter(c => c !== null)
      .reduce((unique, c) => {
        // Tránh lớp trùng
        if (!unique.find(u => u._id.toString() === c._id.toString())) {
          unique.push(c);
        }
        return unique;
      }, []);

    res.json(classes);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ✅ NEW: GET student list và test exam scores in a class
router.get("/class/:classId/students-scores", async (req, res) => {
  try {
    const Class = require('../models/Class');
    const User = require('../models/User');

    // Lấy danh sách sinh viên trong lớp
    const classData = await Class.findById(req.params.classId)
      .populate('students', '_id username name')
      .lean();

    if (!classData) {
      return res.status(404).json({ message: "Class not found" });
    }

    const students = classData.students || [];

    // Lấy danh sách test exams của lớp (populate questions để có chi tiết)
    const exams = await Exam.find({ class: req.params.classId })
      .select('_id title questions')
      .populate('questions.questionId', '_id')
      .lean();

    // Lấy danh sách attempts
    const attempts = await TestExamAttempt.find({
      exam: { $in: exams.map(e => e._id) }
    })
      .populate('student', '_id username name')
      .populate('exam', '_id title')
      .lean();

    // Gom kết quả theo sinh viên
    const studentScores = students.map(student => {
      const studentAttempts = attempts.filter(
        a => a.student._id.toString() === student._id.toString()
      );

      return {
        studentId: student._id,
        studentName: student.name,
        studentUsername: student.username,
        attempts: studentAttempts.map(a => ({
          examId: a.exam._id,
          examTitle: a.exam.title,
          score: a.score,
          totalPoints: a.totalPoints,
          percentage: a.percentage,
          isPassed: a.isPassed,
          submittedAt: a.submittedAt,
          timeSpent: a.timeSpent
        }))
      };
    });

    res.json({
      className: classData.className,
      students: studentScores,
      exams: exams.map(e => ({
        _id: e._id,
        title: e.title,
        questions: e.questions || []
      }))
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;