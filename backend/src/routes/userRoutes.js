const express = require("express");
const router = express.Router();
const User = require("../models/User");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const TestExamAttempt = require("../models/TestExamAttempt");
const Class = require("../models/Class");
const Category = require("../models/Category");
const PracticeExam = require("../models/PracticeExam");
const Exam = require("../models/Exam");
const TeachingAssignment = require("../models/TeachingAssignment");
// Cấu hình multer cho upload avatar
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'avatar_' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Chỉ chấp nhận file ảnh'), false);
  }
};

const upload = multer({ 
  storage: storage, 
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Route upload avatar
router.post('/upload-avatar', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Không có file ảnh được upload' });
    }
    
    const imageUrl = `/uploads/${req.file.filename}`;
    
    res.json({ 
      success: true, 
      filename: req.file.filename,
      imageUrl: imageUrl 
    });
  } catch (error) {
    console.error('Lỗi upload avatar:', error);
    res.status(500).json({ error: error.message });
  }
});

// Các route khác giữ nguyên...

router.get("/", async (req, res) => {
  try {
    const users = await User.find().select("-password");
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/:id/reset-password", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user || user.role !== "student") {
      return res.status(404).json({ message: "Không tìm thấy sinh viên" });
    }

    user.password = "123456";
    await user.save();

    res.json({ message: "Đã reset mật khẩu về 123456 thành công!" });
  } catch (err) {
    console.error("Lỗi reset mật khẩu:", err);
    res.status(500).json({ message: "Lỗi server" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Đăng nhập - cập nhật để bao gồm avatarUrl
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user || user.password !== password) {
      return res.status(401).json({ message: "Sai tài khoản hoặc mật khẩu" });
    }
    
    res.json({
      message: "Đăng nhập thành công",
      user: {
        _id: user._id,
        username: user.username,
        name: user.name,
        role: user.role,
        avatar: user.avatar,        // Bao gồm avatar
        avatarUrl: user.avatarUrl, // Bao gồm avatarUrl từ virtual field
        subjects: user.subjects || [],
        className: user.className || "",
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Lỗi server" });
  }
});

// Cập nhật user để hỗ trợ cập nhật avatar
router.put("/:id", async (req, res) => {
  try {
    const { name, password, subjects, className, avatar } = req.body;
    const user = await User.findById(req.params.id);
    
    if (!user) return res.status(404).json({ message: "User not found" });
    
    if (name) user.name = name;
    if (password) user.password = password;
    if (className !== undefined) user.className = className;
    if (avatar !== undefined) user.avatar = avatar; // Cập nhật avatar
    if (subjects && Array.isArray(subjects)) {
      user.subjects = Array.from(new Set([...(user.subjects || []), ...subjects]));
    }
    
    await user.save();
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Các route khác giữ nguyên...
router.post("/", async (req, res) => {
  try {
    const { username, name, password, role, subjects } = req.body;
    if (!username || !password || !role || !name) {
      return res.status(400).json({ message: "Thiếu thông tin cần thiết!" });
    }
    const existing = await User.findOne({ username });
    if (existing) return res.status(400).json({ message: "Username đã tồn tại" });
    
    const newUser = new User({
      username,
      password,
      name,
      role,
      subjects: subjects || [],
    });
    
    await newUser.save();
    res.status(201).json(newUser);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// router.delete("/:id", async (req, res) => {
//   try {
//     const deletedUser = await User.findByIdAndDelete(req.params.id);
//     if (!deletedUser) return res.status(404).json({ message: "User not found" });
//     res.json({ message: "Xóa thành công" });
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// });


// DELETE: Xóa user và cleanup dữ liệu liên quan
router.delete("/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.role === "teacher") {
      // Chỉ thực hiện nếu model tồn tại
      try { await Category.deleteMany({ createdBy: user._id }); } catch(e) { console.log("Category not found or error:", e.message); }
      try { await PracticeExam.deleteMany({ teacher: user._id }); } catch(e) {}
      try { await Exam.deleteMany({ createdBy: user._id }); } catch(e) {}
      try { await TeachingAssignment.deleteMany({ teacher: user._id }); } catch(e) {}
      try { await Class.updateMany({ teacher: user._id }, { $set: { teacher: null } }); } catch(e) {}
    } else if (user.role === "student") {
      try { await TestExamAttempt.deleteMany({ student: user._id }); } catch(e) {}
      try { await Class.updateMany({}, { $pull: { students: user._id } }); } catch(e) {}
    }

    await User.findByIdAndDelete(req.params.id);
    res.json({ message: "Xóa thành công" });
  } catch (err) {
    console.error("Lỗi xóa user:", err);
    res.status(500).json({ message: "Lỗi server khi xóa user" });
  }
});


module.exports = router;