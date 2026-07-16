import React, { useState, useEffect } from "react";
import axios from "axios";
import Modal from "../common/Modal";
import "./ClassSelector.css";
import { API_BASE } from "../../config";

const ClassSelector = ({ currentUser, onRoomCreated }) => {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(null);
  const [modal, setModal] = useState({
    show: false,
    type: "info",
    title: "",
    message: "",
    onConfirm: null,
    showCancel: false
  });

  useEffect(() => {
    if (currentUser.role === "student") {
      fetchAvailableTeachers();
    }
  }, [currentUser]);

  const fetchAvailableTeachers = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE}/chat/available-teachers/${currentUser._id}`);
      setTeachers(response.data);
    } catch (err) {
      console.error("Error fetching teachers:", err);
      setError("Không thể tải danh sách giảng viên");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTeacher = async (teacherData) => {
    try {
      setCreating(teacherData.teacher._id);

      const response = await axios.post(`${API_BASE}/chat/rooms`, {
        teacherId: teacherData.teacher._id,
        studentId: currentUser._id,
        classId: teacherData.class._id,
      });

      onRoomCreated(response.data);
    } catch (err) {
      console.error("Error creating room:", err);
      setModal({
        show: true,
        type: "error",
        title: "Lỗi",
        message: "Không thể tạo phòng chat. Vui lòng thử lại!",
        onConfirm: () => setModal({ ...modal, show: false }),
        showCancel: false
      });
    } finally {
      setCreating(null);
    }
  };

  if (loading) {
    return (
      <div className="class-selector-container">
        <div className="loading-spinner">Đang tải...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="class-selector-container">
        <div className="error-message">{error}</div>
      </div>
    );
  }

  if (teachers.length === 0) {
    return (
      <div className="class-selector-container">
        <div className="empty-message">
          <p>📚 Bạn chưa có lớp học nào</p>
          <p className="sub-text">Liên hệ giảng viên để được thêm vào lớp</p>
        </div>
      </div>
    );
  }

  return (
    <div className="class-selector-container">
      <div className="class-selector-info">
        <p>Chọn lớp học để chat với giảng viên</p>
      </div>

      <div className="class-list">
        {teachers.map((item) => (
          <div
            key={`${item.teacher._id}-${item.class._id}`}
            className="class-item"
            onClick={() => handleSelectTeacher(item)}
          >
            <div className="class-item-avatar">
              {item.teacher.avatar ? (
                <img src={item.teacher.avatar} alt={item.teacher.name} />
              ) : (
                <div className="avatar-placeholder">
                  {item.teacher.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            <div className="class-item-info">
              <h4>{item.teacher.name}</h4>
              <p className="subject-name">{item.subject.name}</p>
              <p className="class-name">{item.class.name}</p>
            </div>

            {creating === item.teacher._id ? (
              <div className="creating-spinner">...</div>
            ) : (
              <div className="arrow-icon">→</div>
            )}
          </div>
        ))}
      </div>

      <Modal
        show={modal.show}
        onClose={() => setModal({ ...modal, show: false })}
        onConfirm={modal.onConfirm || (() => setModal({ ...modal, show: false }))}
        title={modal.title}
        message={modal.message}
        type={modal.type}
        showCancel={modal.showCancel}
      />
    </div>
  );
};

export default ClassSelector;
