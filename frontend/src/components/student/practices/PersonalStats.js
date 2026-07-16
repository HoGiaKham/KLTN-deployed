// src/components/PersonalStats.js
import React, { useMemo, useState } from "react";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import "../../../styles/PersonalStats.css";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const PersonalStats = ({ examId, questions, history, onViewDetails }) => {
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const stats = useMemo(() => {
    if (!history || history.length === 0 || questions.length === 0) return null;

    const questionStats = {};

    questions.forEach((q, index) => {
      const qId = q._id;
      questionStats[qId] = {
        title: `Câu ${index + 1}`,
        correct: 0,
        wrong: 0,
        total: 0,
        question: q,
      };
    });

    history.forEach((attempt) => {
      Object.entries(attempt.answers).forEach(([qId, userAnswer]) => {
        const question = questions.find((q) => q._id === qId);
        if (question && questionStats[qId]) {
          questionStats[qId].total++;
          if (userAnswer === question.correctAnswer) {
            questionStats[qId].correct++;
          } else {
            questionStats[qId].wrong++;
          }
        }
      });
    });

    const entries = Object.entries(questionStats);
    const mostWrong = entries.reduce((a, b) => (b[1].wrong > a[1].wrong ? b : a), entries[0]);
    const mostCorrect = entries.reduce((a, b) => (b[1].correct > a[1].correct ? b : a), entries[0]);

    return {
      questionStats,
      mostWrong: mostWrong[1],
      mostWrongTitle: mostWrong[1].title,
      mostCorrect: mostCorrect[1],
      mostCorrectTitle: mostCorrect[1].title,
      totalAttempts: history.length,
    };
  }, [examId, questions, history]);

  const handleBarClick = (event, elements) => {
    if (elements.length > 0) {
      const index = elements[0].index;
      const qId = Object.keys(stats.questionStats)[index];
      const qData = stats.questionStats[qId];

      setSelectedQuestion({
        ...qData.question,
        stats: qData,
      });
      setShowModal(true);
    }
  };

  if (!stats) {
    return (
      <div className="personal-stats">
        <p className="no-data">Chưa có dữ liệu để thống kê. Hãy làm bài ít nhất 1 lần!</p>
      </div>
    );
  }

  const chartData = {
    labels: Object.values(stats.questionStats).map((s) => s.title),
    datasets: [
      {
        label: "Số lần đúng",
        data: Object.values(stats.questionStats).map((s) => s.correct),
        backgroundColor: "rgba(34, 197, 94, 0.7)",
        borderColor: "rgba(34, 197, 94, 1)",
        borderWidth: 1,
      },
      {
        label: "Số lần sai",
        data: Object.values(stats.questionStats).map((s) => s.wrong),
        backgroundColor: "rgba(239, 68, 68, 0.7)",
        borderColor: "rgba(239, 68, 68, 1)",
        borderWidth: 1,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "top" },
      title: {
        display: true,
        text: "Bấm vào cột để xem chi tiết câu hỏi",
        font: { size: 16 },
      },
      tooltip: {
        callbacks: {
          afterLabel: (context) => {
            const qId = Object.keys(stats.questionStats)[context.dataIndex];
            const q = stats.questionStats[qId].question;
            // Xóa HTML tags để chỉ hiển thị text
            const plainText = q.title ? q.title.replace(/<[^>]*>/g, '') : '';
            return `Câu: ${plainText}`;
          },
        },
      },
    },
    scales: {
      x: { stacked: true },
      y: { stacked: true, beginAtZero: true },
    },
    onClick: handleBarClick,
  };

  return (
    <div className="personal-stats">
      <div className="stats-summary">
        <div className="stats-header">
          <h3>Thống kê cá nhân của bạn</h3>

        </div>
        <div className="stats-info">
          <p>
            <strong>Tổng số lần làm:</strong> {stats.totalAttempts}
          </p>
          <p className="highlight-wrong">
            Câu bạn <strong>sai nhiều nhất</strong>: {stats.mostWrongTitle} (
            {stats.mostWrong.wrong} lần sai)
          </p>
        </div>
                  {onViewDetails && (
            <button className="toggle-stats-btn back-btn" onClick={onViewDetails}>
              Xem chi tiết bài làm
            </button>
          )}
      </div>

<div className="stats-chart" style={{ height: "400px", overflowX: "auto" }}>
    <Bar data={chartData} options={options} />
</div>


      {/* MODAL CHI TIẾT CÂU HỎI */}
      {showModal && selectedQuestion && (
        <div className="stats-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="stats-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{selectedQuestion.stats.title}</h3>
              <button className="close-btn" onClick={() => setShowModal(false)}>
                ×
              </button>
            </div>

            <div className="modal-body">
              <p>
                <strong>Câu hỏi:</strong>
                {selectedQuestion.title && selectedQuestion.title.includes('<') ? (
                  <div dangerouslySetInnerHTML={{ __html: selectedQuestion.title }} style={{ display: 'inline' }} />
                ) : (
                  selectedQuestion.title
                )}
              </p>

              <div className="modal-options">
                {selectedQuestion.options.map((opt, idx) => {
                  const isCorrect = idx === selectedQuestion.correctAnswer;
                  const isSelected = history.some(
                    (attempt) => attempt.answers[selectedQuestion._id] === idx
                  );
                  return (
                    <div
                      key={idx}
                      className={`modal-option ${isCorrect ? "correct" : ""} ${
                        isSelected && !isCorrect ? "incorrect" : ""
                      }`}
                    >
                      {String.fromCharCode(65 + idx)}. {opt}
                      {isCorrect && " (Đáp án đúng)"}
                      {isSelected && !isCorrect && " (Bạn đã chọn)"}
                    </div>
                  );
                })}
              </div>

              <div className="modal-stats">
                <p>
                  Đúng:{" "}
                  <strong style={{ color: "#16a34a" }}>
                    {selectedQuestion.stats.correct}
                  </strong>{" "}
                  lần
                </p>
                <p>
                  Sai:{" "}
                  <strong style={{ color: "#dc2626" }}>
                    {selectedQuestion.stats.wrong}
                  </strong>{" "}
                  lần
                </p>
                <p>
                  Tổng số lần trả lời: <strong>{selectedQuestion.stats.total}</strong> lần
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PersonalStats;
