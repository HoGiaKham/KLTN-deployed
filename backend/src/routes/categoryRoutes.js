const express = require("express");
const router = express.Router();
const Category = require("../models/Category");
const Question = require("../models/Question");
const Subject = require("../models/Subject");
const User = require("../models/User");
const TeachingAssignment = require("../models/TeachingAssignment");
const upload = require("../config/multer");

// POST upload image
router.post("/upload", upload.single("image"), (req, res) => {
  try {
    res.json({
      message: "Upload thành công",
      imageUrl: `/uploads/${req.file.filename}`,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET tất cả questions của 1 category
router.get("/:categoryId/questions", async (req, res) => {
  try {
    const questions = await Question.find({ categoryId: req.params.categoryId })
      .sort({ createdAt: 1 });
    
    const questionsWithImage = questions.map(q => ({
      ...q.toObject(),
      imageUrl: q.image ? `/uploads/${q.image}` : null
    }));
    
    res.json(questionsWithImage);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ✅ NEW ENDPOINT: GET tất cả môn học + danh mục của teacher
// Endpoint: GET /categories/teacher-subjects/:teacherId
router.get("/teacher-subjects/:teacherId", async (req, res) => {
  try {
    console.log("\n✅ [Teacher Subjects Route] Request for teacher ID:", req.params.teacherId);
    
    // 1. Kiểm tra teacher tồn tại
    const teacher = await User.findById(req.params.teacherId);
    if (!teacher || teacher.role !== "teacher") {
      console.log("❌ Teacher not found");
      return res.status(404).json({ message: "Teacher not found" });
    }

    console.log("✅ Teacher found:", teacher.name);

    // 2. Lấy TeachingAssignment của teacher
    const assignments = await TeachingAssignment.find({ 
      teacher: req.params.teacherId 
    })
      .populate("subject", "_id name description")
      .populate("class", "_id className");

    console.log("📋 Found assignments:", assignments.length);

    if (assignments.length === 0) {
      console.log("⚠️ Teacher has no teaching assignments");
      return res.json([]);
    }

    // 3. Lấy unique subjects từ assignments
    const subjectMap = {};
    assignments.forEach(assignment => {
      if (assignment.subject && assignment.subject._id) {
        const subjectId = assignment.subject._id.toString();
        if (!subjectMap[subjectId]) {
          subjectMap[subjectId] = {
            _id: assignment.subject._id,
            name: assignment.subject.name,
            description: assignment.subject.description || "",
            categories: []
          };
        }
      }
    });

    const subjectIds = Object.keys(subjectMap).map(id => id);
    console.log("🔎 Subject IDs:", subjectIds);

    // 4. Lấy categories của các subject này (createdBy teacher)
    const categories = await Category.find({
      subjectId: { $in: subjectIds },
      createdBy: req.params.teacherId  // ← Chỉ categories của teacher này
    }).sort({ createdAt: -1 });

    console.log("📦 Found categories:", categories.length);

    // 5. Map categories vào subjects
    categories.forEach(cat => {
      const subjectId = cat.subjectId.toString();
      if (subjectMap[subjectId]) {
        subjectMap[subjectId].categories.push({
          _id: cat._id,
          name: cat.name,
          description: cat.description || ""
        });
      }
    });

    // 6. Trả về array subjects + categories
    const result = Object.values(subjectMap);
    console.log("✅ Returning", result.length, "subjects with categories");
    
    res.json(result);
  } catch (err) {
    console.error("❌ Error in teacher-subjects route:", err);
    res.status(500).json({ message: err.message });
  }
});

// ⭐ GET tất cả môn học và danh mục của teacher (CÓ - endpoint cũ)
// FIX v3: Lấy categories nhưng filter theo teacher (createdBy)
router.get("/teacher/:teacherId", async (req, res) => {
  try {
    console.log("\n🔍 [Teacher Route] Request for teacher ID:", req.params.teacherId);
    
    // Kiểm tra teacher tồn tại
    const teacher = await User.findById(req.params.teacherId);
    if (!teacher || teacher.role !== "teacher") {
      console.log("❌ Teacher not found or invalid role");
      return res.status(404).json({ message: "Teacher not found" });
    }

    console.log("✅ Teacher found:", teacher.name);
    console.log("📚 Teacher subjects (from user.subjects):", teacher.subjects);

    const teacherSubjectNames = teacher.subjects || [];
    
    if (teacherSubjectNames.length === 0) {
      console.log("⚠️ Teacher has no subjects");
      return res.json([]);
    }

    // Tìm Subject theo TÊN (từ user.subjects)
    const subjects = await Subject.find({ name: { $in: teacherSubjectNames } });
    console.log("🔎 Found subjects:", subjects.map(s => ({ _id: s._id, name: s.name })));

    if (subjects.length === 0) {
      console.log("⚠️ No subjects found in DB for names:", teacherSubjectNames);
      return res.json([]);
    }

    const subjectIds = subjects.map(s => s._id.toString());
    console.log("🆔 Subject IDs for this teacher:", subjectIds);

    // ⭐ FIX v3: Lấy categories của những subject này
    // NHƯNG chỉ lấy categories được tạo bởi teacher này (createdBy === teacherId)
    const categories = await Category.find({ 
      subjectId: { $in: subjectIds },
      createdBy: req.params.teacherId  // ← ⭐ KIỂM TRA QUỀ
    }).sort({ createdAt: -1 });
    
    console.log("📦 Found categories (created by this teacher):", categories.length);

    // Tạo map categories theo subjectId
    const categoryBySubject = {};
    categories.forEach(cat => {
      const subId = cat.subjectId.toString();
      if (!categoryBySubject[subId]) {
        categoryBySubject[subId] = [];
      }
      categoryBySubject[subId].push(cat);
    });

    // ⭐ Trả về: TẤT CẢ subjects + CHỈ categories của teacher này
    const result = subjects.map(subject => ({
      _id: subject._id,
      subjectId: subject._id,
      name: subject.name,
      description: subject.description || "",
      categories: categoryBySubject[subject._id.toString()] || [],
      isSubject: true
    }));

    console.log("✅ Returning", result.length, "subjects with categories (filtered by teacher)");
    res.json(result);
  } catch (err) {
    console.error("❌ Error in teacher route:", err);
    res.status(500).json({ message: err.message });
  }
});

// ✅ GET danh mục theo subject ID - FIX #3: Thêm filter teacherId
router.get("/:subjectId", async (req, res) => {
  try {
    console.log("\n📂 [Subject Route] Request for subject:", req.params.subjectId);
    const { teacherId } = req.query;
    console.log("🔑 Teacher ID (optional):", teacherId);
    
    // ✅ Nếu có teacherId → chỉ lấy categories của teacher này
    let query = { subjectId: req.params.subjectId };
    
    if (teacherId) {
      query.createdBy = teacherId;
      console.log("🔒 Filtering by teacher:", teacherId);
    }
    
    const categories = await Category.find(query).sort({ createdAt: -1 });
    
    console.log("📦 Found categories:", categories.length);
    res.json(categories);
  } catch (err) {
    console.error("❌ Error:", err);
    res.status(500).json({ message: err.message });
  }
});

// POST tạo category mới
// ⭐ FIX: Kiểm tra TeachingAssignment thay vì user.subjects
router.post("/:subjectId", async (req, res) => {
  try {
    const { name, description, teacherId } = req.body;

    // ⭐ FIX: Kiểm tra bằng TeachingAssignment
    if (teacherId) {
      const teacher = await User.findById(teacherId);
      if (!teacher) {
        return res.status(404).json({ message: "Teacher not found" });
      }

      // Lấy subject để kiểm tra
      const subject = await Subject.findById(req.params.subjectId);
      if (!subject) {
        return res.status(404).json({ message: "Subject not found" });
      }

      // ✅ FIX: Kiểm tra TeachingAssignment thay vì user.subjects
      const hasAssignment = await TeachingAssignment.findOne({
        teacher: teacherId,
        subject: req.params.subjectId
      });

      if (!hasAssignment) {
        console.log("❌ Teacher not assigned to this subject");
        return res.status(403).json({ 
          message: "Bạn không được phân công dạy môn học này" 
        });
      }

      console.log("✅ Teacher has assignment for this subject");
    }

    const category = new Category({
      name,
      description,
      subjectId: req.params.subjectId,
      image: req.body.image,
      createdBy: teacherId // ⭐ QUAN TRỌNG: Lưu teacher tạo category
    });
    const saved = await category.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT cập nhật category
// ⭐ Chỉ author (createdBy) mới có thể sửa
router.put("/:id", async (req, res) => {
  try {
    const { name, description, image, teacherId } = req.body;

    // Lấy category hiện tại
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    // ⭐ Kiểm tra: đây có phải category được tạo bởi teacher này không?
    if (teacherId) {
      if (category.createdBy?.toString() !== teacherId) {
        return res.status(403).json({ 
          message: "Bạn không có quyền sửa danh mục này (không phải người tạo)" 
        });
      }
    }

    const updated = await Category.findByIdAndUpdate(
      req.params.id,
      { 
        name, 
        description, 
        image 
      },
      { new: true }
    );
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE category
// ⭐ Chỉ author (createdBy) mới có thể xóa
router.delete("/:id", async (req, res) => {
  try {
    const { teacherId } = req.query;

    // Lấy category để kiểm tra quyền
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    // ⭐ Kiểm tra: đây có phải category được tạo bởi teacher này không?
    if (teacherId) {
      if (category.createdBy?.toString() !== teacherId) {
        return res.status(403).json({ 
          message: "Bạn không có quyền xóa danh mục này (không phải người tạo)" 
        });
      }
    }

    // Kiểm tra còn câu hỏi không
    const questions = await Question.find({ categoryId: req.params.id });
    if (questions.length > 0) {
      return res.status(400).json({ 
        message: "Không thể xóa danh mục vì vẫn còn câu hỏi liên quan." 
      });
    }

    const deleted = await Category.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Category not found" });
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;