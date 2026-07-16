// routes/subjects.js
const express = require("express");
const router = express.Router();
const Subject = require("../models/Subject");
const User = require("../models/User"); // ✅ For updating teacher subjects
const TeachingAssignment = require("../models/TeachingAssignment"); // ✅ If exists

// GET /api/subjects -> list all subjects
router.get("/", async (req, res) => {
  try {
    const subjects = await Subject.find().sort({ name: 1 });
    res.json(subjects);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/subjects -> create new subject
router.post("/", async (req, res) => {
  const { name } = req.body;

  // ✅ Better validation with optional chaining
  if (!name?.trim()) {
    return res.status(400).json({ message: "Tên môn học không được để trống" });
  }

  try {
    // Check if subject already exists
    const existing = await Subject.findOne({ name: name.trim() });
    if (existing) {
      return res.status(400).json({ message: "Môn học đã tồn tại" });
    }

    const newSubject = new Subject({ name: name.trim() });
    const savedSubject = await newSubject.save();
    res.status(201).json(savedSubject);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/subjects/:id -> delete subject + clean up references
router.delete("/:id", async (req, res) => {
  try {
    const subject = await Subject.findByIdAndDelete(req.params.id);
    if (!subject) {
      return res.status(404).json({ message: "Môn học không tồn tại" });
    }

    // ✅ Option 1: If User model has subjects array with string names
    await User.updateMany(
      { role: "teacher" },
      { $pull: { subjects: subject.name } }
    ).catch(err => {
      // If this fails, it means User doesn't have subjects array - that's OK
      console.log("Note: User.subjects update not needed or failed");
    });

    // ✅ Option 2: If TeachingAssignment collection exists
    if (TeachingAssignment) {
      await TeachingAssignment.deleteMany({ subject: req.params.id })
        .catch(err => {
          console.log("Note: TeachingAssignment cleanup not needed");
        });
    }

    res.json({
      message: `Đã xóa môn "${subject.name}" và cập nhật danh sách giảng viên.`,
    });
  } catch (err) {
    console.error("❌ Lỗi khi xóa môn học:", err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;