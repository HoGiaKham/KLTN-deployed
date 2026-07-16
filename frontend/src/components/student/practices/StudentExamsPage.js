// src/pages/student/StudentExamsPage.js
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "../../../styles/StudentExamsPage.css";
import Modal from "../../common/Modal";
import { API_BASE } from "../../../config";

function StudentExamsPage({ studentUsername }) {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0); // Trigger re-render for status updates
  const navigate = useNavigate();
  const [modal, setModal] = useState({
    show: false,
    type: "info",
    title: "",
    message: "",
    onConfirm: null,
    showCancel: false
  });

  // Lấy userId từ current user (app_user) để tách biệt dữ liệu của các user khác nhau
  const currentUser = JSON.parse(localStorage.getItem("app_user") || "{}");
  const userId = currentUser._id;

  // Lấy tất cả đề sinh viên được tham gia trong học kỳ hiện tại
  useEffect(() => {
    const fetchMyExams = async () => {
      if (!studentUsername) {
        setLoading(false);
        return;
      }

      try {
        const res = await axios.get(`${API_BASE}/practice-exams`, {
          params: { userId: studentUsername, role: "student" },
          headers: {
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
          }
        });

        setExams(res.data || []);
      } catch (err) {
        console.error("Lỗi khi tải danh sách đề:", err);
        setExams([]);
      } finally {
        setLoading(false);
      }
    };

    fetchMyExams();
  }, [studentUsername]);

  // Refresh exam status every 30 seconds to catch when exams open/close
  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshKey(prev => prev + 1);
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, []);

  // Trạng thái đề
  const getExamStatus = (exam) => {
    // Database stores Vietnam time directly (after backend converts)
    // Compare with local browser time (which is also Vietnam time)
    const now = new Date();
    const open = exam.openTime ? new Date(exam.openTime) : null;
    const close = exam.closeTime ? new Date(exam.closeTime) : null;

    if (!open) return { text: "Chưa đặt lịch", color: "#94a3b8", type: "unset" };
    if (now < open) return { text: "Chưa mở", color: "#f59e0b", type: "not-open" };
    if (close && now > close) return { text: "Đã đóng", color: "#dc2626", type: "closed" };
    return { text: "Đang mở", color: "#16a34a", type: "open" };
  };

  // Format datetime - display Vietnam time
  const formatDateTime = (str) => {
    if (!str) return "Chưa đặt";
    // Database stores Vietnam time directly, no conversion needed
    const date = new Date(str);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  };

  // Bắt đầu làm bài
  const handleStartExam = (exam) => {
    const status = getExamStatus(exam);
    if (status.type === "open") navigate(`/exam/${exam._id}`);
    else {
      setModal({
        show: true,
        type: "warning",
        title: "Thông báo",
        message: "Đề này chưa mở hoặc đã đóng!",
        onConfirm: () => setModal({ ...modal, show: false }),
        showCancel: false
      });
    }
  };

  // Xem kết quả
  const handleViewReview = (examId) => navigate(`/exam-review/${examId}`);

  // Lấy số lần làm bài từ localStorage
  const getAttemptCount = (examId) => {
    const storageKey = userId ? `exam-${examId}-user${userId}-history` : `exam-${examId}-history`;
    const history = JSON.parse(localStorage.getItem(storageKey)) || [];
    return history.length;
  };

  const hasHistory = (examId) => getAttemptCount(examId) > 0;

  return (
    <div className="student-exams-container">
      <div className="student-exams-header">
        <h2>🎯 Bài luyện tập của tôi</h2>
        <p>Danh sách tất cả đề mà bạn được tham gia trong học kỳ hiện tại.</p>
      </div>

      {loading ? (
        <p className="loading-text">⏳ Đang tải danh sách đề...</p>
      ) : exams.length === 0 ? (
        <div className="empty-state">
          <p>Chưa có đề luyện tập nào được giao.</p>
          <small>Hãy liên hệ giáo viên để được thêm vào lớp học.</small>
        </div>
      ) : (
        <div className="exam-list" key={refreshKey}>
          {exams
            .filter((exam) => {
              // Get current UTC time to match server time
              const now = new Date(new Date().toISOString());
              const close = exam.closeTime ? new Date(exam.closeTime) : null;
              return !close || now <= close;
            })
            .map((exam) => {
              // refreshKey triggers recalculation of exam status every 30 seconds
              const status = getExamStatus(exam);
              const isOpen = status.type === "open";

              return (
                <div key={exam._id} className="exam-item">
                  <div className="exam-left">
                    <div className={`status-tag ${status.type}`}>{status.text}</div>
                    <h3>{exam.title}</h3>
                    <p className="exam-meta">
                      <strong>{exam.subject?.name}</strong> • Lớp:{exam.classes?.slice()
                        .sort((a, b) => a.className.localeCompare(b.className))
                        .map(c => c.className)
                        .join(", ")}
                    </p>
                    <p className="exam-time">
                      Mở: {formatDateTime(exam.openTime)}
                    </p>
                    <p className="exam-attempts">
                      Đã làm <strong>{getAttemptCount(exam._id)}</strong> lần
                    </p>
                  </div>

                  <div className="exam-right">
                    <button
                      className={`start-btn ${isOpen ? "active" : "disabled"}`}
                      disabled={!isOpen}
                      onClick={() => handleStartExam(exam)}
                    >
                      Làm bài
                    </button>
                    {hasHistory(exam._id) && (
                      <button
                        className="review-btn"
                        onClick={() => handleViewReview(exam._id)}
                      >
                        Xem kết quả
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      )}

      <Modal
        show={modal.show}
        onClose={() => setModal({ ...modal, show: false })}
        onConfirm={modal.onConfirm}
        title={modal.title}
        message={modal.message}
        type={modal.type}
        showCancel={modal.showCancel}
      />
    </div>
  );
}

export default StudentExamsPage;
