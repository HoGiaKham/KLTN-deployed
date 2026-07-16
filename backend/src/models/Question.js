const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    options: [{ type: String, required: true }],
    correctAnswer: { type: Number, required: true },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true
    },
    // ✅ FIX: Dùng 'image' trong DB, nhưng thêm getter để trả về dạng URL
    image: { type: String },
    difficulty: {
      type: String,
      enum: ["Dễ", "Trung bình", "Khó", "Rất khó"],
      default: "Trung bình"
    }
  },
  {
    timestamps: true,
    // ✅ FIX: Thêm virtual field 'imageUrl' để auto-convert từ 'image'
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// ✅ FIX: Virtual field - auto-convert image thành imageUrl
questionSchema.virtual('imageUrl').get(function() {
  return this.image ? `/uploads/${this.image}` : null;
});

module.exports = mongoose.model("Question", questionSchema);