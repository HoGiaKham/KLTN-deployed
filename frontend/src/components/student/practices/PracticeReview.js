import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import PersonalStats from "./PersonalStats.js";
import "../../../styles/PracticeReview.css";
import { API_BASE, API_HOST } from "../../../config";

const ExamReview = () => {
  const { examId } = useParams();
  const navigate = useNavigate();
  const [examInfo, setExamInfo] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [history, setHistory] = useState([]);
  const [selectedAttempt, setSelectedAttempt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showStats, setShowStats] = useState(false); // false = Tab Chi tiết, true = Tab Thống kê

  useEffect(() => {
    const fetchExamData = async () => {
      try {
        const examRes = await axios.get(`${API_BASE}/practice-exams/${examId}`);
        setExamInfo(examRes.data);

        const questionsRes = await axios.get(`${API_BASE}/practice-exams/${examId}/questions`);
        setQuestions(questionsRes.data || []);
      } catch (err) {
        console.error("Lỗi khi tải dữ liệu:", err);
      } finally {
        setLoading(false);
      }
    };

    // Lấy userId từ current user (app_user)
    const currentUser = JSON.parse(localStorage.getItem("app_user") || "{}");
    const userId = currentUser._id;
    const storageKey = userId ? `exam-${examId}-user${userId}-history` : `exam-${examId}-history`;
    const storedHistory = JSON.parse(localStorage.getItem(storageKey) || "[]");
    
    setHistory(storedHistory);
    if (storedHistory.length > 0) {
      setSelectedAttempt(storedHistory[storedHistory.length - 1]);
    }

    fetchExamData();
  }, [examId]);

  const onClickBack = () => {
    navigate(-1);
  };

  if (loading) return <p className="loading-text">Đang tải kết quả...</p>;
  if (!examInfo) return <p>Không tìm thấy đề thi!</p>;

  // Nếu chưa làm lần nào
  if (history.length === 0) {
    return (
      <div className="review-container">
        <div className="header">
          <div onClick={onClickBack} style={{ cursor: "pointer", color: "#2563eb" }}>
            Quay lại
          </div>
          <h2>{examInfo.title}</h2>
        </div>
        <p className="no-result">Chưa có kết quả làm bài nào.</p>
        <button onClick={() => navigate("/myExams")}>Quay lại danh sách đề</button>
      </div>
    );
  }

  const { score, total, answers, date, duration } = selectedAttempt || {};
  const selectedIndex = history.findIndex((a) => a.date === date);

  return (
    <div className={`review-container ${showStats ? "full-width" : ""}`}>
      {/* 1. HEADER (Luôn hiển thị và cố định ở trên) */}
      <div className="header">
        <div onClick={onClickBack} style={{ cursor: "pointer", color: "#2563eb", fontWeight: "500" }}>
          <i className="fa-solid fa-arrow-left" style={{ marginRight: '5px' }}></i> Quay lại
        </div>
        <h2>{examInfo.title}</h2>
        {/* Một div trống để cân bằng flex layout (giúp H2 nằm giữa) */}
        <div style={{ width: '80px' }}></div>
      </div>

      {/* 2. THANH TABS CHUYÊN NGHIỆP */}
      <div className="custom-tabs-container">
        <button
          className={`custom-tab-btn ${!showStats ? "active" : ""}`}
          onClick={() => setShowStats(false)}
        >
          📝 Chi tiết bài làm
        </button>
        <button
          className={`custom-tab-btn ${showStats ? "active" : ""}`}
          onClick={() => setShowStats(true)}
        >
          📊 Thống kê năng lực
        </button>
      </div>

      {/* 3. NỘI DUNG THAY ĐỔI THEO TAB */}
      <div className="tab-content">
        
        {/* === TAB 1: CHI TIẾT BÀI LÀM === */}
        {!showStats && (
          <div className="review-mode">
            {/* Thanh điều khiển (Điểm & Chọn lần làm) chỉ hiện ở tab Chi tiết */}
            <div className="review-toolbar">
              <div className="score-box">
                <div className="score-row">
                  <p><strong>Số câu làm đúng:</strong> {score}/{total}</p>
                  <p><strong>Ngày làm:</strong> {date}</p>
                  <p><strong>Thời gian:</strong> {duration || "Chưa ghi nhận"}</p>
                </div>
              </div>

              {history.length > 1 && (
                <div className="history-selector">
                  <label>Chọn lần làm:</label>
                  <select
                    value={selectedIndex}
                    onChange={(e) => setSelectedAttempt(history[Number(e.target.value)])}
                  >
                    {history.map((attempt, index) => (
                      <option key={index} value={index}>
                        Lần {index + 1}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Danh sách câu hỏi */}
            <div className="questions-list">
              {questions.map((q, i) => {
                const userAnswer = answers[q._id];
                const isCorrect = userAnswer === q.correctAnswer;
                const isAnswered = userAnswer !== undefined;

                return (
                  <div key={q._id} className="question-box">
                    <h3 className="question-title">
                      Câu {i + 1}: {q.title && q.title.includes('<') ? (
                        <div dangerouslySetInnerHTML={{ __html: q.title }} style={{ display: 'inline' }} />
                      ) : (
                        q.title
                      )}
                    </h3>

                    {q.imageUrl && (
                      <div className="question-image-inline">
                        <img
                          src={`${API_HOST}${q.imageUrl}`}
                          alt="question-image"
                          onError={(e) => {
                            e.target.style.display = 'none';
                          }}
                        />
                      </div>
                    )}

                    <div className="options">
                      {q.options.map((option, optIndex) => {
                        let optionClass = "option";
                        if (optIndex === q.correctAnswer) optionClass += " correct";
                        if (optIndex === userAnswer && !isCorrect) optionClass += " incorrect";
                        if (optIndex === userAnswer && isCorrect) optionClass += " correct";
                        return (
                          <div key={optIndex} className={optionClass}>
                            {String.fromCharCode(65 + optIndex)}. {option}
                          </div>
                        );
                      })}
                    </div>
                    <div
                      className={`status-text ${
                        !isAnswered ? "not-answered" : isCorrect ? "correct" : "incorrect"
                      }`}
                    >
                      {!isAnswered
                        ? `Chưa trả lời - Đáp án đúng: ${String.fromCharCode(65 + q.correctAnswer)}`
                        : isCorrect
                        ? "Đúng"
                        : `Sai — Đáp án đúng: ${String.fromCharCode(65 + q.correctAnswer)}`}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* === TAB 2: THỐNG KÊ === */}
        {showStats && (
          <div className="stats-mode">
            {/* Gọi PersonalStats và bỏ đi hàm onViewDetails vì giờ đã dùng Tabs */}
            <PersonalStats
              examId={examId}
              questions={questions}
              history={history}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default ExamReview;