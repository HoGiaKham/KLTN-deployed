const express = require("express");
const router = express.Router();
const Semester = require("../models/Semester");

// GET: Lấy tất cả học kỳ (sắp xếp theo ngày bắt đầu giảm dần)
router.get("/", async (req, res) => {
  try {
    const semesters = await Semester.find()
      .sort({ startDate: -1 }) // Mới nhất lên đầu
      .select("name startDate endDate isActive");
    res.json(semesters);
  } catch (err) {
    console.error("Lỗi lấy danh sách học kỳ:", err);
    res.status(500).json({ message: "Lỗi server khi lấy danh sách học kỳ" });
  }
});
// GET: Lấy học kỳ hiện tại
router.get("/active", async (req, res) => {
  try {
  const active = await Semester.findOne({ isActive: true });
  if (!active) {
    return res.status(404).json({ message: "Không có học kỳ hiện tại" });
  }
  res.json(active);
  } catch (err) {
    console.error("Lỗi lấy học kỳ hiện tại:", err);
    res.status(500).json({ message: "Lỗi server" });
  }
});
// GET: Lấy 1 học kỳ theo ID
router.get("/:id", async (req, res) => {
  try {
    const semester = await Semester.findById(req.params.id);
    if (!semester) {
      return res.status(404).json({ message: "Không tìm thấy học kỳ" });
    }
    res.json(semester);
  } catch (err) {
    console.error("Lỗi lấy học kỳ:", err);
    res.status(500).json({ message: "Lỗi server" });
  }
});

// POST: Tạo học kỳ mới
router.post("/", async (req, res) => {
  try {
    const { name, startDate, endDate, isActive = false } = req.body;

    // Validate
    if (!name?.trim()) {
      return res.status(400).json({ message: "Tên học kỳ là bắt buộc" });
    }
    if (!startDate || !endDate) {
      return res.status(400).json({ message: "Ngày bắt đầu và kết thúc là bắt buộc" });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start) || isNaN(end)) {
      return res.status(400).json({ message: "Ngày không hợp lệ" });
    }
    if (start >= end) {
      return res.status(400).json({ message: "Ngày bắt đầu phải trước ngày kết thúc" });
    }

    // Kiểm tra trùng tên
    const existing = await Semester.findOne({ name: name.trim() });
    if (existing) {
      return res.status(400).json({ message: "Tên học kỳ đã tồn tại" });
    }

    // Kiểm tra overlap date range
    const overlap = await Semester.findOne({
      startDate: { $lt: end },
      endDate: { $gt: start }
    });
    if (overlap) {
      return res.status(400).json({ message: "Khoảng thời gian trùng lặp với học kỳ khác" });
    }

    // Nếu set isActive, kiểm tra hôm nay có nằm trong khoảng không
    if (isActive) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const startCheckDate = new Date(start);
      startCheckDate.setHours(0, 0, 0, 0);
      const endCheckDate = new Date(end);
      endCheckDate.setHours(0, 0, 0, 0);
      
      if (today < startCheckDate || today > endCheckDate) {
        return res.status(400).json({ message: "Không thể đặt học kỳ này là kỳ hiện tại vì ngày hôm nay không nằm trong thời gian mở của học kỳ" });
      }
      
      // Tự động tắt isActive của các kỳ khác
      await Semester.updateMany({ isActive: true }, { isActive: false });
    }

    const newSemester = new Semester({
      name: name.trim(),
      startDate: start,
      endDate: end,
      isActive,
    });

    const saved = await newSemester.save();
    res.status(201).json(saved);
  } catch (err) {
    console.error("Lỗi tạo học kỳ:", err);
    res.status(500).json({ message: err.message || "Lỗi server khi tạo học kỳ" });
  }
});

// PUT: Cập nhật học kỳ
router.put("/:id", async (req, res) => {
  try {
    const { name, startDate, endDate, isActive } = req.body;
    const semesterId = req.params.id;

    const semester = await Semester.findById(semesterId);
    if (!semester) {
      return res.status(404).json({ message: "Không tìm thấy học kỳ" });
    }

    // Validate tên nếu thay đổi
    if (name?.trim() && name.trim() !== semester.name) {
      const existing = await Semester.findOne({ name: name.trim(), _id: { $ne: semesterId } });
      if (existing) {
        return res.status(400).json({ message: "Tên học kỳ đã tồn tại" });
      }
      semester.name = name.trim();
    }

    // Validate ngày
    if (startDate || endDate) {
      const start = startDate ? new Date(startDate) : semester.startDate;
      const end = endDate ? new Date(endDate) : semester.endDate;

      if (isNaN(start) || isNaN(end)) {
        return res.status(400).json({ message: "Ngày không hợp lệ" });
      }
      if (start >= end) {
        return res.status(400).json({ message: "Ngày bắt đầu phải trước ngày kết thúc" });
      }

      // Kiểm tra overlap với các kỳ khác
      const overlap = await Semester.findOne({
        _id: { $ne: semesterId },
        startDate: { $lt: end },
        endDate: { $gt: start }
      });
      if (overlap) {
        return res.status(400).json({ message: "Khoảng thời gian trùng lặp với học kỳ khác" });
      }

      semester.startDate = start;
      semester.endDate = end;
    }

    // Xử lý isActive
    if (isActive !== undefined && isActive !== semester.isActive) {
      if (isActive) {
        // Kiểm tra hôm nay có nằm trong khoảng không
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const startCheckDate = new Date(semester.startDate);
        startCheckDate.setHours(0, 0, 0, 0);
        const endCheckDate = new Date(semester.endDate);
        endCheckDate.setHours(0, 0, 0, 0);
        
        if (today < startCheckDate || today > endCheckDate) {
          return res.status(400).json({ message: "Không thể đặt học kỳ này là kỳ hiện tại vì ngày hôm nay không nằm trong thời gian mở của học kỳ" });
        }
        
        await Semester.updateMany({ isActive: true }, { isActive: false });
      }
      semester.isActive = isActive;
    }

    const updated = await semester.save();
    res.json(updated);
  } catch (err) {
    console.error("Lỗi cập nhật học kỳ:", err);
    res.status(500).json({ message: err.message || "Lỗi server" });
  }
});

// DELETE: Xóa học kỳ
router.delete("/:id", async (req, res) => {
  try {
    const semester = await Semester.findById(req.params.id);
    if (!semester) {
      return res.status(404).json({ message: "Không tìm thấy học kỳ" });
    }

    // Kiểm tra xem có lớp nào đang dùng học kỳ này không
    const Class = require("../models/Class");
    const classUsing = await Class.findOne({ semester: req.params.id });
    if (classUsing) {
      return res.status(400).json({
        message: "Không thể xóa học kỳ vì đang có lớp học sử dụng",
      });
    }

    await Semester.findByIdAndDelete(req.params.id);
    res.json({ message: "Xóa học kỳ thành công" });
  } catch (err) {
    console.error("Lỗi xóa học kỳ:", err);
    res.status(500).json({ message: err.message || "Lỗi server" });
  }
});

module.exports = router;