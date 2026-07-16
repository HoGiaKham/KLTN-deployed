// components/StudentDetailModal.js
import React, { useState, useEffect } from "react";
import axios from "axios";
import { API_BASE } from "../../config";
import Modal from "../common/Modal";
import "../../styles/StudentDetailModal.css";

function StudentDetailModal({ student, onClose }) {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);

  // Modal confirm + success
  const [showConfirm, setShowConfirm] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const [modal, setModal] = useState({
    show: false,
    type: "info",
    title: "",
    message: "",
    onConfirm: null,
    showCancel: false
  });

  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const [classesRes, activeSemesterRes] = await Promise.all([
          axios.get(`${API_BASE}/classes`),
          axios.get(`${API_BASE}/semesters/active`),
        ]);

        const activeSemester = activeSemesterRes.data;
        if (!activeSemester) {
          setClasses([]);
          setLoading(false);
          return;
        }

        const myClasses = classesRes.data.filter(
          (cls) =>
            cls.students?.some((s) => s._id === student._id) &&
            cls.semester?._id?.toString() === activeSemester._id.toString()
        );

        setClasses(myClasses);
      } catch (err) {
        console.error("Lỗi tải lớp học của sinh viên:", err);
        setClasses([]);
      } finally {
        setLoading(false);
      }
    };

    if (student) fetchClasses();
  }, [student]);

  const handleResetPassword = async () => {
    setResetting(true);
    try {
      await axios.post(`${API_BASE}/users/${student._id}/reset-password`);
      setShowConfirm(false);
      setShowSuccess(true); // show modal success
    } catch (err) {
      console.error(err);
      setModal({
        show: true,
        type: "error",
        title: "Lỗi",
        message: "Lỗi khi reset mật khẩu. Vui lòng thử lại!",
        onConfirm: () => setModal({ ...modal, show: false }),
        showCancel: false
      });
    } finally {
      setResetting(false);
    }
  };

  if (!student) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Chi tiết sinh viên</h2>
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="student-avatar">
            <div className="avatar-placeholder">
              {student.name?.charAt(0).toUpperCase() || "S"}
            </div>
          </div>

          <div className="info-grid">
            <div className="info-item">
              <label>MSSV:</label>
              <strong className="highlight">{student.username}</strong>
            </div>

            <div className="info-item">
              <label>Họ và tên:</label>
              <strong>{student.name || "Chưa cập nhật"}</strong>
            </div>

            <div className="info-item">
              <label>Tài khoản đăng nhập:</label>
              <strong>{student.username}</strong>
            </div>

            <div className="info-item">
              <label>Mật khẩu:</label>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span
                  style={{
                    fontFamily: "monospace",
                    letterSpacing: "2px",
                    color: "#666",
                    marginTop: -4,
                  }}
                >
                  ••••••••
                </span>
<button
  onClick={() => setShowConfirm(true)}
  disabled={resetting}
  style={{
    background: resetting ? "#ccc" : "#f06977ff",
    color: "white",
    border: "none",
    borderRadius: "8px",
    height: 30,
    cursor: resetting ? "not-allowed" : "pointer",
  }}
>
  {resetting ? "Đang reset..." : "Reset mật khẩu"}
</button>
{showSuccess && (
  <span style={{ color: "green", fontSize: "14px" }}>
    Đã đổi mật khẩu thành công!
  </span>
)}

              </div>
            </div>
          </div>

          <div className="classes-section" style={{ marginTop: "20px" }}>
            <h3>Lớp học hiện tại</h3>
            {loading ? (
              <p>Đang tải...</p>
            ) : classes.length === 0 ? (
              <p className="no-data">Chưa có lớp nào trong học kỳ hiện tại.</p>
            ) : (
              <div className="classes-grid">
                {classes.map((cls) => (
                  <div key={cls._id} className="class-card">
                    <h3>Lớp: {cls.className}</h3>
                    <div className="class-info">
                      <p>
                        <strong>Môn học:</strong> {cls.subject?.name || "N/A"}
                      </p>
                      <p>
                        <strong>Giảng viên:</strong> {cls.teacher?.name || "Chưa có"}
                      </p>
                      <p>
                        <strong>Học kì:</strong> {cls.semester?.name || "N/A"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn-close">
            Đóng
          </button>
        </div>
      </div>

      {/* ================= CONFIRM MODAL ================= */}
      {showConfirm && (
        <div className="confirm-overlay">
          <div className="confirm-box">
            <h3>Xác nhận reset mật khẩu</h3>
            <p>
              Bạn có chắc muốn đặt lại mật khẩu cho{" "}
              <strong>{student.name}</strong> ({student.username})?
            </p>
            <p>
              Mật khẩu mới sẽ là: <strong>123456</strong>
            </p>

            <div className="confirm-actions">
              <button className="btn-cancel" onClick={() => setShowConfirm(false)}>
                Hủy
              </button>
              <button className="btn-accept" onClick={handleResetPassword}>
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= SUCCESS MODAL ================= */}
      {showSuccess && (
        <div className="confirm-overlay">
          <div className="confirm-box">
            <h3>Reset thành công!</h3>
            <p>
              Mật khẩu mới của sinh viên là: <strong>123456</strong>
            </p>

            <div className="confirm-actions">
              <button className="btn-accept" onClick={() => setShowSuccess(false)}>
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}

      <Modal
        show={modal.show}
        onClose={() => setModal({ ...modal, show: false })}
        onConfirm={modal.onConfirm}
        title={modal.title}
        message={modal.message}
        type={modal.type}
        confirmText={modal.confirmText}
        cancelText={modal.cancelText}
        showCancel={modal.showCancel}
      />
    </div>
  );
}

export default StudentDetailModal;
