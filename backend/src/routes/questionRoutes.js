const express = require("express");
const router = express.Router();
const Question = require("../models/Question");
const multer = require("multer");
const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");

// ✅ Helper function: Escape regex special characters
const escapeRegex = (str) => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

// ✅ Helper function: Extract text from HTML (for comparison only)
const extractTextFromHTML = (str) => {
  return str
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .trim()
    .replace(/\s+/g, ' '); // Replace multiple spaces with single space
};

// ✅ Helper function: Normalize title (preserve HTML for storage, extract text for comparison)
const normalizeTitle = (str) => {
  // Nếu là HTML content (chứa tags), giữ nguyên; nếu không có tags thì chuẩn hóa
  if (/<[^>]*>/.test(str)) {
    return str; // Keep HTML content as is
  }
  // Nếu là plain text, chuẩn hóa
  return str.trim().replace(/\s+/g, ' ');
};

// ================= MULTER CONFIG =================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../../uploads");
    // Tạo folder nếu không tồn tại
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

// ✅ FIX: Sửa fileFilter để accept Excel files
const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel', // .xls
    'image/jpeg',
    'image/png',
    'image/gif'
  ];

  const allowedExtensions = ['.xlsx', '.xls', '.jpg', '.jpeg', '.png', '.gif'];
  
  const ext = path.extname(file.originalname).toLowerCase();
  const mime = file.mimetype;

  console.log(`📄 File upload: ${file.originalname}`);
  console.log(`   Mime: ${mime}`);
  console.log(`   Extension: ${ext}`);

  if (allowedMimes.includes(mime) && allowedExtensions.includes(ext)) {
    console.log(`   ✅ Chấp nhận`);
    cb(null, true);
  } else {
    console.log(`   ❌ Từ chối`);
    cb(new Error("Chỉ cho phép file Excel (.xlsx, .xls) hoặc ảnh (.jpg, .png, .gif)!"));
  }
};

const upload = multer({ storage, fileFilter });

// =================================================

// ✅ THÊM: Route upload ảnh đơn lẻ
router.post("/upload-image", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Không có file ảnh" });
    }

    const imageUrl = `/uploads/${req.file.filename}`;
    console.log(`✅ Upload ảnh: ${imageUrl}`);

    res.json({ imageUrl });
  } catch (err) {
    console.error("Lỗi upload ảnh:", err);
    res.status(500).json({ error: err.message });
  }
});

// =================================================

// GET tất cả question theo categoryId
router.get("/:categoryId", async (req, res) => {
  try {
    let questions = await Question.find({ categoryId: req.params.categoryId }).sort({ createdAt: 1 });

    questions = questions.map(q => ({
      ...q.toObject(),
      imageUrl: q.image ? `/uploads/${q.image}` : null
    }));
    res.json(questions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST - thêm question
router.post("/:categoryId", upload.single("image"), async (req, res) => {
  try {
    let options = req.body.options;
    if (typeof options === "string") {
      try {
        options = JSON.parse(options);
      } catch {
        options = [options];
      }
    }

    // ✅ Kiểm tra trùng câu hỏi trong danh mục (so sánh text, bỏ qua HTML formatting)
    const textFromTitle = extractTextFromHTML(req.body.title);

    const existingQuestion = await Question.findOne({
      categoryId: req.params.categoryId
    });

    // Compare text content only (ignore HTML formatting)
    const isDuplicate = existingQuestion &&
      extractTextFromHTML(existingQuestion.title).toLowerCase() === textFromTitle.toLowerCase();

    if (isDuplicate) {
      return res.status(409).json({
        message: "Câu hỏi này đã tồn tại trong danh mục!"
      });
    }

    // ✅ Save title with HTML formatting preserved
    // ✅ Keep options as is (with potential HTML formatting)
    const question = new Question({
      title: req.body.title, // ✅ Keep HTML content for display
      options: options, // ✅ Keep options as provided (with formatting)
      correctAnswer: req.body.correctAnswer,
      categoryId: req.params.categoryId,
      image: req.file ? req.file.filename : null,
      difficulty: req.body.difficulty || "Trung bình"
    });

    const saved = await question.save();
    res.status(201).json({
      ...saved.toObject(),
      imageUrl: saved.image ? `/uploads/${saved.image}` : null
    });
  } catch (err) {
    console.error("Error adding question:", err);
    res.status(400).json({ message: err.message });
  }
});

// PUT - cập nhật question
router.put("/:id", upload.single("image"), async (req, res) => {
  try {
    let options = req.body.options;
    if (typeof options === "string") {
      try {
        options = JSON.parse(options);
      } catch {
        options = [options];
      }
    }

    // ✅ Kiểm tra trùng câu hỏi (ngoài trừ chính nó)
    const currentQuestion = await Question.findById(req.params.id);
    if (!currentQuestion) {
      return res.status(404).json({ message: "Question not found" });
    }

    // ✅ Kiểm tra trùng câu hỏi (so sánh text content, bỏ qua HTML formatting)
    const textFromUpdateTitle = extractTextFromHTML(req.body.title);

    const existingQuestion = await Question.findOne({
      _id: { $ne: req.params.id }, // Exclude current question
      categoryId: currentQuestion.categoryId
    });

    // Compare text content only (ignore HTML formatting)
    if (existingQuestion &&
      extractTextFromHTML(existingQuestion.title).toLowerCase() === textFromUpdateTitle.toLowerCase()) {
      return res.status(409).json({
        message: "Câu hỏi này đã tồn tại trong danh mục!"
      });
    }

    // ✅ Keep title and options with HTML formatting
    const updateData = {
      title: req.body.title, // ✅ Keep HTML content for display
      options: options, // ✅ Keep options as provided (with formatting)
      correctAnswer: req.body.correctAnswer,
      difficulty: req.body.difficulty
    };

    if (req.file) {
      updateData.image = req.file.filename;
    }

    const updated = await Question.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!updated) return res.status(404).json({ message: "Question not found" });

    res.json({
      ...updated.toObject(),
      imageUrl: updated.image ? `/uploads/${updated.image}` : null
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE question - with check for usage in exams
router.delete("/:id", async (req, res) => {
  try {
    const questionId = req.params.id;
    const PracticeExam = require("../models/PracticeExam");
    const Exam = require("../models/Exam");

    // ✅ Check if question is used in Practice Exams
    const practiceExamsUsing = await PracticeExam.find({
      questions: { $in: [questionId] }
    }).select("title");

    // ✅ Check if question is used in Test Exams
    const testExamsUsing = await Exam.find({
      "questions.questionId": questionId
    }).select("title status");

    // ✅ If question is used in any exam, return error with details
    if (practiceExamsUsing.length > 0 || testExamsUsing.length > 0) {
      return res.status(409).json({
        message: "Không thể xóa câu hỏi này vì nó đã được sử dụng trong các đề thi!",
        inPracticeExams: practiceExamsUsing.map(exam => exam.title),
        inTestExams: testExamsUsing.map(exam => ({
          title: exam.title,
          status: exam.status
        })),
        totalUsages: practiceExamsUsing.length + testExamsUsing.length
      });
    }

    // ✅ Only delete if not used in any exam
    const deleted = await Question.findByIdAndDelete(questionId);
    if (!deleted) return res.status(404).json({ message: "Câu hỏi không tìm thấy" });

    // ✅ Delete image file if exists
    if (deleted.image) {
      const imgPath = path.join(__dirname, "../../uploads/", deleted.image);
      if (fs.existsSync(imgPath)) {
        fs.unlinkSync(imgPath);
      }
    }

    res.json({
      message: "Xóa câu hỏi thành công",
      deletedId: deleted._id
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ============= IMPORT TỪ EXCEL + UPLOAD ẢNH TRỰC TIẾP =============
router.post("/:categoryId/import", upload.fields([
  { name: 'file', maxCount: 1 },
  { name: 'images', maxCount: 50 }
]), async (req, res) => {
  let uploadedFilePath = null;

  try {
    console.log("\n========== IMPORT BẮTĐẦU ==========");
    console.log("Time:", new Date().toLocaleString("vi-VN"));

    // Kiểm tra file Excel
    if (!req.files || !req.files.file || req.files.file.length === 0) {
      console.log("❌ Lỗi: Không nhận được file Excel");
      return res.status(400).json({
        success: false,
        message: "Vui lòng chọn file Excel."
      });
    }

    const excelFile = req.files.file[0];
    uploadedFilePath = excelFile.path;
    console.log("✅ File Excel nhận được:", excelFile.originalname);
    console.log("📁 Path:", uploadedFilePath);
    console.log("CategoryId:", req.params.categoryId);

    // ✅ Xử lý ảnh upload
    let imageMap = {};
    if (req.files.images && req.files.images.length > 0) {
      console.log(`📸 Nhận được ${req.files.images.length} ảnh`);
      req.files.images.forEach((img, idx) => {
        const imageName = img.originalname;
        const imageFilename = img.filename;
        imageMap[imageName] = imageFilename;
        console.log(`   ${idx + 1}. ${imageName} → ${imageFilename}`);
      });
    } else {
      console.log("📸 Không có ảnh nào");
    }

    // Kiểm tra file tồn tại
    if (!fs.existsSync(uploadedFilePath)) {
      console.log("❌ Lỗi: File không tồn tại");
      return res.status(400).json({ 
        success: false,
        message: "File upload lỗi." 
      });
    }

    console.log("✅ File tồn tại");

    // Đọc file Excel
    let workbook;
    try {
      workbook = XLSX.readFile(uploadedFilePath);
      console.log("✅ Đọc file thành công");
      console.log("📊 Sheets:", workbook.SheetNames);
    } catch (readErr) {
      console.error("❌ Lỗi đọc file Excel:", readErr.message);
      return res.status(400).json({ 
        success: false,
        message: "Không thể đọc file Excel. Vui lòng kiểm tra định dạng file." 
      });
    }

    // Lấy sheet đầu tiên
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      console.log("❌ Lỗi: File Excel không có sheet nào");
      return res.status(400).json({ 
        success: false,
        message: "File Excel trống." 
      });
    }

    console.log("📄 Đang xử lý sheet:", sheetName);

    const worksheet = workbook.Sheets[sheetName];
    let jsonData = [];

    try {
      jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      console.log("✅ Parse sheet thành công, tổng dòng:", jsonData.length);
    } catch (parseErr) {
      console.error("❌ Lỗi parse sheet:", parseErr.message);
      return res.status(400).json({ 
        success: false,
        message: "Lỗi khi đọc dữ liệu Excel." 
      });
    }

    // Kiểm tra dữ liệu
    if (jsonData.length < 2) {
      console.log("❌ Lỗi: File Excel không có dữ liệu (chỉ có header)");
      return res.status(400).json({ 
        success: false,
        message: "File Excel không có dữ liệu. Vui lòng thêm ít nhất 1 câu hỏi." 
      });
    }

    console.log(`📈 Bắt đầu import ${jsonData.length - 1} dòng...`);

    let importedCount = 0;
    const errors = [];

    // Xử lý từng dòng
    for (let i = 1; i < jsonData.length; i++) {
      try {
        const row = jsonData[i];

        // Bỏ qua dòng trống
        if (!row || row.length === 0 || !row[0]) {
          continue;
        }

        const title = String(row[0] || "").trim();
        const optionA = String(row[1] || "").trim();
        const optionB = String(row[2] || "").trim();
        const optionC = String(row[3] || "").trim();
        const optionD = String(row[4] || "").trim();
        const correctIndexRaw = row[5];
        const difficultyRaw = String(row[6] || "Trung bình").trim();
        const imageNameRaw = row[7] ? String(row[7]).trim() : null;

        // Convert correctIndex to number
        let correctIndex = NaN;
        if (typeof correctIndexRaw === "number") {
          correctIndex = correctIndexRaw;
        } else if (typeof correctIndexRaw === "string") {
          correctIndex = parseInt(correctIndexRaw, 10);
        }

        // Validate câu hỏi
        if (!title || title.length === 0) {
          errors.push(`Dòng ${i + 1}: Câu hỏi không được để trống.`);
          continue;
        }

        // Validate đáp án đúng
        if (isNaN(correctIndex) || correctIndex < 0 || correctIndex > 3) {
          errors.push(`Dòng ${i + 1}: Đáp án đúng phải là 0, 1, 2 hoặc 3 (nhận: ${correctIndexRaw})`);
          continue;
        }

        // Validate độ khó
        const validDifficulties = ["Dễ", "Trung bình", "Khó", "Rất khó"];
        const difficulty = validDifficulties.includes(difficultyRaw) ? difficultyRaw : "Trung bình";

        // Tạo mảng đáp án
        const options = [];
        if (optionA) options.push(optionA);
        if (optionB) options.push(optionB);
        if (optionC) options.push(optionC);
        if (optionD) options.push(optionD);

        // Validate ít nhất 2 đáp án
        if (options.length < 2) {
          errors.push(`Dòng ${i + 1}: Phải có ít nhất 2 đáp án (có: ${options.length})`);
          continue;
        }

        // Validate đáp án đúng trong phạm vi
        if (correctIndex >= options.length) {
          errors.push(`Dòng ${i + 1}: Đáp án đúng (${correctIndex}) vượt quá số đáp án (${options.length})`);
          continue;
        }

        // ✅ THÊM: Xử lý ảnh (từ upload hoặc đường dẫn local)
        let imagePath = null;
        let hasImageError = false;

        console.log(`   🔍 Dòng ${i + 1}: imageNameRaw = "${imageNameRaw}"`);

        // Nếu có tên file ảnh trong imageMap (upload cùng Excel)
        if (imageNameRaw && imageMap[imageNameRaw]) {
          imagePath = imageMap[imageNameRaw];
          console.log(`   ✅ Dòng ${i + 1}: Tìm thấy ảnh trong imageMap: ${imageNameRaw} → ${imagePath}`);
        }
        // Nếu là đường dẫn file trên máy (ví dụ: C:\Pictures\hanoi.jpg)
        else if (imageNameRaw && (imageNameRaw.includes('\\') || imageNameRaw.includes('/'))) {
          console.log(`   🔍 Dòng ${i + 1}: Phát hiện đường dẫn file: ${imageNameRaw}`);
          try {
            // Kiểm tra file tồn tại
            console.log(`   🔍 Kiểm tra file tồn tại: ${imageNameRaw}`);
            if (fs.existsSync(imageNameRaw)) {
              const ext = path.extname(imageNameRaw);
              const newFilename = Date.now() + '_' + Math.random().toString(36).substring(7) + ext;
              const destPath = path.join(__dirname, '../../uploads', newFilename);

              console.log(`   📁 Đường dẫn đích: ${destPath}`);
              // Copy file vào uploads
              fs.copyFileSync(imageNameRaw, destPath);
              imagePath = newFilename;
              console.log(`   ✅ Copy ảnh thành công: ${imageNameRaw} → ${newFilename}`);
            } else {
              console.warn(`   ⚠️ Dòng ${i + 1}: File ảnh KHÔNG tồn tại: ${imageNameRaw}`);
              const imageError = `Dòng ${i + 1}: Không tìm thấy file ảnh: "${imageNameRaw}". Vui lòng kiểm tra đường dẫn hoặc upload file ảnh.`;
              errors.push(imageError);
              hasImageError = true;
            }
          } catch (copyErr) {
            console.error(`   ❌ Dòng ${i + 1}: Lỗi copy ảnh: ${copyErr.message}`);
            console.error(`   Stack: ${copyErr.stack}`);
            const imageError = `Dòng ${i + 1}: Lỗi xử lý ảnh "${imageNameRaw}": ${copyErr.message}`;
            errors.push(imageError);
            hasImageError = true;
          }
        } else if (imageNameRaw) {
          console.log(`   ⚠️ Dòng ${i + 1}: imageNameRaw không khớp điều kiện nào: "${imageNameRaw}"`);
          const imageError = `Dòng ${i + 1}: Tên ảnh "${imageNameRaw}" không khớp với file đã upload. Vui lòng kiểm tra tên file hoặc upload ảnh.`;
          errors.push(imageError);
          hasImageError = true;
        }

        // ✅ Nếu có lỗi ảnh, bỏ qua dòng này không import
        if (hasImageError) {
          console.warn(`   ⚠️ Dòng ${i + 1}: Bỏ qua vì có lỗi ảnh`);
          continue;
        }

        // ✅ Kiểm tra trùng câu hỏi trong danh mục (normalize + escape)
        const normalizedExcelTitle = normalizeTitle(title);
        const escapedExcelTitle = escapeRegex(normalizedExcelTitle);

        const existingQuestion = await Question.findOne({
          categoryId: req.params.categoryId,
          title: { $regex: `^${escapedExcelTitle}$`, $options: 'i' }
        });

        if (existingQuestion) {
          console.warn(`   ⚠️ Dòng ${i + 1}: Câu hỏi TRÙNG (bỏ qua): "${title}"`);
          errors.push(`Dòng ${i + 1}: Câu hỏi này đã tồn tại trong danh mục.`);
          continue;
        }

        // Tạo document câu hỏi
        const question = new Question({
          title: normalizedExcelTitle, // ✅ Save normalized title
          options: options,
          correctAnswer: correctIndex,
          categoryId: req.params.categoryId,
          difficulty: difficulty,
          image: imagePath  // ✅ THÊM: Save ảnh filename
        });

        // Lưu vào database
        await question.save();
        importedCount++;
        console.log(`  ✅ Dòng ${i + 1}: Import thành công${imagePath ? ` (ảnh: ${imagePath})` : ""}`);

      } catch (rowErr) {
        console.error(`  ❌ Dòng ${i + 1}: ${rowErr.message}`);
        errors.push(`Dòng ${i + 1}: ${rowErr.message}`);
      }
    }

    console.log(`\n📊 Kết quả import:`);
    console.log(`   Thành công: ${importedCount} câu`);
    console.log(`   Lỗi: ${errors.length} dòng`);

    // Xóa file Excel sau khi xử lý
    try {
      if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
        fs.unlinkSync(uploadedFilePath);
        console.log("✅ Xóa file Excel thành công");
      }
    } catch (deleteErr) {
      console.error("⚠️ Lỗi xóa file:", deleteErr.message);
    }

    console.log("========== IMPORT KẾT THÚC ==========\n");

    // Trả về response
    return res.status(200).json({
      success: true,
      message: `Import thành công ${importedCount} câu hỏi.`,
      imported: importedCount,
      errors: errors.length > 0 ? errors : null
    });

  } catch (err) {
    console.error("\n❌ LỖI CHUNG:", err);
    console.error("Stack:", err.stack);

    // Xóa file nếu lỗi
    if (uploadedFilePath) {
      try {
        if (fs.existsSync(uploadedFilePath)) {
          fs.unlinkSync(uploadedFilePath);
        }
      } catch (deleteErr) {
        console.error("Lỗi xóa file:", deleteErr.message);
      }
    }

    return res.status(500).json({
      success: false,
      message: `Lỗi: ${err.message}`,
      error: err.message
    });
  }
});

module.exports = router;