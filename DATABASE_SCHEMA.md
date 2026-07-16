# 📊 Sơ Đồ Collections MongoDB

## 🎯 Tổng Quan Hệ Thống

Hệ thống quản lý giáo dục với 10 collections chính, phục vụ quản lý lớp học, bài kiểm tra, câu hỏi và kết quả học tập.

---

## 📋 Collections Chi Tiết

### 1️⃣ **user** (Người dùng)
```
{
  _id: ObjectId,
  username: String (unique) ⭐,
  password: String,
  role: "student" | "teacher" | "admin",
  name: String,
  subjects: [String],
  className: String,
  createdAt: Date,
  updatedAt: Date
}
```
**Mô tả:** Lưu thông tin người dùng (học sinh, giáo viên, admin)
**Vai trò:** Xác thực, phân quyền

---

### 2️⃣ **semesters** (Học kỳ)
```
{
  _id: ObjectId,
  name: String (unique) ⭐,
  startDate: Date,
  endDate: Date,
  isActive: Boolean (default: false),
  createdAt: Date,
  updatedAt: Date
}
```
**Mô tả:** Các học kỳ trong năm (HK1, HK2, Hè...)
**Liên kết:** 1 semester → nhiều classes

---

### 3️⃣ **Subject** (Môn học)
```
{
  _id: ObjectId,
  name: String (unique) ⭐,
  description: String,
  createdAt: Date,
  updatedAt: Date
}
```
**Mô tả:** Môn học (Toán, Lý, Hóa, Văn...)
**Liên kết:** 1 subject → nhiều classes, exams, practiceExams

---

### 4️⃣ **classes** (Lớp học)
```
{
  _id: ObjectId,
  className: String,
  subject: ObjectId (ref: Subject) 🔗,
  teacher: ObjectId (ref: User, nullable),
  semester: ObjectId (ref: Semester) 🔗,
  students: [ObjectId] (ref: User) 🔗,
  exams: [ObjectId] (ref: PracticeExam),
  maxStudents: Number (default: 0),
  createdAt: Date,
  updatedAt: Date
}
```
**Index:** `{ className: 1, subject: 1, semester: 1 }` (unique)
**Mô tả:** Lớp học, chứa nhiều sinh viên
**Liên kết:** 1 class → 1 subject, 1 teacher, 1 semester, nhiều students, nhiều exams

---

### 5️⃣ **Category** (Chuyên đề câu hỏi)
```
{
  _id: ObjectId,
  name: String,
  description: String,
  subjectId: ObjectId (ref: Subject) 🔗,
  createdBy: ObjectId (ref: User),
  createdAt: Date,
  updatedAt: Date
}
```
**Mô tả:** Phân loại câu hỏi theo chuyên đề
**Liên kết:** 1 category → 1 subject, nhiều questions

---

### 6️⃣ **Question** (Câu hỏi)
```
{
  _id: ObjectId,
  title: String,
  options: [String] (4 đáp án: A, B, C, D),
  correctAnswer: Number (0-3),
  categoryId: ObjectId (ref: Category) 🔗,
  image: String (URL hình ảnh),
  difficulty: "Dễ" | "Trung bình" | "Khó" | "Rất khó",
  createdAt: Date,
  updatedAt: Date
}
```
**Mô tả:** Ngân hàng câu hỏi
**Liên kết:** 1 question → 1 category

---

### 7️⃣ **Exam** (Bài kiểm tra chính thức)
```
{
  _id: ObjectId,
  title: String,
  subject: ObjectId (ref: Subject) 🔗,
  categories: [ObjectId] (ref: Category),
  class: ObjectId (ref: Class, nullable),
  duration: Number (phút, default: 60),
  openTime: Date,
  closeTime: Date,
  maxAttempts: Number (default: 1),
  showResultImmediately: Boolean (default: true),
  showCorrectAnswers: Boolean (default: false),
  passingScore: Number (0-100, default: 50),
  shuffleQuestions: Boolean (default: true),
  shuffleOptions: Boolean (default: true),
  status: "draft" | "published",
  questions: [{
    questionId: ObjectId (ref: Question),
    points: Number (default: 1)
  }],
  createdBy: ObjectId (ref: User),
  description: String,
  canViewScore: Boolean (default: false),
  canViewAnswer: Boolean (default: false),
  createdAt: Date,
  updatedAt: Date
}
```
**Mô tả:** Bài kiểm tra chính thức cho lớp học
**Liên kết:** 1 exam → 1 subject, nhiều categories, nhiều questions

---

### 8️⃣ **PracticeExam** (Bài luyện tập)
```
{
  _id: ObjectId,
  title: String,
  subject: ObjectId (ref: Subject) 🔗,
  teacher: ObjectId (ref: User) 🔗,
  class: ObjectId (ref: Class),
  categories: [ObjectId] (ref: Category),
  questions: [ObjectId] (ref: Question),
  duration: Number,
  openTime: Date,
  closeTime: Date,
  attempts: Number,
  scorePerQuestion: Number,
  createdAt: Date
}
```
**Mô tả:** Bài tập luyện để sinh viên ôn tập
**Liên kết:** 1 practiceExam → 1 subject, 1 teacher, 1 class

---

### 9️⃣ **testexamattemptsattempts** (Kết quả làm bài)
```
{
  _id: ObjectId,
  exam: ObjectId (ref: Exam) 🔗,
  student: ObjectId (ref: User) 🔗,
  answers: Map {
    [questionId]: Number (0-3, đáp án sinh viên chọn)
  },
  score: Number,
  totalPoints: Number,
  percentage: Number,
  isPassed: Boolean,
  timeSpent: Number (giây),
  submittedAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```
**Index:** `{ exam: 1, student: 1 }` (unique - sinh viên làm 1 lần/bài)
**Mô tả:** Lưu kết quả khi sinh viên nộp bài
**Liên kết:** 1 attempt → 1 exam, 1 student

---

### 🔟 **teachingassignments** (Phân công giảng dạy)
```
{
  _id: ObjectId,
  teacher: ObjectId (ref: User) 🔗,
  subject: ObjectId (ref: Subject) 🔗,
  class: ObjectId (ref: Class, nullable),
  createdAt: Date,
  updatedAt: Date
}
```
**Index:** `{ class: 1, subject: 1 }` (unique khi class ≠ null)
**Mô tả:** Ghi lại giáo viên nào dạy môn gì ở lớp nào
**Liên kết:** 1 assignment → 1 teacher, 1 subject, 1 class

---

## 🔗 Sơ Đồ Quan Hệ (ER Diagram)

```
┌─────────────────┐
│     user        │
│  (student)      │
│  (teacher)      │
└────────┬────────┘
         │
         ├─→ className → Class (N-1)
         │
         ├─→ subjects → Subject (N-N)
         │
         └─→ role → permission check

┌─────────────────┐
│   Semester      │
│  (HK1, HK2...)  │
└────────┬────────┘
         │
         └─→ classes (1-N)

┌─────────────────┐
│    Subject      │
│ (Toán, Lý...)   │
└────────┬────────┘
         │
         ├─→ classes (1-N)
         │
         ├─→ categories (1-N)
         │
         ├─→ exams (1-N)
         │
         └─→ practiceExams (1-N)

┌──────────────────┐
│    Category      │ (Chuyên đề)
│  (Phép toán...)  │
└────────┬─────────┘
         │
         └─→ questions (1-N)

┌──────────────────┐
│    Question      │
│  (Ngân hàng CĐ)  │
└────────┬─────────┘
         │
         └─→ exams (N-N)
         └─→ practiceExams (N-N)

┌──────────────────┐
│     Class        │
└────────┬─────────┘
         │
         ├─→ subject (N-1) → Subject
         │
         ├─→ teacher (N-1) → User
         │
         ├─→ semester (N-1) → Semester
         │
         ├─→ students (N-N) → User
         │
         └─→ exams (1-N) → PracticeExam

┌──────────────────┐
│      Exam        │ (Kiểm tra chính thức)
│   (Thi giữa kỳ) │
└────────┬─────────┘
         │
         ├─→ subject (N-1) → Subject
         │
         ├─→ class (1-1) → Class
         │
         ├─→ questions (1-N) → Question
         │
         └─→ attempts (1-N) → TestExamAttempt

┌──────────────────┐
│  PracticeExam    │ (Luyện tập)
│   (Bài ôn tập)  │
└────────┬─────────┘
         │
         ├─→ subject (N-1) → Subject
         │
         ├─→ teacher (N-1) → User
         │
         ├─→ class (1-1) → Class
         │
         └─→ questions (1-N) → Question

┌──────────────────┐
│ TestExamAttempt  │ (Kết quả làm bài)
└────────┬─────────┘
         │
         ├─→ exam (N-1) → Exam
         │
         └─→ student (N-1) → User

┌──────────────────┐
│ TeachingAssign   │ (Phân công)
└────────┬─────────┘
         │
         ├─→ teacher (N-1) → User
         │
         ├─→ subject (N-1) → Subject
         │
         └─→ class (N-1) → Class
```

---

## 📊 Dòng Dữ Liệu Chính

### Quy Trình Làm Bài Kiểm Tra:

```
1. Student xem Exam (Class → Exam)
2. Student trả lời câu hỏi
3. Student nộp bài
4. Lưu vào TestExamAttempt {
     exam, student, answers, score,
     totalPoints, percentage, isPassed, timeSpent
   }
5. Teacher xem kết quả từ TestExamAttempt
6. Export Excel với thông tin từ TestExamAttempt + Exam + User
```

---

## 🔑 Thông Tin Quan Trọng

### Collections Chính:
- **user** - Xác thực & phân quyền
- **Class** - Tổ chức lớp học
- **Exam** - Bài kiểm tra chính thức
- **Question** - Ngân hàng câu hỏi
- **TestExamAttempt** - Kết quả làm bài

### Quan Hệ 1-N (Phổ biến):
- 1 Subject → N Categories
- 1 Category → N Questions
- 1 Exam → N Questions (embedded)
- 1 Exam → N TestExamAttempt

### Quan Hệ N-N:
- 1 Class → N Students (User)
- 1 Subject → N Classes

### Field Đặc Biệt:
- **TestExamAttempt.answers** - MongoDB Map `{ [questionId]: answer }`
- **Exam.questions** - Array of embedded objects (questionId + points)
- **status** (Exam) - draft hoặc published

---

## 💡 Ghi Chú Thiết Kế

1. **NoSQL Document-based**: Dữ liệu linh hoạt, không cần schema cứng nhắc
2. **References vs Embedding**:
   - Dùng References (ObjectId) cho quan hệ N-N
   - Embed objects cho dữ liệu nhỏ (exam questions)
3. **Indexes**:
   - Class: unique trên (className, subject, semester)
   - TestExamAttempt: unique trên (exam, student)
   - TeachingAssignment: partial unique
4. **Timestamps**: Tất cả collections có createdAt, updatedAt
5. **Nullable fields**: teacher, class, createdBy có thể null

---

## 🔍 Query Ví Dụ

### Lấy tất cả bài kiểm tra của lớp:
```javascript
Exam.find({ class: classId })
  .populate('questions.questionId')
  .populate('subject')
```

### Lấy kết quả sinh viên:
```javascript
TestExamAttempt.findOne({ exam: examId, student: studentId })
```

### Export dữ liệu Excel:
```javascript
TestExamAttempt.find({ exam: examId })
  .populate('student', 'name username')
  .populate('exam', 'title')
```

---

## 📁 File Locations
- Models: `backend/src/models/`
- Routes: `backend/src/routes/`
- Exam Routes: `backend/src/routes/testExamRoutes.js`
