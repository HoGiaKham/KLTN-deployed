const mongoose = require("mongoose");

const chatRoomSchema = new mongoose.Schema(
  {
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    class: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: true,
    },
    lastMessage: {
      content: String,
      sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      timestamp: Date,
      isImage: {
        type: Boolean,
        default: false,
      },
    },
    unreadCount: {
      teacher: {
        type: Number,
        default: 0,
      },
      student: {
        type: Number,
        default: 0,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Unique index to prevent duplicate rooms for same teacher-student-class combination
chatRoomSchema.index({ teacher: 1, student: 1, class: 1 }, { unique: true });

module.exports = mongoose.model("ChatRoom", chatRoomSchema);
