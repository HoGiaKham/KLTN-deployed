const express = require("express");
const router = express.Router();
const Class = require("../models/Class");
const User = require("../models/User");
const TeachingAssignment = require("../models/TeachingAssignment");
const Semester = require("../models/Semester");
const mongoose = require("mongoose");
const PracticeExam = require("../models/PracticeExam");
const Exam = require("../models/Exam");


router.get("/", async (req, res) => {
  try {
    const { userId, role } = req.query;

    let filter = {};

    if (role && role !== "admin") {
      const activeSemester = await Semester.findOne({ isActive: true });
      if (!activeSemester) {
        console.log("Không có học kỳ active");
        return res.json([]);
      }

      const semesterFilter = { semester: activeSemester._id };

      if (role === "teacher" && userId) {
        if (!mongoose.Types.ObjectId.isValid(userId)) {
          return res.status(400).json({ message: "Invalid userId" });
        }
        filter = { ...semesterFilter, teacher: new mongoose.Types.ObjectId(userId) };
      } 
      else if (role === "student" && userId) {
        if (!mongoose.Types.ObjectId.isValid(userId)) {
          return res.status(400).json({ message: "Invalid userId" });
        }
        filter = {
          ...semesterFilter,
          students: { $in: [new mongoose.Types.ObjectId(userId)] }
        };
      } 
      else {
        filter = semesterFilter;
      }

      console.log("[DEBUG] Filter:", filter);
    }

    const classes = await Class.find(filter)
      .populate("students", "name username")
      .populate("teacher", "name username")
      .populate("subject", "name")
      .populate("semester", "name isActive");

    console.log("[DEBUG] Classes returned:", classes.map(c => c.className));

    res.json(classes);
  } catch (err) {
    console.error("Lỗi lấy danh sách lớp:", err);
    res.status(500).json({ message: err.message });
  }
});

// GET: Lấy 1 lớp (kiểm tra quyền)
router.get("/:id", async (req, res) => {
  try {
    const { userId, role } = req.query;
    const classItem = await Class.findById(req.params.id)
      .populate("students", "name username")
      .populate("teacher", "name username")
      .populate("subject", "name")
      .populate("semester", "name startDate endDate");

    if (!classItem) return res.status(404).json({ message: "Không tìm thấy lớp" });

    if (role && role !== "admin") {
      const activeSemester = await Semester.findOne({ isActive: true });
      if (!activeSemester || classItem.semester._id.toString() !== activeSemester._id.toString()) {
        return res.status(403).json({ message: "Lớp không thuộc học kỳ hiện tại" });
      }

      const isTeacher = classItem.teacher?._id?.toString() === userId;
      const isStudent = classItem.students.some(s => s._id.toString() === userId);

      if (!isTeacher && !isStudent) {
        return res.status(403).json({ message: "Bạn không có quyền xem lớp này" });
      }
    }

    res.json(classItem);
  } catch (err) {
    console.error("Lỗi lấy lớp:", err);
    res.status(500).json({ message: err.message });
  }
});

// POST: Tạo lớp mới
router.post("/", async (req, res) => {
  try {
    const { className, subject, teacher, semester, maxStudents = 50 } = req.body;

    if (!className?.trim()) return res.status(400).json({ message: "Tên lớp là bắt buộc" });
    if (!subject) return res.status(400).json({ message: "Môn học là bắt buộc" });
    if (!semester) return res.status(400).json({ message: "Học kỳ là bắt buộc" });

    const semesterExists = await Semester.findById(semester);
    if (!semesterExists) return res.status(400).json({ message: "Học kỳ không tồn tại" });

    // Dựa vào unique index trong model → tự động báo lỗi nếu trùng
    const newClass = new Class({
      className: className.trim(),
      subject,
      teacher: teacher || null,
      semester,
      maxStudents: Number(maxStudents),
      students: [],
    });

    const savedClass = await newClass.save();

if (teacher && subject) {
  const exist = await TeachingAssignment.findOne({
    teacher,
    subject,
    class: savedClass._id,
  });
  if (!exist) {
    await new TeachingAssignment({
      teacher,
      subject,
      class: savedClass._id,
      semester: savedClass.semester,
    }).save();
  }
}

    const populated = await Class.findById(savedClass._id)
      .populate("teacher", "name username")
      .populate("subject", "name")
      .populate("semester", "name")
      .populate("students", "name username");

    res.status(201).json(populated);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({
        message: "Lớp này đã tồn tại cho môn học và học kỳ này",
      });
    }
    console.error("Lỗi tạo lớp:", err);
    res.status(500).json({ message: err.message });
  }
});

// PUT: Cập nhật lớp + KIỂM TRA TRÙNG MÔN KHI THÊM SV
router.put("/:id", async (req, res) => {
  try {
    const { className, subject, teacher, semester, students, maxStudents } = req.body;
    const classId = req.params.id;

    const classItem = await Class.findById(classId).populate("subject");
    if (!classItem) return res.status(404).json({ message: "Lớp không tồn tại" });

    let newClassName = className?.trim() || classItem.className;
    let newSubject = subject !== undefined ? subject : classItem.subject;
    let newSemester = semester !== undefined ? semester : classItem.semester;
    let newMaxStudents = maxStudents !== undefined ? Number(maxStudents) : classItem.maxStudents;

    if (semester !== undefined) {
      const semesterExists = await Semester.findById(semester);
      if (!semesterExists) return res.status(400).json({ message: "Học kỳ không tồn tại" });
    }

    // Kiểm tra trùng className + subject + semester
    if (className?.trim() || subject !== undefined || semester !== undefined) {
      const existing = await Class.findOne({
        className: newClassName,
        subject: newSubject,
        semester: newSemester,
        _id: { $ne: classId },
      });
      if (existing) {
        return res.status(400).json({
          message: "Lớp này đã tồn tại cho môn học và học kỳ này",
        });
      }
    }

    if (className?.trim()) classItem.className = newClassName;
    if (maxStudents !== undefined) classItem.maxStudents = newMaxStudents;
    if (subject !== undefined) classItem.subject = newSubject;
    if (semester !== undefined) classItem.semester = newSemester;
    if (teacher !== undefined) classItem.teacher = teacher || null;

    // === XỬ LÝ SINH VIÊN + KIỂM TRA TRÙNG MÔN ===
    if (students !== undefined) {
      const newStudentIds = Array.isArray(students) ? students.map(s => s.toString()) : [];
      const oldStudentIds = classItem.students.map(s => s.toString());
      const added = newStudentIds.filter(id => !oldStudentIds.includes(id));

      // KIỂM TRA TRÙNG MÔN
      if (added.length > 0) {
        const subjectId = classItem.subject._id || classItem.subject;

        const conflicting = await Class.find({
          students: { $in: added },
          subject: subjectId,
          _id: { $ne: classId }
        }).select("className");

        if (conflicting.length > 0) {
          const names = conflicting.map(c => `"${c.className}"`).join(", ");
          return res.status(400).json({
            message: `Sinh viên đã học môn này ở lớp: ${names}. Không thể thêm!`
          });
        }
      }

      const removed = oldStudentIds.filter(id => !newStudentIds.includes(id));
      if (removed.length > 0) {
        await User.updateMany({ _id: { $in: removed } }, { className: "" });
      }
      if (added.length > 0) {
        await User.updateMany({ _id: { $in: added } }, { className: classItem.className });
      }

      classItem.students = newStudentIds;
    }

    // Cập nhật TeachingAssignment
    let shouldUpdateAssignment = false;
    if (subject !== undefined || teacher !== undefined || semester !== undefined) {
      shouldUpdateAssignment = true;
    }

    if (shouldUpdateAssignment && classItem.teacher && classItem.subject) {
      await TeachingAssignment.deleteOne({ class: classItem._id });
      const exist = await TeachingAssignment.findOne({
        teacher: classItem.teacher,
        subject: classItem.subject,
        class: classItem._id,
      });
if (!exist) {
  await new TeachingAssignment({
    teacher: classItem.teacher,
    subject: classItem.subject,
    class: classItem._id,
    semester: classItem.semester,
  }).save();
}
    }

    const updated = await classItem.save();

    const populated = await Class.findById(updated._id)
      .populate("teacher", "name username")
      .populate("subject", "name")
      .populate("semester", "name")
      .populate("students", "name username");

    res.json(populated);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({
        message: "Lớp này đã tồn tại cho môn học và học kỳ này",
      });
    }
    console.error("Lỗi cập nhật lớp:", err);
    res.status(500).json({ message: err.message });
  }
});

// DELETE: Xóa lớp
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await Class.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Không tìm thấy lớp" });

await User.updateMany(
  { className: deleted._id.toString() },
  { className: "" }
);
    
    await TeachingAssignment.deleteMany({ class: req.params.id });
    
    await PracticeExam.deleteMany({ classes: req.params.id });
    
    await Exam.deleteMany({ class: req.params.id });

    res.json({ message: "Xóa lớp và dữ liệu liên quan (assignments, practice exams, exams) thành công" });
  } catch (err) {
    console.error("Lỗi xóa lớp:", err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;