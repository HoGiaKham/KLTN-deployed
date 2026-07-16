  import React, { useState } from "react";
  import { useNavigate, useLocation } from "react-router-dom";
  import "../../../styles/PractiecSummary.css";

  const ExamSummary = () => {
    const navigate = useNavigate();
    const location = useLocation();
  const { questions = [], answers = {}, examId, seconds = 0 } = location.state || {};
    const [showConfirmModal, setShowConfirmModal] = useState(false);


    const handleJumpToQuestion = (index) => {
      navigate(`/exam/${examId}`, {
        state: {
          answers,
          jumpTo: index,
        },
      });
    };

    const handleGoBack = () => {
      navigate(`/exam/${examId}`, { state: { answers } });
    };

    const handleSubmit = () => {
      setShowConfirmModal(true);
    };

const handleConfirmSubmit = () => {
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
    seconds,
    duration,
  };

  // Lấy userId từ current user (app_user) để tách biệt dữ liệu của các user khác nhau
  const currentUser = JSON.parse(localStorage.getItem("app_user") || "{}");
  const userId = currentUser._id;
  const storageKey = userId ? `exam-${examId}-user${userId}-history` : `exam-${examId}-history`;
  const history = JSON.parse(localStorage.getItem(storageKey)) || [];
  history.push(attempt);
  localStorage.setItem(storageKey, JSON.stringify(history));

  // --- Reset bài làm & timer ---
  const answerKey = userId ? `exam-${examId}-user${userId}-answers` : `exam-${examId}-answers`;
  const secondsKey = userId ? `exam-${examId}-user${userId}-seconds` : `exam-${examId}-seconds`;
  const endTimeKey = userId ? `exam-${examId}-user${userId}-endTime` : `exam-${examId}-endTime`;

  localStorage.removeItem(answerKey);
  localStorage.removeItem(secondsKey);
  localStorage.removeItem(endTimeKey);

  setShowConfirmModal(false);
  navigate(`/exam-review/${examId}`);
};



    return (
      <div className="summary-container">
        {/* ======================= SIDEBAR ======================= */}
        <div className="sidebar">
          <h3>Danh sách câu hỏi</h3>
          <div className="question-list">
            {questions.map((q, i) => {
              const isAnswered = answers[q._id] !== undefined;

              return (
                <div
                  key={q._id}
                  className={`question-number ${isAnswered ? "answered" : "not-answered"}`}
                  onClick={() => handleJumpToQuestion(i)}
                >
                  {i + 1}
                </div>
              );
            })}
          </div>
        </div>

        {/* ======================= MAIN SUMMARY ======================= */}
        <div className="summary-main">
          <h2>Danh sách câu trả lời đã lưu</h2>

          <div className="summary-box">
            <div className="summary-header-row">
              <div className="col-left">Câu</div>
              <div className="col-right">Trạng thái</div>
            </div>

            <div className="summary-rows">
              {questions.map((q, i) => {
                const answered = answers[q._id] !== undefined;
                return (
                  <div key={q._id} className="summary-row">
                    <div className="col-left">Câu {i + 1}</div>
                    <div className="col-right">
                      <span className={`status ${answered ? "answered" : "not-answered"}`}>
                        {answered ? "Đã trả lời" : "Chưa trả lời"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="summary-buttons">
              <button className="btn-back" onClick={handleGoBack}>
                Quay lại trang trước
              </button>
              <button className="btn-submit" onClick={handleSubmit}>
                Nộp bài
              </button>
            </div>
          </div>

          {showConfirmModal && (
            <div className="modal-overlay">
              <div className="modal-content">
                <h3>Bạn xác nhận nộp bài?</h3>
                <h4>Nộp bài sẽ khóa bài làm, bạn không thể chỉnh sửa sau khi xác nhận.</h4>
                <div className="modal-buttons">
                  <button className="modal-cancel" onClick={() => setShowConfirmModal(false)}>
                    Hủy
                  </button>
                  <button className="modal-confirm" onClick={handleConfirmSubmit}>
                    Xác nhận
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  export default ExamSummary;
