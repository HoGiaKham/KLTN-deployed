// routes/practiceExamRoutes.js
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

// === IMPORT CÁC MODEL ===
const PracticeExam = require("../models/PracticeExam");
const Question = require("../models/Question");
const Semester = require("../models/Semester");
const Class = require("../models/Class");
const TeachingAssignment = require("../models/TeachingAssignment");
const User = require("../models/User");
const multer = require("multer");
const upload = multer({ dest: "uploads/" });

const moment = require('moment-timezone');

router.get("/", async (req, res) => {
  try {
    const { userId, role } = req.query;
    let filter = {};

    if (role && role !== "admin") {
      const activeSemester = await Semester.findOne({ isActive: true });
      if (!activeSemester) return res.json([]);

      let classIds = [];

      if (role === "teacher" && userId) {
        const classes = await Class.find({ teacher: userId, semester: activeSemester._id });
        classIds = classes.map(c => c._id);
      } else if (role === "student" && userId) {
        const user = await User.findOne({ username: userId });
        if (!user) return res.status(404).json({ error: "Student not found" });
        const classes = await Class.find({ students: user._id, semester: activeSemester._id });
        classIds = classes.map(c => c._id);
      }

      if (classIds.length === 0) return res.json([]);
      filter.classes = { $in: classIds };
    }

    const exams = await PracticeExam.find(filter)
      .populate('subject', 'name')
      .populate('categories', 'name')
      .populate('classes', 'className')  // populate mảng classes
      .populate('teacher', 'name')
      .sort({ createdAt: -1 });

    // Debug log trước khi chuyển đổi múi giờ
    console.log("Exams retrieved from DB:", exams.map(exam => ({
      title: exam.title,
      openTime: exam.openTime,
      closeTime: exam.closeTime,
    })));

    // IMPORTANT: Don't convert to Asia/Ho_Chi_Minh here!
    // Frontend handles timezone display using UTC from ISO string
    // Sending timezone-converted times causes +7h offset bug on client side
    console.log("Exams sent to frontend (UTC format):", exams.map(exam => ({
      title: exam.title,
      openTime: exam.openTime?.toISOString?.(),
      closeTime: exam.closeTime?.toISOString?.(),
    })));

    res.json(exams);
  } catch (err) {
    console.error("Error fetching practice exams:", err);
    res.status(500).json({ error: err.message });
  }
});




// ============================
// GET: Lấy tất cả đề
// ============================
// router.get("/", async (req, res) => {
//   try {
//     const { userId, role } = req.query;
//     let filter = {};

//     if (role && role !== "admin") {
//       const activeSemester = await Semester.findOne({ isActive: true });
//       if (!activeSemester) return res.json([]);

//       let classIds = [];

//       if (role === "teacher" && userId) {
//         const classes = await Class.find({ teacher: userId, semester: activeSemester._id });
//         classIds = classes.map(c => c._id);
//       } else if (role === "student" && userId) {
//         const user = await User.findOne({ username: userId });
//         if (!user) return res.status(404).json({ error: "Student not found" });
//         const classes = await Class.find({ students: user._id, semester: activeSemester._id });
//         classIds = classes.map(c => c._id);
//       }

//       if (classIds.length === 0) return res.json([]);
//       // Thay đổi từ filter.class thành kiểm tra trong mảng classes
//       filter.classes = { $in: classIds };
//     }

//     const exams = await PracticeExam.find(filter)
//       .populate('subject', 'name')
//       .populate('categories', 'name')
//       .populate('classes', 'className')  // populate mảng classes
//       .populate('teacher', 'name')
//       .sort({ createdAt: -1 });

//     res.json(exams);
//   } catch (err) {
//     console.error("Error fetching practice exams:", err);
//     res.status(500).json({ error: err.message });
//   }
// });

// ============================
// GET: Lấy đề của giảng viên
// ============================
router.get("/teacher/:teacherId", async (req, res) => {
  try {
    const { teacherId } = req.params;
    const { role } = req.query;
    let filter = { teacher: new mongoose.Types.ObjectId(teacherId) };

    if (role && role !== "admin") {
      const activeSemester = await Semester.findOne({ isActive: true });
      if (!activeSemester) return res.json([]);

      const classes = await Class.find({ teacher: teacherId, semester: activeSemester._id });
      const classIds = classes.map(c => c._id);
      if (classIds.length === 0) return res.json([]);
      
      // SỬA: sử dụng classes thay vì class
      filter.classes = { $in: classIds };
    }

    const exams = await PracticeExam.find(filter)
      .populate('subject', 'name')
      .populate('categories', 'name')
      .populate('classes', 'className')  // SỬA: sử dụng classes
      .populate('teacher', 'name')
      .sort({ createdAt: -1 });

    res.json(exams);
  } catch (err) {
    console.error("Error fetching exams by teacher:", err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/by-class-subject", async (req, res) => {
  try {
    const { classId, subjectId } = req.query;
    
    // Vì classes là mảng, cần tìm các exam có chứa classId trong mảng classes
    const exams = await PracticeExam.find({ 
      classes: classId,  // Tìm các exam có classId trong mảng classes
      subject: subjectId 
    })
      .populate('subject', 'name')
      .populate('categories', 'name')
      .populate('classes', 'className')  // Sử dụng classes
      .populate('teacher', 'name')
      .sort({ openTime: 1 });

    res.json(exams);
  } catch (err) {
    console.error("Error fetching exams by class and subject:", err);
    res.status(500).json({ error: err.message });
  }
});

// ============================
// GET: Lấy 1 đề
// ============================
router.get("/:id", async (req, res) => {
  try {
    console.log("GET /:id called, params:", req.params);
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: "Invalid exam ID" });

    const exam = await PracticeExam.findById(req.params.id)
      .populate('subject', 'name')
      .populate('categories', 'name')
      .populate('classes', 'className')
      .populate('teacher', 'name');

    if (!exam) return res.status(404).json({ error: "Exam not found" });
    res.json(exam);
  } catch (err) {
    console.error("Error fetching exam:", err);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// ============================
// GET: Lấy tất cả câu hỏi theo category
// ============================
router.get("/:id/all-questions", async (req, res) => {
  try {
    console.log("GET /:id/all-questions called, params:", req.params);
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: "Invalid exam ID" });

    const exam = await PracticeExam.findById(req.params.id);
    if (!exam) return res.status(404).json({ error: "Exam not found" });

    const questions = await Question.find({ categoryId: { $in: exam.categories } }).sort({ createdAt: 1 });
    const questionsWithImage = questions.map(q => ({ ...q.toObject(), imageUrl: q.image ? `/uploads/${q.image}` : null }));

    console.log("Questions fetched:", questions.length);
    res.json(questionsWithImage);
  } catch (err) {
    console.error("Error fetching all questions:", err);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// ============================
// GET: Lấy câu hỏi theo thứ tự trong exam.questions
// ============================
router.get("/:id/questions", async (req, res) => {
  try {
    console.log("GET /:id/questions called, params:", req.params);
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: "Invalid exam ID" });

    const exam = await PracticeExam.findById(req.params.id);
    if (!exam) return res.status(404).json({ error: "Exam not found" });
    if (!exam.questions || exam.questions.length === 0) return res.json([]);

    const questions = await Question.find({ _id: { $in: exam.questions } });
    const questionMap = {};
    questions.forEach(q => { questionMap[q._id.toString()] = q; });

    const orderedQuestions = exam.questions.map(id => questionMap[id.toString()]).filter(Boolean);
    const questionsWithImage = orderedQuestions.map(q => ({ ...q.toObject(), imageUrl: q.image ? `/uploads/${q.image}` : null }));

    console.log("Ordered questions fetched:", questionsWithImage.length);
    res.json(questionsWithImage);
  } catch (err) {
    console.error("Error fetching exam questions:", err);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// ============================
// POST: Tạo câu hỏi mới (hỗ trợ RichText + ảnh)
// ============================
router.post("/:id/questions", upload.single("image"), async (req, res) => {
    try {
    console.log("POST /:id/questions called");

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) 
      return res.status(400).json({ error: "Invalid exam ID" });

    const exam = await PracticeExam.findById(req.params.id);
    if (!exam) return res.status(404).json({ error: "Exam not found" });

    // Xử lý FormData (có file ảnh)
    const title = req.body.title?.trim();
    let options = [];
    let correctAnswer = parseInt(req.body.correctAnswer);
    const difficulty = req.body.difficulty || "Trung bình";
    const categoryId = req.body.categoryId || exam.categories[0];

    if (!title || title === "<p></p>" && title === "<br>") {
      return res.status(400).json({ message: "Vui lòng nhập câu hỏi" });
    }

    try {
      options = JSON.parse(req.body.options);
      if (!Array.isArray(options) || options.length !== 4) {
        return res.status(400).json({ message: "Phải có đúng 4 đáp án" });
      }
    } catch (e) {
      return res.status(400).json({ message: "Dữ liệu đáp án không hợp lệ" });
    }

    if (isNaN(correctAnswer) || correctAnswer < 0 || correctAnswer > 3) {
      return res.status(400).json({ message: "Đáp án đúng không hợp lệ" });
    }

    const questionData = {
      title,
      options,
      correctAnswer,
      difficulty,
      categoryId,
    };

    // Nếu có ảnh
    if (req.file) {
      questionData.image = req.file.filename;
    }

    const newQuestion = new Question(questionData);
    await newQuestion.save();

    exam.questions.push(newQuestion._id);
    await exam.save();

    const savedQuestion = {
      ...newQuestion.toObject(),
      imageUrl: newQuestion.image ? `/uploads/${newQuestion.image}` : null
    };

    console.log("Question created successfully:", savedQuestion._id);
    res.status(201).json(savedQuestion);
  } catch (err) {
    console.error("Error creating question:", err);
    res.status(400).json({ message: err.message || "Lỗi tạo câu hỏi" });
  }
});

// ============================
// POST: Thêm nhiều câu hỏi
// ============================
router.post("/:id/questions/bulk", async (req, res) => {
  try {
    console.log("POST /:id/questions/bulk called, body:", req.body);
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: "Invalid exam ID" });

    const exam = await PracticeExam.findById(req.params.id);
    if (!exam) return res.status(404).json({ error: "Exam not found" });

    const { questionIds } = req.body;
    if (!Array.isArray(questionIds) || questionIds.length === 0) return res.status(400).json({ error: "questionIds must be a non-empty array" });

    for (const qId of questionIds) {
      if (!mongoose.Types.ObjectId.isValid(qId)) return res.status(400).json({ error: `Invalid question ID: ${qId}` });
    }

    const questions = await Question.find({ _id: { $in: questionIds }, categoryId: { $in: exam.categories } });
    if (questions.length !== questionIds.length) return res.status(400).json({ error: "Some questions not found or don't belong to exam categories" });

    const existingQuestionIds = exam.questions.map(q => q.toString());
    const newQuestionIds = questionIds.filter(qId => !existingQuestionIds.includes(qId));
    exam.questions.push(...newQuestionIds);
    await exam.save();

    console.log(`Added ${newQuestionIds.length} questions to exam ${exam._id}`);
    res.status(200).json({ message: `Added ${newQuestionIds.length} questions to exam`, count: newQuestionIds.length });
  } catch (err) {
    console.error("Error adding bulk questions:", err);
    res.status(400).json({ error: err.message, stack: err.stack });
  }
});


// ============================
// DELETE: Xóa câu hỏi khỏi đề
// ============================
router.delete("/:id/questions/:questionId", async (req, res) => {
  try {
    console.log("DELETE /:id/questions/:questionId called, params:", req.params);
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: "Invalid exam ID" });
    if (!mongoose.Types.ObjectId.isValid(req.params.questionId)) return res.status(400).json({ error: "Invalid question ID" });

    const exam = await PracticeExam.findById(req.params.id);
    if (!exam) return res.status(404).json({ error: "Exam not found" });

    exam.questions = exam.questions.filter(qId => qId.toString() !== req.params.questionId);
    await exam.save();

    console.log(`Removed question ${req.params.questionId} from exam ${exam._id}`);
    res.json({ message: "Question removed from exam successfully" });
  } catch (err) {
    console.error("Error removing question from exam:", err);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// ============================
// POST: Tạo đề mới
// ============================
router.post("/", async (req, res) => {
  try {
    const { title, subject, categories, classes, duration, attempts, scorePerQuestion, openTime, closeTime, teacherId } = req.body;

    // Validation
    if (!title || !subject || !categories || !classes || !teacherId) {
      return res.status(400).json({ error: "Thiếu dữ liệu bắt buộc: title, subject, categories, classes, teacherId" });
    }

    if (!Array.isArray(classes) || classes.length === 0) {
      return res.status(400).json({ error: "Phải chọn ít nhất một lớp học" });
    }

    // Kiểm tra tính hợp lệ của các classId
    for (const classId of classes) {
      if (!mongoose.Types.ObjectId.isValid(classId)) {
        return res.status(400).json({ error: `Invalid class ID: ${classId}` });
      }
    }

    // Kiểm tra quyền phân công cho tất cả các lớp được chọn
    const assignments = await TeachingAssignment.find({
      teacher: teacherId,
      subject: subject,
      class: { $in: classes }
    });

    if (assignments.length !== classes.length) {
      return res.status(403).json({ error: "Bạn không được phân công dạy môn này cho tất cả các lớp đã chọn" });
    }

    // Convert datetime-local (Vietnam time) to UTC for database storage
    // datetime-local input "10:35" is Vietnam time (UTC+7)
    // When server parses it, JS treats it as UTC, but we want to store the actual UTC time
    // So we need to SUBTRACT 7 hours to correct for the timezone difference
    // Example: "2025-12-10T10:35" (Vietnam 10:35) = "2025-12-10T03:35Z" (UTC 3:35)
    const convertVietnamToUTC = (localDateTime) => {
      if (!localDateTime) return null;
      const date = new Date(localDateTime);
      date.setHours(date.getHours() - 7); // Subtract 7 hours to convert Vietnam time to UTC
      return date;
    };

    const examData = {
      title: title.trim(),
      subject: new mongoose.Types.ObjectId(subject),
      teacher: new mongoose.Types.ObjectId(teacherId),
      classes: classes.map(id => new mongoose.Types.ObjectId(id)), // Lưu mảng các lớp
      categories: categories.map(id => new mongoose.Types.ObjectId(id)),
      questions: [],
      duration: parseInt(duration) || 60,
      attempts: parseInt(attempts) || 1,
      scorePerQuestion: parseFloat(scorePerQuestion) || 1,
      openTime: convertVietnamToUTC(openTime),
      closeTime: convertVietnamToUTC(closeTime),
    };

    const newExam = new PracticeExam(examData);
    await newExam.save();

    // Thêm đề vào tất cả các lớp được chọn
    await Class.updateMany(
      { _id: { $in: classes } },
      { $push: { exams: newExam._id } }
    );

    const populatedExam = await PracticeExam.findById(newExam._id)
      .populate("subject", "name")
      .populate("categories", "name")
      .populate("teacher", "name")
      .populate("classes", "className");

    res.status(201).json(populatedExam);
  } catch (err) {
    console.error("Error creating practice exam:", err);
    res.status(400).json({ error: err.message });
  }
});

// ============================
// DELETE: Xóa đề
// ============================
router.delete("/:id", async (req, res) => {
  try {
    console.log("DELETE /:id called, params:", req.params);
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: "Invalid exam ID" });

    const deletedExam = await PracticeExam.findByIdAndDelete(req.params.id);
    if (!deletedExam) return res.status(404).json({ error: "Exam not found" });

    console.log("Practice exam deleted:", deletedExam._id);
    res.json({ message: "Exam deleted successfully" });
  } catch (err) {
    console.error("Error deleting practice exam:", err);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// ============================
// PUT: Cập nhật đề
// ============================
router.put("/:id", async (req, res) => {
  try {
    console.log("PUT /:id called, body:", req.body);
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: "Invalid exam ID" });

    const exam = await PracticeExam.findById(req.params.id);
    if (!exam) return res.status(404).json({ error: "Exam not found" });

    // Convert datetime-local (Vietnam time) to UTC for database storage
    const convertVietnamToUTC = (localDateTime) => {
      if (!localDateTime) return null;
      const date = new Date(localDateTime);
      date.setHours(date.getHours() - 7); // Subtract 7 hours to convert Vietnam time to UTC
      return date;
    };

    const updateData = {
      title: req.body.title?.trim(),
      subject: req.body.subject ? new mongoose.Types.ObjectId(req.body.subject) : exam.subject,
      categories: req.body.categories?.map(id => new mongoose.Types.ObjectId(id)) || exam.categories,
      duration: parseInt(req.body.duration) || exam.duration,
      attempts: parseInt(req.body.attempts) || exam.attempts,
      scorePerQuestion: parseFloat(req.body.scorePerQuestion) || exam.scorePerQuestion,
    };

    if (req.body.openTime?.trim()) updateData.openTime = convertVietnamToUTC(req.body.openTime);
    if (req.body.closeTime?.trim()) updateData.closeTime = convertVietnamToUTC(req.body.closeTime);

    const updatedExam = await PracticeExam.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true })
      .populate('subject', 'name')
      .populate('categories', 'name')
      .populate('teacher', 'name')
      .populate('classes', 'className');

    console.log("Practice exam updated:", updatedExam._id);
    res.json(updatedExam);
  } catch (err) {
    console.error("Error updating practice exam:", err);
    res.status(400).json({ error: err.message, stack: err.stack });
  }
});

module.exports = router;
