const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    chatRoom: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ChatRoom",
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    messageType: {
      type: String,
      enum: ["text", "image"],
      default: "text",
    },
    content: {
      type: String,
      required: function () {
        return this.messageType === "text";
      },
    },
    image: {
      type: String, // filename only
      required: function () {
        return this.messageType === "image";
      },
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    readAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Virtual field for full image URL
messageSchema.virtual("imageUrl").get(function () {
  if (this.image) {
    return `/uploads/chat/${this.image}`;
  }
  return null;
});

// Ensure virtuals are included in JSON output
messageSchema.set("toJSON", { virtuals: true });
messageSchema.set("toObject", { virtuals: true });

// Index for efficient querying
messageSchema.index({ chatRoom: 1, createdAt: -1 });

module.exports = mongoose.model("Message", messageSchema);
