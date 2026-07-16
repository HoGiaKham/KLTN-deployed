const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const TeachingAssignment = require("../models/TeachingAssignment");
const User = require("../models/User");
const Subject = require("../models/Subject");
const Class = require("../models/Class");
const axios = require("axios");
// GET: Lấy tất cả phân công
router.get("/", async (req, res) => {
  try {
    const assignments = await TeachingAssignment.find()
      .populate("teacher", "name username")
      .populate("subject", "name")
      // .populate("class", "className");
      .populate({
  path: "class",
  populate: { path: "students", select: "name" }
})
    res.json(assignments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET: Lấy phân công theo giáo viên
router.get("/teacher/:teacherId", async (req, res) => {
  try {
    const { teacherId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(teacherId)) {
      return res.status(400).json({ error: "Invalid teacher ID" });
    }

    const assignments = await TeachingAssignment.find({
      teacher: new mongoose.Types.ObjectId(teacherId),
    })
      .populate("subject", "name")
      .populate("class", "className")
      .populate("semester", "_id name")
      .sort({ createdAt: -1 });

    res.json(assignments);
  } catch (err) {
    console.error("Error fetching assignments by teacher:", err);
    res.status(500).json({ error: err.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const { teacher, subject, classId } = req.body;

    const [t, s, activeSemester] = await Promise.all([
      User.findOne({ _id: teacher, role: "teacher" }),
      Subject.findById(subject),
      axios.get("http://localhost:5000/api/semesters/active").then(r => r.data), // LẤY HỌC KỲ HIỆN TẠI
    ]);

    if (!t) return res.status(400).json({ message: "Giáo viên không hợp lệ" });
    if (!s) return res.status(400).json({ message: "Môn học không tồn tại" });
    if (!activeSemester) return res.status(400).json({ message: "Chưa có học kỳ hiện tại!" });

    // Đồng bộ Class nếu có
    if (classId) {
      await Class.findByIdAndUpdate(classId, { teacher, subject });
    }

    // Nếu đang thêm assignment với class, xóa assignment cũ của môn này (không có class)
    if (classId) {
      await TeachingAssignment.deleteOne({
        teacher,
        subject,
        semester: activeSemester._id,
        class: null,
      });
    }

    const query = { teacher, subject, semester: activeSemester._id };
    if (classId !== undefined) query.class = classId || null;

    const existing = await TeachingAssignment.findOne(query);
    if (existing) {
      return res.status(400).json({
        message: classId
          ? "Lớp này đã có giáo viên dạy môn này trong học kỳ này!"
          : "Giáo viên đã được phân công dạy môn này trong học kỳ này!",
      });
    }

    const assignment = new TeachingAssignment({
      teacher,
      subject,
      class: classId || null,
      semester: activeSemester._id, // THÊM DÒNG QUAN TRỌNG NÀY!
    });

    const saved = await assignment.save();
    const populated = await TeachingAssignment.findById(saved._id)
      .populate("teacher", "name username")
      .populate("subject", "name")
      .populate("class", "className")
      .populate("semester", "name");
    res.status(201).json(populated);
  } catch (err) {
    console.error("Lỗi tạo phân công:", err);
    res.status(500).json({ message: err.message });
  }
});

// XÓA TẤT CẢ PHÂN CÔNG CỦA MỘT MÔN
router.delete("/subject/:subjectId", async (req, res) => {
  try {
    await TeachingAssignment.deleteMany({ subject: req.params.subjectId });
    res.json({ message: "Xóa tất cả phân công của môn thành công" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// XÓA TẤT CẢ PHÂN CÔNG CỦA MỘT LỚP
router.delete("/class/:classId", async (req, res) => {
  try {
    await TeachingAssignment.deleteMany({ class: req.params.classId });
    res.json({ message: "Xóa phân công thành công" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE: Xóa phân công
router.delete("/:id", async (req, res) => {
  try {
    const assignment = await TeachingAssignment.findById(req.params.id);
    if (!assignment)
      return res.status(404).json({ message: "Không tìm thấy phân công" });

    await TeachingAssignment.findByIdAndDelete(req.params.id);
    res.json({ message: "Xóa phân công thành công" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
