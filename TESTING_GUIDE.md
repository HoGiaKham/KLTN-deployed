# Excel Export Testing Guide

## What We Fixed

### 1. Frontend (TakeTestExamPage.js)
- **Added timeSpent calculation** - Now calculates time spent in seconds and sends it with the submit request
- Formula: `timeSpentSeconds = ((exam.duration || 60) * 60) - timeLeft`

### 2. Backend (testExamRoutes.js)
- **Enhanced submit endpoint** - Added comprehensive logging to track:
  - Incoming answers object
  - Answer keys
  - Question matching
  - Score calculation

- **Improved my-result-detailed endpoint** - Multiple enhancements:
  - Better handling of MongoDB Map conversion
  - Comprehensive logging to track answer retrieval
  - Proper number conversion for answer comparison
  - Fallback methods for accessing answers

## Testing Steps

### Step 1: Navigate to Teacher Report Page
1. Login as a teacher
2. Go to Report Page
3. Select a class
4. Select an exam that has student submissions
5. Click "Export Excel" button

### Step 2: Monitor Backend Logs
While the export is running, watch the backend server console for the following logs:

**On exam submit (when student first submits):**
```
📤 Student submitting exam:
   examId: [exam_id]
   studentId: [student_id]
   answers: {key1: value1, key2: value2, ...}
   timeSpent: [seconds]
   req.body keys: answers,timeSpent,studentId

📋 Answers received from frontend: {key1: value1, ...}
📋 Answers keys: [list of keys]

Q1: qId=..., userAns=..., correctAns=..., isCorrect=...
Q2: qId=..., userAns=..., correctAns=..., isCorrect=...
...
```

**On export (my-result-detailed endpoint):**
```
🔍 ===== DETAILED DEBUGGING =====
🔍 attempt.answers type: [type]
🔍 attempt.answers (raw): {key1: value1, ...}
🔍 answersObj (converted): {key1: value1, ...}
🔍 answersObj keys: [list of keys]

   Q1 (Question title):
      Looking for key: "[questionId]"
      Available keys: [list]
      userAnswer from key (raw): [value], type: [type]
      correctAnswer (raw): [value], type: [type]
      After conversion: userAns=[number], correctAns=[number]
      isCorrect=[true/false], earnedPoints=[points]
```

### Step 3: Verify Excel File
After export completes, check the generated Excel file for:

1. **Column Headers**
   - Should see: "Họ tên", "Tài khoản", "Ngày làm bài", "Thời gian làm (phút)", "Câu 1 (Xđ)", "Câu 2 (Xđ)", etc.
   - NOT see corrupted headers mixing time and questions

2. **Time Spent Column**
   - Should show numbers (not "-" or 0)
   - Should show realistic durations in minutes

3. **Question Score Columns**
   - Should show actual earned points (0 to X, where X = question points)
   - Should NOT be all zeros if student answered correctly
   - Should match the actual correct answers

## Expected Results

### Correct Behavior:
```
| Họ tên  | Tài khoản | Ngày làm bài | Thời gian làm (phút) | Câu 1 (2đ) | Câu 2 (2đ) | Câu 3 (1đ) |
| Student | sv001     | 10/11/2025   | 25                   | 2          | 0          | 1          |
```

### Common Issues to Watch For:

1. **All zeros in question columns**
   - Check logs: Are answers being found?
   - Check logs: Are keys matching?
   - Check logs: Are answers and correct answers being compared correctly?

2. **Corrupted headers**
   - Check if columns are being inserted in correct order
   - Check Excel library column handling

3. **"-" in timeSpent column**
   - Check if timeSpent is being sent from frontend
   - Check if it's being stored in database

## Key Data to Verify from Logs

1. **Answer Keys Match**
   ```
   Available keys: 507f1f77bcf86cd799439011, 507f1f77bcf86cd799439012, ...
   Looking for key: 507f1f77bcf86cd799439011
   ```
   Keys should match!

2. **Values Are Numeric**
   ```
   userAnswer from key (raw): 2, type: number
   correctAnswer (raw): 1, type: number
   ```
   Should be numbers, not strings or undefined

3. **Comparison Works**
   ```
   After conversion: userAns=2, correctAns=1
   isCorrect=false, earnedPoints=0
   ```
   Math should be correct

## Debug Commands

If you need to check a specific student's attempt in the database:

```javascript
// In MongoDB shell
db.testexamattemptsattempts.findOne({
  student: ObjectId("student_id"),
  exam: ObjectId("exam_id")
});

// Look for:
// - answers field (should be a Map with numeric values)
// - timeSpent field (should be numeric, in seconds)
// - score field (should be numeric)
```

## Next Steps If Issues Remain

1. **Save backend console output** to a file
2. **Include the relevant log section** when reporting issues
3. **Include the Excel file** so we can see the actual output
4. **Specify which student** was tested
5. **Mention exam details** (number of questions, points per question)
