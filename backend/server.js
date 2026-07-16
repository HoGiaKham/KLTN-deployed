// server.js
// ⚠️ CRITICAL: Load dotenv FIRST before any other imports
const dotenv = require("dotenv");
dotenv.config();

// Debug: Verify environment variables are loaded
console.log('🔧 Environment loaded:');
console.log('   PORT:', process.env.PORT);
console.log('   NODE_ENV:', process.env.NODE_ENV);
console.log('   ANTHROPIC_API_KEY:', process.env.ANTHROPIC_API_KEY ? '✅ Loaded' : '❌ Missing');

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const connectDB = require("./src/config/db");
const path = require("path");

// Import routes (AFTER dotenv.config())
const subjectRoutes = require("./src/routes/subjectRoutes");
const categoryRoutes = require("./src/routes/categoryRoutes");
const questionRoutes = require("./src/routes/questionRoutes");
const practiceExamRoutes = require("./src/routes/practiceExamRoutes");
const testExamRoutes = require("./src/routes/testExamRoutes");
const teachingAssignmentRoutes = require("./src/routes/teachingAssignment");
const userRoutes = require("./src/routes/userRoutes");
const semesterRoutes = require("./src/routes/semesterRoutes");
const classRoutes = require("./src/routes/classRoutes");
const examRoutes = require("./src/routes/testExamRoutes");
const chatRoutes = require("./src/routes/chatRoutes");
const examAnalysisRoutes = require("./src/routes/examAnalysisRoutes");

// Import Socket.IO handler
const initializeChatSocket = require("./src/sockets/chatSocket");

const app = express(); // BÂY GIỜ MỚI CÓ express!
const server = http.createServer(app);

// Initialize Socket.IO with CORS
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === "production"
      ? ["https://kltn-gamma.vercel.app", "https://khoaluantotnghiep-5ff3.onrender.com"]
      : ["http://localhost:3000"],
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Initialize chat socket handlers
initializeChatSocket(io);

// Middleware
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Kết nối DB
connectDB();

// === ROUTES ===
app.use("/api/subjects", subjectRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/questions", questionRoutes);
app.use("/api/practice-exams", practiceExamRoutes);
app.use("/api/test-exams", testExamRoutes);
app.use("/api/teaching-assignments", teachingAssignmentRoutes);
app.use("/api/users", userRoutes);
app.use("/api/semesters", semesterRoutes);
app.use("/api/classes", classRoutes);
app.use("/api/exams", examRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/exam-analysis", examAnalysisRoutes);
// Trang chủ
app.get("/", (req, res) => {
  res.send("API is running... Welcome to Exam Management System!");
});

// 404 Handler
app.use("*", (req, res) => {
  res.status(404).json({ message: `Không tìm thấy route: ${req.originalUrl}` });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error("Server error:", err.stack);
  res.status(err.status || 500).json({
    message: err.message || "Server error",
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
});

// Start Server with Socket.IO
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`API Docs: http://localhost:${PORT}/api`);
  console.log(`Socket.IO ready for chat connections`);
});