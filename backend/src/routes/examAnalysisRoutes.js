const express = require('express');
const router = express.Router();
const Exam = require('../models/Exam');
const TestExamAttempt = require('../models/TestExamAttempt');
const claudeAIService = require('../services/claudeAIService');

// ==================== 📊 PHÂN TÍCH CÂU HỎI HAY SAI NHẤT ====================

/**
 * 📊 GET /:examId/question-analysis
 * Phân tích câu hỏi hay sai nhất trong bài kiểm tra
 * Returns: {
 *   mostWrong: [{ questionId, title, wrongCount, correctCount, errorRate }],
 *   mostCorrect: [{ questionId, title, wrongCount, correctCount, correctRate }]
 * }
 */
router.get("/:examId/question-analysis", async (req, res) => {
  try {
    const { examId } = req.params;

    // 1. Lấy thông tin đề thi với câu hỏi
    const exam = await Exam.findById(examId)
      .populate({
        path: 'questions.questionId',
        select: 'title options correctAnswer difficulty'
      });

    if (!exam) {
      return res.status(404).json({ error: "Không tìm thấy đề thi" });
    }

    // 2. Lấy tất cả các lần làm bài
    const attempts = await TestExamAttempt.find({ exam: examId });

    if (attempts.length === 0) {
      return res.json({
        mostWrong: [],
        mostCorrect: [],
        totalAttempts: 0,
        message: "Chưa có sinh viên nào làm bài"
      });
    }

    // 3. Phân tích từng câu hỏi
    const questionStats = {};

    exam.questions.forEach(q => {
      if (!q.questionId) return;

      const qId = q.questionId._id.toString();
      questionStats[qId] = {
        questionId: qId,
        title: q.questionId.title,
        options: q.questionId.options,
        correctAnswer: q.questionId.correctAnswer,
        difficulty: q.questionId.difficulty,
        points: q.points,
        correctCount: 0,
        wrongCount: 0,
        noAnswerCount: 0
      };
    });

    // 4. Đếm số lần đúng/sai cho mỗi câu
    attempts.forEach(attempt => {
      // Convert answers Map to object
      let answersObj = {};
      if (attempt.answers) {
        if (attempt.answers instanceof Map) {
          answersObj = Object.fromEntries(attempt.answers);
        } else if (typeof attempt.answers === 'object') {
          answersObj = attempt.answers;
        }
      }

      exam.questions.forEach(q => {
        if (!q.questionId) return;

        const qId = q.questionId._id.toString();
        const userAnswer = answersObj[qId];
        const correctAnswer = q.questionId.correctAnswer;

        if (questionStats[qId]) {
          if (userAnswer === undefined || userAnswer === null) {
            questionStats[qId].noAnswerCount++;
          } else if (Number(userAnswer) === Number(correctAnswer)) {
            questionStats[qId].correctCount++;
          } else {
            questionStats[qId].wrongCount++;
          }
        }
      });
    });

    // 5. Tính tỷ lệ và sắp xếp
    const questionsArray = Object.values(questionStats).map(q => ({
      ...q,
      errorRate: ((q.wrongCount + q.noAnswerCount) / attempts.length * 100).toFixed(2),
      correctRate: (q.correctCount / attempts.length * 100).toFixed(2),
      totalAttempts: attempts.length
    }));

    // Sắp xếp theo tỷ lệ sai (cao nhất trước)
    const mostWrong = [...questionsArray]
      .sort((a, b) => parseFloat(b.errorRate) - parseFloat(a.errorRate))
      .slice(0, 10); // Top 10 câu sai nhiều nhất

    // Sắp xếp theo tỷ lệ đúng (cao nhất trước)
    const mostCorrect = [...questionsArray]
      .sort((a, b) => parseFloat(b.correctRate) - parseFloat(a.correctRate))
      .slice(0, 10); // Top 10 câu đúng nhiều nhất

    res.json({
      examTitle: exam.title,
      totalAttempts: attempts.length,
      totalQuestions: questionsArray.length,
      mostWrong,
      mostCorrect,
      allQuestions: questionsArray
    });

  } catch (err) {
    console.error("❌ Error analyzing questions:", err);
    res.status(500).json({ error: err.message });
  }
});

// ==================== 🤖 ĐÁNH GIÁ CHẤT LƯỢNG ĐỀ VÀ ĐỀ XUẤT PHƯƠNG PHÁP GIẢNG DẠY ====================

/**
 * 🤖 POST /:examId/teaching-recommendations
 * Sử dụng Claude AI để đánh giá chất lượng đề thi và đề xuất phương pháp giảng dạy
 * Input: examId (từ params)
 * Output: {
 *   examQuality: { score, strengths, weaknesses, distribution },
 *   teachingRecommendations: { focus, methods, nextSteps },
 *   questionInsights: { difficult, easy, needsReview }
 * }
 */
router.post("/:examId/teaching-recommendations", async (req, res) => {
  try {
    const { examId } = req.params;

    console.log('🤖 Generating teaching recommendations for exam:', examId);

    // 1. Lấy phân tích câu hỏi (sử dụng logic từ question-analysis)
    const exam = await Exam.findById(examId)
      .populate({
        path: 'questions.questionId',
        select: 'title options correctAnswer difficulty'
      })
      .populate('subject', 'name');

    if (!exam) {
      return res.status(404).json({ error: "Không tìm thấy đề thi" });
    }

    const attempts = await TestExamAttempt.find({ exam: examId });

    if (attempts.length === 0) {
      return res.json({
        error: "Chưa có sinh viên nào làm bài. Cần có dữ liệu để phân tích.",
        examTitle: exam.title,
        totalAttempts: 0
      });
    }

    // 2. Tính toán thống kê câu hỏi (giống question-analysis)
    const questionStats = {};

    exam.questions.forEach(q => {
      if (!q.questionId) return;

      const qId = q.questionId._id.toString();
      questionStats[qId] = {
        questionId: qId,
        title: q.questionId.title,
        options: q.questionId.options,
        correctAnswer: q.questionId.correctAnswer,
        difficulty: q.questionId.difficulty,
        points: q.points,
        correctCount: 0,
        wrongCount: 0,
        noAnswerCount: 0
      };
    });

    attempts.forEach(attempt => {
      let answersObj = {};
      if (attempt.answers) {
        if (attempt.answers instanceof Map) {
          answersObj = Object.fromEntries(attempt.answers);
        } else if (typeof attempt.answers === 'object') {
          answersObj = attempt.answers;
        }
      }

      exam.questions.forEach(q => {
        if (!q.questionId) return;

        const qId = q.questionId._id.toString();
        const userAnswer = answersObj[qId];
        const correctAnswer = q.questionId.correctAnswer;

        if (questionStats[qId]) {
          if (userAnswer === undefined || userAnswer === null) {
            questionStats[qId].noAnswerCount++;
          } else if (Number(userAnswer) === Number(correctAnswer)) {
            questionStats[qId].correctCount++;
          } else {
            questionStats[qId].wrongCount++;
          }
        }
      });
    });

    const questionsArray = Object.values(questionStats).map(q => ({
      ...q,
      errorRate: parseFloat(((q.wrongCount + q.noAnswerCount) / attempts.length * 100).toFixed(2)),
      correctRate: parseFloat((q.correctCount / attempts.length * 100).toFixed(2)),
      totalAttempts: attempts.length
    }));

    // 3. Tính điểm trung bình của lớp
    const totalScores = attempts.reduce((sum, a) => sum + a.percentage, 0);
    const averageScore = totalScores / attempts.length;
    const passedCount = attempts.filter(a => a.isPassed).length;
    const passRate = (passedCount / attempts.length * 100).toFixed(2);

    // 4. Phân loại câu hỏi
    const difficultQuestions = questionsArray.filter(q => q.errorRate >= 70);
    const easyQuestions = questionsArray.filter(q => q.correctRate >= 90);
    const moderateQuestions = questionsArray.filter(q => q.errorRate < 70 && q.correctRate < 90);

    // 5. Gọi Claude AI để phân tích
    console.log('   🤖 Calling Claude AI for teaching recommendations...');

    const prompt = `Bạn là một chuyên gia giáo dục và phân tích dữ liệu học tập. Hãy phân tích kết quả bài kiểm tra sau và đưa ra đánh giá chất lượng đề thi cũng như đề xuất phương pháp giảng dạy.

**Thông tin đề thi:**
- Tên đề: ${exam.title}
- Môn học: ${exam.subject?.name || 'Chưa xác định'}
- Số sinh viên làm bài: ${attempts.length}
- Điểm trung bình: ${averageScore.toFixed(2)}%
- Tỷ lệ đạt: ${passRate}%
- Tổng số câu hỏi: ${questionsArray.length}

**Phân loại câu hỏi theo độ khó thực tế:**
- Câu hỏi khó (tỷ lệ sai ≥ 70%): ${difficultQuestions.length} câu
- Câu hỏi vừa phải (30% < tỷ lệ sai < 70%): ${moderateQuestions.length} câu
- Câu hỏi dễ (tỷ lệ đúng ≥ 90%): ${easyQuestions.length} câu

**Top 5 câu hỏi sinh viên hay sai nhất:**
${questionsArray.sort((a, b) => b.errorRate - a.errorRate).slice(0, 5).map((q, idx) => `
${idx + 1}. Câu hỏi: "${q.title}"
   - Độ khó ban đầu: ${q.difficulty}
   - Tỷ lệ sai: ${q.errorRate}%
   - Tỷ lệ đúng: ${q.correctRate}%
   - Số sinh viên trả lời đúng: ${q.correctCount}/${q.totalAttempts}
   - Số sinh viên trả lời sai: ${q.wrongCount}/${q.totalAttempts}
   - Không trả lời: ${q.noAnswerCount}/${q.totalAttempts}
`).join('\n')}

**Top 5 câu hỏi sinh viên hay đúng nhất:**
${questionsArray.sort((a, b) => b.correctRate - a.correctRate).slice(0, 5).map((q, idx) => `
${idx + 1}. Câu hỏi: "${q.title}"
   - Độ khó ban đầu: ${q.difficulty}
   - Tỷ lệ đúng: ${q.correctRate}%
   - Tỷ lệ sai: ${q.errorRate}%
   - Số sinh viên trả lời đúng: ${q.correctCount}/${q.totalAttempts}
`).join('\n')}

**Phân bố độ khó ban đầu của đề:**
${Object.entries(
  questionsArray.reduce((acc, q) => {
    acc[q.difficulty] = (acc[q.difficulty] || 0) + 1;
    return acc;
  }, {})
).map(([difficulty, count]) => `- ${difficulty}: ${count} câu (${(count/questionsArray.length*100).toFixed(1)}%)`).join('\n')}

Hãy trả lời dưới dạng JSON với cấu trúc sau (KHÔNG có markdown code block, chỉ trả JSON thuần):
{
  "examQuality": {
    "overallScore": <số từ 0-100>,
    "assessment": "<đánh giá tổng quan về chất lượng đề thi>",
    "strengths": ["<điểm mạnh 1>", "<điểm mạnh 2>", ...],
    "weaknesses": ["<điểm yếu 1>", "<điểm yếu 2>", ...],
    "difficultyBalance": "<nhận xét về cân bằng độ khó của đề>",
    "recommendations": ["<đề xuất cải thiện đề 1>", "<đề xuất 2>", ...]
  },
  "teachingRecommendations": {
    "focusAreas": [
      {
        "topic": "<chủ đề cần tập trung>",
        "reason": "<lý do>",
        "questionExamples": ["<câu hỏi ví dụ 1>", "<câu hỏi ví dụ 2>"]
      }
    ],
    "teachingMethods": [
      {
        "method": "<phương pháp giảng dạy>",
        "description": "<mô tả chi tiết>",
        "targetQuestions": "<loại câu hỏi áp dụng>"
      }
    ],
    "nextSteps": [
      {
        "step": "<bước tiếp theo>",
        "timeline": "<thời gian thực hiện>",
        "expectedOutcome": "<kết quả mong đợi>"
      }
    ]
  },
  "questionInsights": {
    "needsReview": [
      {
        "question": "<câu hỏi>",
        "errorRate": <tỷ lệ sai>,
        "insight": "<phân tích tại sao sinh viên hay sai>",
        "teachingSuggestion": "<đề xuất cách giảng dạy>"
      }
    ],
    "wellUnderstood": [
      {
        "question": "<câu hỏi>",
        "correctRate": <tỷ lệ đúng>,
        "insight": "<phân tích tại sao sinh viên hay đúng>"
      }
    ]
  }
}`;

    const aiResponse = await claudeAIService.analyzeExamQuality(prompt);

    console.log('   ✅ Claude AI analysis completed');

    // 6. Trả về kết quả
    res.json({
      examTitle: exam.title,
      subject: exam.subject?.name,
      statistics: {
        totalAttempts: attempts.length,
        averageScore: parseFloat(averageScore.toFixed(2)),
        passRate: parseFloat(passRate),
        totalQuestions: questionsArray.length,
        difficultQuestions: difficultQuestions.length,
        moderateQuestions: moderateQuestions.length,
        easyQuestions: easyQuestions.length
      },
      aiAnalysis: aiResponse,
      questionData: {
        mostWrong: questionsArray.sort((a, b) => b.errorRate - a.errorRate).slice(0, 5),
        mostCorrect: questionsArray.sort((a, b) => b.correctRate - a.correctRate).slice(0, 5)
      }
    });

  } catch (err) {
    console.error('❌ Error generating teaching recommendations:', err);
    res.status(500).json({
      error: 'Lỗi khi tạo đề xuất giảng dạy',
      message: err.message
    });
  }
});

module.exports = router;
