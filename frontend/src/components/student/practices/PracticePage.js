import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import "../../../styles/PracticePage.css";
import { useLocation } from "react-router-dom";
import { API_BASE, API_HOST } from "../../../config";

function ExamPage() {
  const { examId } = useParams();
  const location = useLocation();
  const initialAnswers = location.state?.answers || {};
  const navigate = useNavigate();
  const [examInfo, setExamInfo] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState(initialAnswers);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [flaggedQuestions, setFlaggedQuestions] = useState([]);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Lấy userId từ current user (app_user) để tách biệt dữ liệu của các user khác nhau
  const currentUser = JSON.parse(localStorage.getItem("app_user") || "{}");
  const userId = currentUser._id;

  const QUESTIONS_PER_PAGE = 3;
const [seconds, setSeconds] = useState(() => {
  const secondsKey = userId ? `exam-${examId}-user${userId}-seconds` : `exam-${examId}-seconds`;
  return Number(localStorage.getItem(secondsKey)) || 0;
});

  const [isTimerRunning, setIsTimerRunning] = useState(true);

 useEffect(() => {
  const timer = setInterval(() => {
    setSeconds((prev) => {
      const newVal = prev + 1;
      const secondsKey = userId ? `exam-${examId}-user${userId}-seconds` : `exam-${examId}-seconds`;
      localStorage.setItem(secondsKey, newVal);
      return newVal;
    });
  }, 1000);

  return () => clearInterval(timer);
}, [examId, userId]);


  // Fetch exam details
  useEffect(() => {
    const fetchExamDetails = async () => {
      try {
        const examRes = await axios.get(`${API_BASE}/practice-exams/${examId}`);
        setExamInfo(examRes.data);

        const questionsRes = await axios.get(`${API_BASE}/practice-exams/${examId}/questions`);
        setQuestions(questionsRes.data || []);
      } catch (err) {
        console.error("Lỗi khi tải đề thi:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchExamDetails();
  }, [examId]);

  // Handlers
  const toggleFlag = (questionId) => {
    setFlaggedQuestions((prev) =>
      prev.includes(questionId)
        ? prev.filter((id) => id !== questionId)
        : [...prev, questionId]
    );
  };

  const handleAnswerChange = (questionId, answerIndex) => {
    const newAnswers = { ...answers, [questionId]: answerIndex };
    setAnswers(newAnswers);
    const answerKey = userId ? `exam-${examId}-user${userId}-answers` : `exam-${examId}-answers`;
    localStorage.setItem(answerKey, JSON.stringify(newAnswers));
  };

  useEffect(() => {
    const answerKey = userId ? `exam-${examId}-user${userId}-answers` : `exam-${examId}-answers`;
    const savedAnswers = JSON.parse(localStorage.getItem(answerKey));
    if (savedAnswers) setAnswers(savedAnswers);
  }, [examId, userId]);

  const handleQuestionClick = (index) => {
    const targetPage = Math.floor(index / QUESTIONS_PER_PAGE);
    setCurrentPage(targetPage);
    document.getElementById(`question-${index}`)?.scrollIntoView({ behavior: "smooth" });
  };

  const handlePrevPage = () => {
    if (currentPage > 0) setCurrentPage(currentPage - 1);
  };

  const handleNextPage = () => {
    if ((currentPage + 1) * QUESTIONS_PER_PAGE < questions.length) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handleGoBack = () => setShowSummaryModal(false);

  const handleConfirmSubmit = () => {
    setShowSummaryModal(false);
    setShowConfirmModal(true);
  };

const handleSubmitExam = () => {
  setIsTimerRunning(false); // dừng đồng hồ nếu muốn

  const score = questions.reduce((acc, q) => {
    if (answers[q._id] === q.correctAnswer) acc += 1;
    return acc;
  }, 0);

  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const duration = `${minutes} phút ${secs < 10 ? "0" : ""}${secs} giây`;

  const attempt = {
    examId,
    score,
    total: questions.length,
    answers,
    date: new Date().toLocaleString(),
    duration,
    seconds,
  };

  const storageKey = userId ? `exam-${examId}-user${userId}-history` : `exam-${examId}-history`;
  const history = JSON.parse(localStorage.getItem(storageKey) || "[]");
  history.push(attempt);
  localStorage.setItem(storageKey, JSON.stringify(history));

  // --- Reset ---
  const answerKey = userId ? `exam-${examId}-user${userId}-answers` : `exam-${examId}-answers`;
  const secondsKey = userId ? `exam-${examId}-user${userId}-seconds` : `exam-${examId}-seconds`;
  localStorage.removeItem(answerKey);
  localStorage.removeItem(secondsKey); // xóa timer
  setSeconds(0); // reset state timer

  navigate(`/exam-review/${examId}`);
};


  const currentQuestions = questions.slice(
    currentPage * QUESTIONS_PER_PAGE,
    (currentPage + 1) * QUESTIONS_PER_PAGE
  );

  if (loading) return <p>Đang tải đề thi...</p>;
  if (!examInfo) return <p>Không tìm thấy đề thi!</p>;

  return (
    <div className="exam-container">
      <div className="sidebar">
        <h3>Danh sách câu hỏi</h3>
        <div className="question-list">
          {questions.map((q, i) => {
            const isAnswered = answers[q._id] !== undefined;
            const isFlagged = flaggedQuestions.includes(q._id);
            const startIndex = currentPage * QUESTIONS_PER_PAGE;
            const endIndex = startIndex + QUESTIONS_PER_PAGE;
            const isCurrentPage = i >= startIndex && i < endIndex;

            return (
              <div
                key={q._id}
                className={`question-number 
                  ${isAnswered ? "answered" : ""} 
                  ${isFlagged ? "flagged" : ""} 
                  ${isCurrentPage ? "current-page" : ""}`}
                onClick={() => handleQuestionClick(i)}
              >
                {i + 1}
              </div>
            );
          })}
        </div>
      </div>

      <div className="main-content">
        <div className="header">
          <div onClick={() => navigate(-1)} style={{ cursor: "pointer", color: "blue" }}>
            ← Quay lại
          </div>
          <h2>{examInfo.title}</h2>
          <div className="timer-box">
  ⏳ {Math.floor(seconds / 60)}:
  {(seconds % 60).toString().padStart(2, "0")}
</div>

        </div>

        {currentQuestions.map((question, index) => (
          <div
            key={question._id}
            className="question-item"
            id={`question-${currentPage * QUESTIONS_PER_PAGE + index}`}
          >
            <div className="question-item-header">
              <h3>
                {currentPage * QUESTIONS_PER_PAGE + index + 1}. {question.title && question.title.includes('<') ? (
                  <div dangerouslySetInnerHTML={{ __html: question.title }} />
                ) : (
                  question.title
                )}
              </h3>
              <button
                className={`flag-btn ${flaggedQuestions.includes(question._id) ? "flagged" : ""}`}
                onClick={() => toggleFlag(question._id)}
              >
                🚩
              </button>
            </div>

            {question.imageUrl && (
              <div className="question-image-inline">
                <img
                  src={`${API_HOST}${question.imageUrl}`}
                  alt="question-image"
                  onError={(e) => {
                    console.warn(`❌ Failed to load image: ${question.imageUrl}`);
                    e.target.style.display = 'none';
                  }}
                />
              </div>
            )}

            {question.options.map((option, optIndex) => (
              <div key={optIndex} className="option">
                <input
                  type="radio"
                  name={`question-${question._id}`}
                  checked={answers[question._id] === optIndex}
                  onChange={() => handleAnswerChange(question._id, optIndex)}
                />
                <label>{String.fromCharCode(65 + optIndex)}. {option}</label>
              </div>
            ))}
          </div>
        ))}

        <div className="bottom-buttons">
          <button onClick={handlePrevPage} disabled={currentPage === 0} style={{ marginTop: "20px" }}>
            ← Trang trước
          </button>
          <button
            onClick={handleNextPage}
            disabled={(currentPage + 1) * QUESTIONS_PER_PAGE >= questions.length}
            style={{ marginTop: "20px" }}
          >
            Trang kế →
          </button>
<button
  className="submit-btn"
  onClick={() =>
    navigate("/exam-summary", {
      state: { questions, answers, examId, seconds }
    })
  }
>
  Nộp bài
</button>

        </div>
      </div>

      {showSummaryModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Danh sách câu trả lời đã lưu:</h3>
            {questions.map((q, i) => (
              <p key={q._id}>
                Câu {i + 1} — {answers[q._id] !== undefined ? "đã trả lời" : "chưa trả lời"}
              </p>
            ))}
            <div className="modal-buttons">
              <button onClick={handleGoBack}>Quay lại trang trước</button>
              <button onClick={handleConfirmSubmit}>Nộp bài</button>
            </div>
          </div>
        </div>
      )}

      {showConfirmModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Bạn xác nhận nộp bài?</h3>
            <div className="modal-buttons">
              <button onClick={() => setShowConfirmModal(false)}>Hủy</button>
              <button onClick={handleSubmitExam}>Xác nhận</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ExamPage;
