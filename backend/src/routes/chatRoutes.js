const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const ChatRoom = require("../models/ChatRoom");
const Message = require("../models/Message");
const Class = require("../models/Class");

// Multer configuration for chat images
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, "../../uploads/chat");

    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "chat-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error("Only image files are allowed (jpeg, jpg, png, gif)"));
    }
  },
});

// === GET /api/chat/rooms/:userId?role= ===
// Get all chat rooms for a user
router.get("/rooms/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.query;

    if (!userId || !role) {
      return res.status(400).json({ message: "userId and role are required" });
    }

    let rooms;
    if (role === "teacher") {
      rooms = await ChatRoom.find({ teacher: userId })
        .populate("student", "name email avatar")
        .populate("class", "name")
        .sort({ "lastMessage.timestamp": -1 });
    } else if (role === "student") {
      rooms = await ChatRoom.find({ student: userId })
        .populate("teacher", "name email avatar")
        .populate("class", "name")
        .sort({ "lastMessage.timestamp": -1 });
    } else {
      return res.status(400).json({ message: "Invalid role" });
    }

    res.json(rooms);
  } catch (error) {
    console.error("Error fetching chat rooms:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// === GET /api/chat/available-teachers/:studentId ===
// Get teachers from student's classes
router.get("/available-teachers/:studentId", async (req, res) => {
  try {
    const { studentId } = req.params;

    // Find all classes where student is enrolled
    const classes = await Class.find({ students: studentId })
      .populate("teacher", "name email avatar")
      .populate("subject", "name");

    // Extract unique teachers with class info
    const teachers = classes.map((cls) => ({
      teacher: cls.teacher,
      class: {
        _id: cls._id,
        name: cls.name,
      },
      subject: cls.subject,
    }));

    res.json(teachers);
  } catch (error) {
    console.error("Error fetching available teachers:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// === POST /api/chat/rooms ===
// Create or get existing chat room
router.post("/rooms", async (req, res) => {
  try {
    const { teacherId, studentId, classId } = req.body;

    if (!teacherId || !studentId || !classId) {
      return res.status(400).json({ message: "teacherId, studentId, and classId are required" });
    }

    // Validate: Check if student is in class
    const classDoc = await Class.findById(classId);
    if (!classDoc) {
      return res.status(404).json({ message: "Class not found" });
    }

    const isStudentInClass = classDoc.students.some(
      (id) => id.toString() === studentId
    );

    if (!isStudentInClass) {
      return res.status(403).json({ message: "Student is not enrolled in this class" });
    }

    // Validate: Check if teacher teaches this class
    if (classDoc.teacher.toString() !== teacherId) {
      return res.status(403).json({ message: "Teacher does not teach this class" });
    }

    // Find or create room
    let room = await ChatRoom.findOne({
      teacher: teacherId,
      student: studentId,
      class: classId,
    })
      .populate("teacher", "name email avatar")
      .populate("student", "name email avatar")
      .populate("class", "name");

    if (!room) {
      room = new ChatRoom({
        teacher: teacherId,
        student: studentId,
        class: classId,
      });
      await room.save();

      // Populate after saving
      room = await ChatRoom.findById(room._id)
        .populate("teacher", "name email avatar")
        .populate("student", "name email avatar")
        .populate("class", "name");
    }

    res.json(room);
  } catch (error) {
    console.error("Error creating/getting chat room:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// === GET /api/chat/messages/:roomId ===
// Get messages for a room (paginated)
router.get("/messages/:roomId", async (req, res) => {
  try {
    const { roomId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    // Verify room exists
    const room = await ChatRoom.findById(roomId);
    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    // Get messages
    const messages = await Message.find({ chatRoom: roomId })
      .populate("sender", "name email avatar")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset));

    // Reverse to show oldest first
    messages.reverse();

    res.json(messages);
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// === POST /api/chat/upload-image ===
// Upload image for chat
router.post("/upload-image", upload.single("image"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No image uploaded" });
    }

    res.json({
      filename: req.file.filename,
      imageUrl: `/uploads/chat/${req.file.filename}`,
    });
  } catch (error) {
    console.error("Error uploading image:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// === GET /api/chat/unread-count/:userId?role= ===
// Get total unread count for user
router.get("/unread-count/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.query;

    if (!userId || !role) {
      return res.status(400).json({ message: "userId and role are required" });
    }

    let rooms;
    if (role === "teacher") {
      rooms = await ChatRoom.find({ teacher: userId });
    } else if (role === "student") {
      rooms = await ChatRoom.find({ student: userId });
    } else {
      return res.status(400).json({ message: "Invalid role" });
    }

    // Sum up unread counts
    const totalUnread = rooms.reduce((sum, room) => {
      return sum + (room.unreadCount[role] || 0);
    }, 0);

    res.json({ unreadCount: totalUnread });
  } catch (error) {
    console.error("Error fetching unread count:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;
