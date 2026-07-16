import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "../../styles/StudentPage.css";
import { API_BASE } from "../../config";

function StudentPage({ studentUsername }) {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState(null);
  
  const navigate = useNavigate();

  useEffect(() => {
    const fetchMyClasses = async () => {
      if (!studentUsername) {
        setLoading(false);
        return;
      }

      try {
        const [classesRes, semestersRes] = await Promise.all([
          axios.get(`${API_BASE}/classes`),
          axios.get(`${API_BASE}/semesters`),
        ]);

        const allClasses = classesRes.data;
        const activeSemester = semestersRes.data.find((s) => s.isActive);

        const myClasses = allClasses.filter(
          (cls) =>
            cls.students?.some((s) => s.username === studentUsername) &&
            (cls.semester?._id === activeSemester?._id ||
              cls.semester === activeSemester?._id)
        );

        setClasses(myClasses);
      } catch (err) {
        console.error("Lỗi khi tải lớp học:", err);
        setClasses([]);
      } finally {
        setLoading(false);
      }
    };

    fetchMyClasses();
  }, [studentUsername]);

  const handleStartExam = (examId) => {
    navigate(`/exam/${examId}`);
  };

  const isExamOpen = (exam) => {
    const now = Date.now();
    const open = exam.openTime ? new Date(exam.openTime).getTime() : 0;
    const close = exam.closeTime ? new Date(exam.closeTime).getTime() : Infinity;
    return now >= open && now <= close;
  };

  if (loading) {
    return <div className="loading">Đang tải lớp học...</div>;
  }

  if (selectedClass) {
    return (
      <ClassDetail
        classInfo={selectedClass}
        onBack={() => setSelectedClass(null)}
        onStartExam={handleStartExam}
        isExamOpen={isExamOpen}
      />
    );
  }

  return (
    <div className="student-page">
      <div className="page-header">
        <h2>Lớp học của tôi</h2>
        <p>
          Xin chào, <strong>{studentUsername}</strong>! Bạn đang tham gia{" "}
          <strong>{classes.length}</strong> lớp trong học kỳ hiện tại.
        </p>
      </div>

      {classes.length > 0 && (
        <div className="semester-info">
          <strong>Học kỳ hiện tại:</strong>{" "}
          {classes[0].semester?.name || "Không xác định"}
        </div>
      )}

      {classes.length === 0 ? (
        <div className="empty-state">
          <p>Bạn chưa được phân vào lớp nào trong học kỳ hiện tại.</p>
          <small>Liên hệ quản trị viên để được thêm vào lớp.</small>
        </div>
      ) : (
        <div className="classes-grid">
          {classes.map((cls) => (
            <div
              key={cls._id}
              className="class-card"
              onClick={() => setSelectedClass(cls)}
            >
              <h3>{cls.className}</h3>
              <div className="class-info">
                <p>
                  <strong>Giảng viên:</strong>{" "}
                  {cls.teacher?.name || cls.teacher?.username || "Chưa có"}
                </p>
                <p>
                  <strong>Môn học:</strong> {cls.subject?.name || "N/A"}
                </p>
                <p>
                  <strong>Số lượng sinh viên:</strong>{" "}
                  {cls.students?.length || 0}/{cls.maxStudents || "∞"}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ===============================
// Component chi tiết lớp học
// ===============================
function ClassDetail({ classInfo, onBack, onStartExam, isExamOpen }) {
  const [exams, setExams] = useState([]);
  const [loadingExams, setLoadingExams] = useState(true);

  useEffect(() => {
    const fetchExams = async () => {
      setLoadingExams(true);
      try {
        const subjectId = classInfo.subject?._id;

        if (!subjectId) {
          console.warn("Lớp chưa có môn học → không tải đề");
          setExams([]);
          setLoadingExams(false);
          return;
        }

        const res = await axios.get(`${API_BASE}/practice-exams/by-class-subject`, {
          params: { classId: classInfo._id, subjectId },
        });
        setExams(res.data || []);
      } catch (err) {
        console.error("Lỗi load đề:", err);
        setExams([]);
      } finally {
        setLoadingExams(false);
      }
    };

    fetchExams();
  }, [classInfo._id, classInfo.subject?._id]);

  const formatDate = (date) => {
    return date ? new Date(date).toLocaleString("vi-VN") : "Chưa đặt";
  };

  return (
    <div className="class-detail">
      <button onClick={onBack} className="back-btn">
        Quay lại danh sách lớp
      </button>

      <div className="class-header">
        <h2>{classInfo.className}</h2>
        <p>
          Giảng viên: <strong>{classInfo.teacher?.name || "Chưa có"}</strong>
        </p>
        <p>
          Môn học: <strong>{classInfo.subject?.name || "N/A"}</strong>
        </p>
      </div>

      <div className="exams-section">
        <h3>Đề luyện tập trong lớp</h3>

        {loadingExams ? (
          <p>Đang tải đề...</p>
        ) : exams.length === 0 ? (
          <p className="no-exams">Chưa có đề luyện tập nào.</p>
        ) : (
          <div className="exams-list">
            {exams.map((exam) => {
              const open = isExamOpen(exam);
              return (
                <div key={exam._id} className="exam-item">
                  <div className="exam-info">
                    <strong>{exam.title}</strong>
                    <div className="exam-meta">
                      <span>Thời gian: {exam.duration} phút</span>
                      <span>Mở: {formatDate(exam.openTime)}</span>
                      {exam.closeTime && (
                        <span>Đóng: {formatDate(exam.closeTime)}</span>
                      )}
                    </div>
                    <div className="exam-status">
                      <span className={`status ${open ? "open" : "closed"}`}>
                        {open ? "Đang mở" : "Đã đóng"}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => onStartExam(exam._id)}
                    disabled={!open}
                    className={`start-exam-btn ${
                      open ? "active" : "disabled"
                    }`}
                  >
                    {open ? "Làm bài" : "Đã đóng"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default StudentPage;
