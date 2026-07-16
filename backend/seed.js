const mongoose = require("mongoose");
const dotenv = require("dotenv");
const Subject = require("./src/models/Subject");

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/nganhangcauhoi";

const subjects = [
    { name: "Lập trình Cơ bản", description: "Intro to programming" },
    { name: "Cơ sở dữ liệu", description: "Database systems" },
    { name: "Mạng máy tính", description: "Computer networks" }
];

const seedSubjects = async () => {
  try {
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    await Subject.deleteMany();
    await Subject.insertMany(subjects);

    console.log("✅ Subjects inserted thành công!");
    process.exit();
  } catch (err) {
    console.error("❌ Lỗi khi seed subjects:", err);
    process.exit(1);
  }
};

seedSubjects();
