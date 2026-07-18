// src/pages/teacher/PracticeExamPage.js
import React, { useEffect, useState } from "react";
import Swal from "sweetalert2";
import "../../../styles/PracticeExamPage.css";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../../../config";

function PracticeExamPage() {
  const [exams, setExams] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingExamId, setEditingExamId] = useState(null);
  const [selectedClasses, setSelectedClasses] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0); // Trigger re-render for status updates
  const navigate = useNavigate();


  // Dữ liệu từ endpoint teacher-subjects (chỉ categories của chính giáo viên)
  const [teacherData, setTeacherData] = useState([]); // [{ _id, name, categories: [...] }]
  const [selectedSubject, setSelectedSubject] = useState("");
  const [categories, setCategories] = useState([]); // Chỉ categories của môn hiện tại + do giáo viên tạo
  const [selectedCategories, setSelectedCategories] = useState([]);

  // Lớp học từ teaching-assignments
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSemester, setSelectedSemester] = useState(null);

  const [examName, setExamName] = useState("");
  const [openTime, setOpenTime] = useState("");
  const [closeTime, setCloseTime] = useState("");

  const currentUser = JSON.parse(localStorage.getItem("app_user") || "{}");

  // Load danh sách đề
  useEffect(() => {
    loadExams();
  }, []);

  // Refresh exam status every 30 seconds to catch when exams open/close
  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshKey(prev => prev + 1);
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, []);

  // Lắng nghe phím ESC để đóng Modal tạo/sửa đề luyện tập
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isModalOpen) {
        setIsModalOpen(false);
        resetForm(); // Gọi hàm này để xóa dữ liệu đang nhập dở
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isModalOpen]);
  
  // Load dữ liệu giáo viên: môn + categories do chính mình tạo
  useEffect(() => {
    const loadTeacherData = async () => {
      if (!currentUser?._id || currentUser?.role !== "teacher") return;

      try {
        const res = await fetch(`${API_BASE}/categories/teacher-subjects/${currentUser._id}`);
        if (!res.ok) throw new Error("Không tải được dữ liệu giảng dạy");

        const data = await res.json();
        console.log("Dữ liệu giáo viên (môn + chương của mình):", data);
        setTeacherData(data); // Dữ liệu đã lọc theo createdBy
      } catch (err) {
        console.error("Lỗi load dữ liệu giáo viên:", err);
        Swal.fire("Lỗi", "Không thể tải danh sách môn học và chương của bạn", "error");
        setTeacherData([]);
      }
    };

    loadTeacherData();
  }, [currentUser?._id]);

  // Khi chọn môn → lấy categories từ teacherData (chỉ của mình)
  useEffect(() => {
    if (!selectedSubject) {
      setCategories([]);
      setSelectedCategories([]);
      return;
    }

    const subject = teacherData.find(s => s._id === selectedSubject);
    if (subject?.categories && subject.categories.length > 0) {
      const sorted = [...subject.categories].sort((a, b) => {
        const numA = parseInt(a.name.match(/\d+/)?.[0]) || 0;
        const numB = parseInt(b.name.match(/\d+/)?.[0]) || 0;
        return numA - numB;
      });
      setCategories(sorted);
    } else {
      setCategories([]);
    }
  }, [selectedSubject, teacherData]);

  // Load lớp học khi chọn môn (giữ nguyên logic cũ)
  useEffect(() => {
    const loadClasses = async () => {
      if (!selectedSubject) {
        setClasses([]);
        setSelectedClass("");
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/teaching-assignments/teacher/${currentUser._id}`);
        if (!res.ok) throw new Error("Lỗi lấy phân công");

        const assigns = await res.json();
        const matched = assigns
          .filter(a => a.subject && String(a.subject._id) === String(selectedSubject) && a.class)
          .map(a => a.class);

        const unique = [];
        const seen = new Set();
        matched.forEach(cls => {
          if (cls && cls._id && !seen.has(cls._id)) {
            seen.add(cls._id);
            unique.push(cls);
          }
        });

        setClasses(unique);
        if (unique.length > 0 && !selectedClass) {
          setSelectedClass(unique[0]._id);
        }
      } catch (err) {
        console.error("Lỗi load lớp:", err);
        setClasses([]);
      }
    };

    loadClasses();
  }, [selectedSubject, currentUser._id]);

  // Khi chọn lớp → lấy học kỳ
  useEffect(() => {
    if (!selectedClass || classes.length === 0) {
      setSelectedSemester(null);
      return;
    }

    const cls = classes.find(c => c._id === selectedClass);
    if (cls?.semester) {
      if (typeof cls.semester === "object" && cls.semester.name) {
        setSelectedSemester(cls.semester);
      } else {
        fetch(`${API_BASE}/semesters/${cls.semester}`)
          .then(r => r.ok ? r.json() : null)
          .then(data => setSelectedSemester(data))
          .catch(() => setSelectedSemester(null));
      }
    } else {
      setSelectedSemester(null);
    }
  }, [selectedClass, classes]);

  const loadExams = async () => {
    if (!currentUser?._id) return;

    try {
      const res = await fetch(`${API_BASE}/practice-exams/teacher/${currentUser._id}`, {
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache",
          "Expires": "0"
        }
      });
      if (!res.ok) throw new Error("Lỗi tải đề");
      const data = await res.json();
      setExams(data);
    } catch (err) {
      console.error("Lỗi load exams:", err);
      setExams([]);
    }
  };

  const resetForm = () => {
    setExamName("");
    setSelectedSubject("");
    setSelectedCategories([]);
    setSelectedClasses([]);
    setOpenTime("");
    setCloseTime("");
    setIsEditMode(false);
    setEditingExamId(null);
    setClasses([]);
    setSelectedClass("");
    setSelectedSemester(null);
  };

  const getExamStatus = (exam) => {
    const now = new Date();
    const open = exam.openTime ? new Date(exam.openTime) : null;
    const close = exam.closeTime ? new Date(exam.closeTime) : null;

    if (!open) return { status: "Chưa đặt lịch", className: "status-pending" };
    if (now < open) return { status: "Chưa mở", className: "status-upcoming" };
    if (close && now > close) return { status: "Đã đóng", className: "status-closed" };
    return { status: "Đang mở", className: "status-open" };
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return "Chưa đặt";
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  };
const showValidationError = (title, text) => {
  Swal.fire({
    title: title,
    text: text,
    icon: "warning",
    position: "center",
    showConfirmButton: true,
    allowOutsideClick: false,
    allowEscapeKey: false,
    customClass: {
      popup: 'validation-popup'
    }
  });
};
const handleSaveExam = async () => {
  if (openTime && new Date(openTime) < new Date()) {
  showValidationError("Thời gian không hợp lệ", "Thời gian mở phải lớn hơn hoặc bằng hiện tại");
  return;
}

  if (!examName?.trim()) {
    showValidationError("Thiếu tên đề", "Vui lòng nhập tên đề", "warning");
    return;
  }
  if (!selectedSubject) {
    showValidationError("Thiếu môn học", "Vui lòng chọn môn", "warning");
    return;
  }
  if (selectedCategories.length === 0) {
    showValidationError("Thiếu chương", "Vui lòng chọn ít nhất 1 chương", "warning");
    return;
  }
  if (!isEditMode && selectedClasses.length === 0) {
    showValidationError("Thiếu lớp", "Vui lòng chọn ít nhất 1 lớp học", "warning");
    return;
  }

  const examData = {
    title: examName.trim(),
    subject: selectedSubject,
    categories: selectedCategories,
    classes: selectedClasses, // Mảng các lớp được chọn
    teacherId: currentUser._id, // Thêm dòng này
    openTime: openTime || null,
    closeTime: closeTime || null,
  };

  try {
    let url = `${API_BASE}/practice-exams`;
    let method = "POST";

    if (isEditMode) {
      url = `${API_BASE}/practice-exams/${editingExamId}`;
      method = "PUT";
    }

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(examData),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(errorText || "Lỗi server");
    }

    const savedExam = await res.json();

    if (isEditMode) {
      setExams(prev => prev.map(e => e._id === editingExamId ? savedExam : e));
      Swal.fire("Thành công!", "Cập nhật đề thành công!", "success");
    } else {
      setExams(prev => [...prev, savedExam]);
      Swal.fire("Thành công!", "Tạo đề luyện tập thành công!", "success");
    }

    setIsModalOpen(false);
    resetForm();
    loadExams(); // Refresh lại danh sách đề
  } catch (error) {
    console.error("Lỗi lưu đề:", error);
    Swal.fire("Lỗi", error.message || "Không thể lưu đề", "error");
  }
};

  const handleEditExam = async (e, exam) => {
    e.stopPropagation();
    try {
      const res = await fetch(`${API_BASE}/practice-exams/${exam._id}`, {
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache",
          "Expires": "0"
        }
      });
      if (!res.ok) throw new Error("Không thể tải đề");

      const data = await res.json();

      const getLocalDateTime = (dateString) => {
        if (!dateString) return "";
        const date = new Date(dateString);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
      };

      setIsEditMode(true);
      setEditingExamId(exam._id);
      setExamName(data.title);
      setSelectedSubject(data.subject._id);
      setSelectedCategories(data.categories.map(c => c._id));
      setOpenTime(getLocalDateTime(data.openTime));
      setCloseTime(getLocalDateTime(data.closeTime));

      setIsModalOpen(true);
    } catch (error) {
      Swal.fire("Lỗi", "Không thể chỉnh sửa đề này", "error");
    }
  };

  const handleDeleteExam = async (e, exam) => {
    e.stopPropagation();
    const result = await Swal.fire({
      title: "Xác nhận xóa?",
      html: `Xóa đề <strong>"${exam.title}"</strong>?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Xóa",
      cancelButtonText: "Hủy",
    });

    if (result.isConfirmed) {
      try {
        const res = await fetch(`${API_BASE}/practice-exams/${exam._id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Không thể xóa");
        setExams(prev => prev.filter(e => e._id !== exam._id));
        Swal.fire("Đã xóa!", "Đề đã được xóa", "success");
      } catch (error) {
        Swal.fire("Lỗi", "Không thể xóa đề", "error");
      }
    }
  };

  return (
    <div className="practice-exam-page">
      <div className="header">
        <h3 className="title">Danh sách đề luyện tập</h3>
        <button className="action-btn" onClick={() => { setIsModalOpen(true); resetForm(); }}>
          + Tạo đề luyện tập
        </button>
      </div>

      <div className="exam-list" key={refreshKey}>
        {exams.length === 0 ? (
          <p className="no-exams-message">
            Chưa có đề luyện tập nào. Nhấn nút "+" để tạo đề mới.
          </p>
        ) : (
          exams.map((exam) => {
            const examStatus = getExamStatus(exam);
            return (
            <div
              key={exam._id}
              className="exam-card"
              onClick={() => navigate(`/practice-exam-detail/${exam._id}`)}
            >
              <div className="exam-header">
                <div className="exam-title-row">
                  <h4 className="exam-title">
                    {exam.title}
                  </h4>
                </div>
                <span className={`status-badge ${examStatus.className}`}>{examStatus.status}</span>
              </div>

              <div className="exam-info">
                <span className="info-text">📚 Môn: {exam.subject?.name}</span>
                {exam.classes && exam.classes.length > 0 && (
                  <span className="info-text">🏫 Lớp: {exam.classes.map(c => c.className).join(', ')}</span>
                )}
                <span className="info-text">🕐 Mở: {formatDateTime(exam.openTime)}</span>
              </div>

              <div className="exam-actions">
                <button className="btn-small btn-blue" onClick={(e) => { e.stopPropagation(); handleEditExam(e, exam); }}>
                  ✏️
                </button>
                <button className="btn-small btn-red" onClick={(e) => { e.stopPropagation(); handleDeleteExam(e, exam); }}>
                  🗑️
                </button>
              </div>
            </div>
            );
          })
        )}
      </div>

      {/* Modal tạo/sửa đề */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{isEditMode ? "Chỉnh sửa đề" : "Tạo đề luyện tập mới"}</h3>
              <button className="modal-close-btn" onClick={() => { setIsModalOpen(false); resetForm(); }}>
                ×
              </button>
            </div>

            <div className="modal-body">
              {/* Form */}
              <div className="form-group">
                <label>Môn học</label>
                <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)}>
                  <option value="">-- Chọn môn học --</option>
                  {teacherData
                    .slice() // tạo bản sao tránh mutate state gốc
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((s) => (
                      <option key={s._id} value={s._id}>{s.name}</option>
                    ))}
                </select>
              </div>

              {!isEditMode && (
                <div className="form-group">
                  <label>Lớp học</label>
                  {classes.length === 0 ? (
                    <p style={{ color: "#999", fontStyle: "italic" }}>Chưa có lớp nào được phân công</p>
                  ) : (
                    <div className="class-option-container">
                      {classes
                        .slice()
                        .sort((a, b) => a.className.localeCompare(b.className))
                        .map((cls) => (
                          <div
                            key={cls._id}
                            className={`class-option ${selectedClasses.includes(cls._id) ? "selected" : ""}`}
                            onClick={() => {
                              setSelectedClasses(prev =>
                                prev.includes(cls._id)
                                  ? prev.filter(id => id !== cls._id)
                                  : [...prev, cls._id]
                              );
                            }}
                          >
                            <input type="checkbox" checked={selectedClasses.includes(cls._id)} readOnly />
                            <span>{cls.className}</span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}

              {selectedSemester && !isEditMode && (
                <div className="form-group">
                  <label>Học kỳ</label>
                  <input type="text" value={selectedSemester.name || "Chưa xác định"} readOnly style={{ background: "#f9f9f9" }} />
                </div>
              )}

              <div className="form-group">
                <label>Chương</label>
                {!selectedSubject ? (
                  <p style={{ color: "#666" }}>Vui lòng chọn môn học trước</p>
                ) : categories.length === 0 ? (
                  <p style={{ color: "#999", fontStyle: "italic" }}>Bạn chưa tạo chương nào cho môn này</p>
                ) : (
                  <div className="category-option-container">
                    {categories.map((c) => (
                      <div
                        key={c._id}
                        className={`category-option ${selectedCategories.includes(c._id) ? "selected" : ""}`}
                        onClick={() => {
                          setSelectedCategories(prev =>
                            prev.includes(c._id)
                              ? prev.filter(id => id !== c._id)
                              : [...prev, c._id]
                          );
                        }}
                      >
                        <input type="checkbox" checked={selectedCategories.includes(c._id)} readOnly />
                        <span>{c.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="form-group">
                <label>Tên đề</label>
                <input
                  type="text"
                  value={examName}
                  onChange={(e) => setExamName(e.target.value)}
                  placeholder="Ví dụ: Đề ôn tập chương 1 - 3"
                />
              </div>

              <div className="form-group">
                <label>Thời gian mở (tùy chọn)</label>
                <input
                  type="datetime-local"
                  value={openTime}
                  min={new Date().toISOString().slice(0, 16)} // ngày hiện tại trở đi
                  onChange={(e) => setOpenTime(e.target.value)}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button onClick={handleSaveExam} className="btn-primary">
                {isEditMode ? "Cập nhật đề" : "Tạo đề"}
              </button>
              <button onClick={() => { setIsModalOpen(false); resetForm(); }} className="btn-secondary">
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PracticeExamPage;