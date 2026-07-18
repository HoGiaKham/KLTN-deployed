import React, { useEffect, useState } from "react";
import axios from "axios";
import "../../styles/StudentPage.css";
import { API_BASE } from "../../config";

function StudentPage({ studentUsername }) {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [studentName, setStudentName] = useState("");

  useEffect(() => {
    const fetchMyClasses = async () => {
      if (!studentUsername) {
        setLoading(false);
        return;
      }

      try {
        const [classesRes, semestersRes, usersRes] = await Promise.all([
          axios.get(`${API_BASE}/classes`),
          axios.get(`${API_BASE}/semesters`),
          axios.get(`${API_BASE}/users`),
        ]);

        const allClasses = classesRes.data;
        const activeSemester = semestersRes.data.find((s) => s.isActive);

        const student = usersRes.data.find(
          (u) => u.username === studentUsername
        );
        setStudentName(student?.name || studentUsername);

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

  if (loading) {
    return <div className="loading">Đang tải lớp học...</div>;
  }

  return (
    <div className="student-page">
      <div className="page-header">
        <h2>Lớp học của tôi</h2>
        <p>
          Xin chào, <strong>{studentName}</strong>! Bạn đang tham gia{" "}
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

export default StudentPage;
