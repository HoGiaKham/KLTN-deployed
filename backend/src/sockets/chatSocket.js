const jwt = require("jsonwebtoken");
const ChatRoom = require("../models/ChatRoom");
const Message = require("../models/Message");
const Class = require("../models/Class");

/**
 * Initialize Socket.IO for chat functionality
 * @param {Socket.Server} io - Socket.IO server instance
 */
function initializeChatSocket(io) {
  // Middleware: Authenticate socket connections using JWT
  io.use((socket, next) => {
    const { token } = socket.handshake.auth;

    if (!token) {
      return next(new Error("Authentication required"));
    }

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET || "default_jwt_secret");
      socket.userId = payload.id;
      socket.userRole = payload.role;
      next();
    } catch (err) {
      console.error("Socket JWT verification failed:", err.message);
      return next(new Error("Invalid authentication token"));
    }
  });

  io.on("connection", (socket) => {
    console.log(`✅ User connected: ${socket.userId} (${socket.userRole})`);

    // Join personal notification room
    socket.join(`user:${socket.userId}`);

    // === EVENT: JOIN ROOM ===
    socket.on("join_room", async (roomId) => {
      try {
        // Get room and validate access
        const room = await ChatRoom.findById(roomId)
          .populate("teacher student class");

        if (!room) {
          return socket.emit("error", { message: "Room not found" });
        }

        // Validate access
        const hasAccess = await validateRoomAccess(
          socket.userId,
          socket.userRole,
          room
        );

        if (!hasAccess) {
          return socket.emit("error", { message: "Access denied" });
        }

        // Join room
        socket.join(`room:${roomId}`);
        socket.currentRoomId = roomId;

        socket.emit("room_joined", { roomId });
        console.log(`📥 User ${socket.userId} joined room ${roomId}`);
      } catch (error) {
        console.error("Error joining room:", error);
        socket.emit("error", { message: "Failed to join room" });
      }
    });

    // === EVENT: SEND MESSAGE ===
    socket.on("send_message", async (data) => {
      try {
        const { roomId, content, messageType = "text", image } = data;

        // Validate room access
        const room = await ChatRoom.findById(roomId)
          .populate("teacher student class");

        if (!room) {
          return socket.emit("error", { message: "Room not found" });
        }

        const hasAccess = await validateRoomAccess(
          socket.userId,
          socket.userRole,
          room
        );

        if (!hasAccess) {
          return socket.emit("error", { message: "Access denied" });
        }

        // Create message
        const message = new Message({
          chatRoom: roomId,
          sender: socket.userId,
          messageType,
          content: messageType === "text" ? content : undefined,
          image: messageType === "image" ? image : undefined,
        });

        await message.save();
        await message.populate("sender", "name email avatar");

        // Update room's last message
        room.lastMessage = {
          content: messageType === "text" ? content : "📷 Hình ảnh",
          sender: socket.userId,
          timestamp: new Date(),
          isImage: messageType === "image",
        };

        // Increment unread count for receiver
        const receiverRole = socket.userRole === "teacher" ? "student" : "teacher";
        room.unreadCount[receiverRole] += 1;

        await room.save();

        // Emit to all users in room
        io.to(`room:${roomId}`).emit("new_message", {
          message,
          roomId,
        });

        // Send notification to receiver
        const receiverId =
          socket.userRole === "teacher"
            ? room.student._id.toString()
            : room.teacher._id.toString();

        io.to(`user:${receiverId}`).emit("notification", {
          type: "new_message",
          roomId,
          unreadCount: room.unreadCount[receiverRole],
          preview: room.lastMessage.content,
        });

        console.log(`📨 Message sent in room ${roomId}`);
      } catch (error) {
        console.error("Error sending message:", error);
        socket.emit("error", { message: "Failed to send message" });
      }
    });

    // === EVENT: READ MESSAGES ===
    socket.on("read_messages", async (roomId) => {
      try {
        const room = await ChatRoom.findById(roomId);

        if (!room) {
          return socket.emit("error", { message: "Room not found" });
        }

        // Validate access
        const hasAccess = await validateRoomAccess(
          socket.userId,
          socket.userRole,
          room
        );

        if (!hasAccess) {
          return socket.emit("error", { message: "Access denied" });
        }

        // Mark messages as read
        await Message.updateMany(
          {
            chatRoom: roomId,
            sender: { $ne: socket.userId },
            isRead: false,
          },
          {
            isRead: true,
            readAt: new Date(),
          }
        );

        // Reset unread count
        const userRole = socket.userRole;
        room.unreadCount[userRole] = 0;
        await room.save();

        // Notify all users in room
        io.to(`room:${roomId}`).emit("messages_read", { roomId });

        console.log(`✅ Messages read in room ${roomId}`);
      } catch (error) {
        console.error("Error reading messages:", error);
        socket.emit("error", { message: "Failed to mark messages as read" });
      }
    });

    // === EVENT: TYPING ===
    socket.on("typing", (roomId) => {
      socket.to(`room:${roomId}`).emit("user_typing", {
        userId: socket.userId,
        roomId,
      });
    });

    // === EVENT: STOP TYPING ===
    socket.on("stop_typing", (roomId) => {
      socket.to(`room:${roomId}`).emit("user_stop_typing", {
        userId: socket.userId,
        roomId,
      });
    });

    // === EVENT: DISCONNECT ===
    socket.on("disconnect", () => {
      console.log(`❌ User disconnected: ${socket.userId}`);
    });
  });
}

/**
 * Validate user access to chat room
 * @param {string} userId - User ID
 * @param {string} userRole - User role (teacher/student)
 * @param {Object} room - ChatRoom document
 * @returns {Promise<boolean>} - True if user has access
 */
async function validateRoomAccess(userId, userRole, room) {
  try {
    // Get class document
    const classDoc = await Class.findById(room.class._id);

    if (!classDoc) {
      return false;
    }

    // For students: check if in class
    if (userRole === "student") {
      const isInClass = classDoc.students.some(
        (studentId) => studentId.toString() === userId
      );
      const isRoomStudent = room.student._id.toString() === userId;
      return isInClass && isRoomStudent;
    }

    // For teachers: check if teaching class
    if (userRole === "teacher") {
      const isTeacher = classDoc.teacher.toString() === userId;
      const isRoomTeacher = room.teacher._id.toString() === userId;
      return isTeacher && isRoomTeacher;
    }

    return false;
  } catch (error) {
    console.error("Error validating room access:", error);
    return false;
  }
}

module.exports = initializeChatSocket;
