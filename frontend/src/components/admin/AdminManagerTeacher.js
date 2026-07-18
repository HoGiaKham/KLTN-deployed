import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import ModalOverlay from "../common/ModalOverlay";
import "../../styles/AdminManagerTeacher.css";
import TeacherDetailModal from "../admin/TeacherDetailModal";
import { API_BASE } from "../../config";

const normalizeString = (str) =>
  str?.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() || "";

const AdminManagerTeacher = () => {
  const [teachers, setTeachers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [assignments, setAssignments] = useState([]);

  const [addModal, setAddModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState([]);

  // Modal xóa
  const [deleteModal, setDeleteModal] = useState({
    open: false,
    teacherId: null,
    teacherName: "",
  });

  // Loading
  const [loading, setLoading] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterBy, setFilterBy] = useState("all");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  const [notifyModal, setNotifyModal] = useState({
    open: false,
    message: "",
    type: "success", // success | error
  });

  const showNotify = (message, type = "success") => {
    setNotifyModal({ open: true, message, type });
  };

  const [newTeacher, setNewTeacher] = useState({
    name: "",
    username: "",
    password: "123456",
    subjectIds: [],
  });

  useEffect(() => {
    fetchTeachers();
    fetchSubjects();
    fetchAssignments();
  }, []);

  // === FETCH DATA ===
  const fetchTeachers = async () => {
    try {
      const res = await axios.get(`${API_BASE}/users`);
      setTeachers(res.data.filter((u) => u.role === "teacher"));
    } catch (err) {
      console.error("Lỗi khi tải giảng viên:", err);
    }
  };

  const fetchSubjects = async () => {
    try {
      const res = await axios.get(`${API_BASE}/subjects`);
      setSubjects(res.data);
    } catch (err) {
      console.error("Lỗi khi tải môn học:", err);
    }
  };

  const fetchAssignments = async () => {
    try {
      const res = await axios.get(`${API_BASE}/teaching-assignments`);
      const populated = res.data.map((a) => ({
        _id: a._id,
        teacherId: a.teacher?._id || null,
        teacherName: a.teacher?.name || "",
        subjectId: a.subject?._id || null,
        subjectName: a.subject?.name || "",
        classId: a.class?._id || null,
      }));
      setAssignments(populated);
    } catch (err) {
      console.error("Lỗi khi tải phân công:", err);
    }
  };

  const getTeacherSubjects = (teacherId) =>
    [...new Set(assignments.filter((a) => a.teacherId === teacherId).map((a) => a.subjectName))];

  const getTeacherSubjectIds = (teacherId) =>
    assignments.filter((a) => a.teacherId === teacherId).map((a) => a.subjectId);

  // === XÓA GIẢNG VIÊN ===
  const openDeleteModal = (id, name) => {
    setDeleteModal({ open: true, teacherId: id, teacherName: name });
  };

  const confirmDelete = async () => {
    setLoading(true);
    try {
      const { teacherId } = deleteModal;

      const teacherAssignments = assignments.filter((a) => a.teacherId === teacherId);
      await Promise.all(
        teacherAssignments.map((a) => axios.delete(`${API_BASE}/teaching-assignments/${a._id}`))
      );

      await axios.delete(`${API_BASE}/users/${teacherId}`);

      setTeachers((prev) => prev.filter((t) => t._id !== teacherId));
      await fetchAssignments();

      showNotify(`Đã xóa giảng viên "${deleteModal.teacherName}" thành công!`, "success");
    } catch (err) {
      console.error("Lỗi xóa giảng viên:", err);
      showNotify("Không thể xóa giảng viên này!", "error");
    } finally {
      setLoading(false);
      setDeleteModal({ open: false, teacherId: null, teacherName: "" });
    }
  };

  // === CHỈNH SỬA PHÂN CÔNG ===
  const handleSaveEdit = async () => {
    if (selectedSubjectIds.length === 0) {
      showNotify("Vui lòng chọn ít nhất 1 môn học!", "error");
      return;
    }

    setLoading(true);
    try {
      const oldAssignments = assignments.filter((a) => a.teacherId === selectedTeacher._id);
      await Promise.all(
        oldAssignments.map((a) => axios.delete(`${API_BASE}/teaching-assignments/${a._id}`))
      );

      await Promise.all(
        selectedSubjectIds.map((subjectId) =>
          axios.post(`${API_BASE}/teaching-assignments`, {
            teacher: selectedTeacher._id,
            subject: subjectId,
          })
        )
      );

      showNotify("Cập nhật phân công môn học thành công!", "success");
      setEditModal(false);
      await fetchAssignments();
    } catch (err) {
      console.error("Lỗi khi cập nhật:", err);
      showNotify(err.response?.data?.message || "Có lỗi xảy ra khi cập nhật!", "error");
    } finally {
      setLoading(false);
    }
  };

  // === THÊM MỚI GIẢNG VIÊN ===
  const handleSaveNewTeacher = async () => {
    if (!newTeacher.name || !newTeacher.username) {
      showNotify("Vui lòng nhập đầy đủ họ tên và mã giảng viên!", "error");
      return;
    }

    if (newTeacher.subjectIds.length === 0) {
      showNotify("Vui lòng chọn ít nhất 1 môn dạy!", "error");
      return;
    }

    // === KIỂM TRA TRÙNG MÃ GIẢNG VIÊN ===
    const isUsernameTaken = teachers.some(
      (t) => t.username.toLowerCase() === newTeacher.username.toLowerCase()
    );

    if (isUsernameTaken) {
      showNotify("Mã giảng viên đã tồn tại! Vui lòng nhập mã khác.", "error");
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/users`, {
        name: newTeacher.name,
        username: newTeacher.username,
        password: newTeacher.password,
        role: "teacher",
      });

      const teacherId = res.data._id;

      await Promise.all(
        newTeacher.subjectIds.map((subjectId) =>
          axios.post(`${API_BASE}/teaching-assignments`, {
            teacher: teacherId,
            subject: subjectId,
          })
        )
      );

      showNotify("Thêm giảng viên và phân công thành công!", "success");
      setAddModal(false);

      setNewTeacher({ name: "", username: "", password: "123456", subjectIds: [] });

      await fetchTeachers();
      await fetchAssignments();
    } catch (err) {
      console.error("Lỗi khi thêm giảng viên:", err);
      showNotify(err.response?.data?.message || "Không thể thêm giảng viên!", "error");
    } finally {
      setLoading(false);
    }
  };


  // === FILTER & SORT (giữ nguyên) ===
  const filteredTeachers = useMemo(() => {
    const term = normalizeString(searchTerm);
    return teachers.filter((t) => {
      if (!term) return true;
      const subjects = getTeacherSubjects(t._id).join(" ");
      if (filterBy === "name") return normalizeString(t.name).includes(term);
      if (filterBy === "subject") return normalizeString(subjects).includes(term);
      return (
        normalizeString(t.name).includes(term) ||
        normalizeString(t.username).includes(term) ||
        normalizeString(subjects).includes(term)
      );
    });
  }, [teachers, assignments, searchTerm, filterBy]);

  const sortedTeachers = useMemo(() => {
    return [...filteredTeachers].sort((a, b) => {
      if (!sortConfig.key) return 0;
      const getValue = (t) => {
        if (sortConfig.key === "username") return normalizeString(t.username);
        if (sortConfig.key === "name") return normalizeString(t.name);
        if (sortConfig.key === "subjects")
          return normalizeString(getTeacherSubjects(t._id).join(", "));
        return "";
      };
      const aVal = getValue(a), bVal = getValue(b);
      if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredTeachers, sortConfig, assignments]);

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const getSortArrow = (key) => {
    if (sortConfig.key !== key) return "↕";
    return sortConfig.direction === "asc" ? "↑" : "↓";
  };

  return (
    <div className="admin-teacher-container">
      <div className="admin-header-row">
        <h2>Quản lý giảng viên</h2>
        <button className="add-btn" onClick={() => setAddModal(true)}>
          + Thêm giảng viên
        </button>
      </div>

      <div className="search-filter">
        <input
          placeholder="Tìm kiếm..."
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <select value={filterBy} onChange={(e) => setFilterBy(e.target.value)}>
          <option value="all">Tất cả</option>
          <option value="name">Tên giảng viên</option>
          <option value="subject">Môn học</option>
        </select>
      </div>

      <table className="teachers-table">
        <thead>
          <tr>
            <th onClick={() => handleSort("username")}>Mã GV {getSortArrow("username")}</th>
            <th onClick={() => handleSort("name")}>Tên giảng viên {getSortArrow("name")}</th>
            <th onClick={() => handleSort("subjects")}>Môn dạy {getSortArrow("subjects")}</th>
            <th>Hành động</th>
          </tr>
        </thead>
        <tbody>
          {sortedTeachers.map((t) => (
            <tr key={t._id}>
              <td>{t.username}</td>
              <td>{t.name}</td>
              <td>
                {getTeacherSubjects(t._id).length > 0
                  ? getTeacherSubjects(t._id).map((sub, idx) => (
                      <span key={idx} className="badge badge-subject">{sub}</span>
                    ))
                  : <em>Chưa phân công</em>}
              </td>
              <td className="action-btns">
                <button className="edit-btn" onClick={() => setSelectedTeacher(t)}>
                  Xem
                </button>
                <button className="delete-btn" onClick={() => openDeleteModal(t._id, t.name)}>
                  Xóa
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {deleteModal.open && (
        <ModalOverlay onClose={() => setDeleteModal({ open: false, teacherId: null, teacherName: "" })}>
          <div style={{ maxWidth: "440px", textAlign: "center" }}>
            <h3 style={{ color: "#d32f2f", margin: "0 0 16px 0" }}>Xác nhận xóa giảng viên</h3>
            <p style={{ margin: "16px 0", fontSize: "16px" }}>
              Bạn có chắc chắn muốn xóa giảng viên
              <strong style={{ color: "#d32f2f" }}> {deleteModal.teacherName} </strong>
              không?
            </p>
            <p style={{ color: "#d32f2f", fontSize: "14px", margin: "16px 0" }}>
            </p>

            <div className="modal-actions" style={{ marginTop: "24px", gap: "12px" }}>
              <button
                className="delete-btn"
                onClick={confirmDelete}
                disabled={loading}
                style={{ minWidth: "120px" }}
              >
                {loading ? "Đang xóa..." : "Xóa"}
              </button>
              <button
                onClick={() => setDeleteModal({ open: false, teacherId: null, teacherName: "" })}
                disabled={loading}
              >
                Hủy
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* Loading overlay (tùy chọn, đẹp hơn) */}
      {loading && (
        <div className="modal" style={{ background: "rgba(0,0,0,0.3)" }}>
          <div className="modal-content" style={{ background: "transparent", boxShadow: "none" }}>
            <p style={{ color: "white", fontSize: "18px" }}>Đang xử lý...</p>
          </div>
        </div>
      )}

      {/* Giữ nguyên notify modal */}
      {notifyModal.open && (
        <ModalOverlay onClose={() => setNotifyModal({ ...notifyModal, open: false })}>
          <div className={`modal-content notify-modal ${notifyModal.type}`}>
            <h3>{notifyModal.type === "success" ? "✔ Thành công" : "✖ Lỗi"}</h3>
            <p>{notifyModal.message}</p>
            <div className="modal-actions">
              <button onClick={() => setNotifyModal({ ...notifyModal, open: false })}>
                Đóng
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* Modal thêm mới */}
      {addModal && (
        <ModalOverlay onClose={() => setAddModal(false)}>
          <div style={{ position: "relative" }}>

            {/* Nút X để đóng modal */}
            <button
              onClick={() => setAddModal(false)}
              style={{
                position: "absolute",
                top: "10px",
                right: "10px",
                background: "transparent",
                border: "none",
                fontSize: "20px",
                cursor: "pointer",
                color: "#555"
              }}
            >
              ✖
            </button>

            <h3>Thêm giảng viên mới</h3>

            <label>Tên giảng viên:</label>
            <input
              value={newTeacher.name}
              onChange={(e) =>
                setNewTeacher((prev) => ({ ...prev, name: e.target.value }))
              }
            />

            <label>Mã giảng viên:</label>
            <input
              value={newTeacher.username}
              onChange={(e) =>
                setNewTeacher((prev) => ({ ...prev, username: e.target.value }))
              }
            />

            <div className="subjects-selection">
              <p style={{ margin: "0 0 10px 0", fontWeight: "500", color: "#555" }}>
                Chọn môn dạy <span style={{ color: "#d32f2f" }}>*</span>
              </p>
              <div className="subjects-list">
                {subjects.length === 0 ? (
                  <p style={{ color: "#999", textAlign: "center", padding: "20px", margin: 0 }}>
                    Chưa có môn học nào
                  </p>
                ) : (
                  subjects.map((s) => (
                    <label key={s._id} className="subject-checkbox-item">
                      <input
                        type="checkbox"
                        checked={newTeacher.subjectIds.includes(s._id)}
                        onChange={() => {
                          setNewTeacher((prev) => ({
                            ...prev,
                            subjectIds: prev.subjectIds.includes(s._id)
                              ? prev.subjectIds.filter((id) => id !== s._id)
                              : [...prev.subjectIds, s._id],
                          }));
                        }}
                      />
                      <span className="subject-name">{s.name}</span>
                      {s.code && <span className="subject-code">({s.code})</span>}
                    </label>
                  ))
                )}
              </div>
            </div>

            <div className="modal-actions">
              <button onClick={handleSaveNewTeacher}>Lưu</button>
              <button onClick={() => setAddModal(false)}>Đóng</button>
            </div>

          </div>
        </ModalOverlay>
      )}

      {/* Modal phân công môn */}
      {editModal && (
        <ModalOverlay onClose={() => setEditModal(false)}>
          <div>
            <h3>Phân công môn dạy</h3>
            <p>
              <strong>Giảng viên:</strong> {selectedTeacher?.name}
            </p>

            <div className="subjects-selection">
              <p style={{ margin: "0 0 10px 0", fontWeight: "500", color: "#555" }}>
                Chọn môn dạy cho <strong style={{ color: "#1a73e8" }}>{selectedTeacher?.name}</strong>
              </p>
              <div className="subjects-list">
                {subjects.map((s) => (
                  <label key={s._id} className="subject-checkbox-item">
                    <input
                      type="checkbox"
                      checked={selectedSubjectIds.includes(s._id)}
                      onChange={() => {
                        setSelectedSubjectIds((prev) =>
                          prev.includes(s._id)
                            ? prev.filter((id) => id !== s._id)
                            : [...prev, s._id]
                        );
                      }}
                    />
                    <span className="subject-name">{s.name}</span>
                    {s.code && <span className="subject-code">({s.code})</span>}
                  </label>
                ))}
              </div>
            </div>

            <div className="modal-actions">
              <button onClick={handleSaveEdit}>Lưu</button>
              <button onClick={() => setEditModal(false)}>Đóng</button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {selectedTeacher && (
        <TeacherDetailModal
          teacher={selectedTeacher}
          onClose={() => setSelectedTeacher(null)}
          onUpdate={fetchAssignments}
        />
      )}

      {/* Bạn có thể xóa phần này nếu đã dùng ModalOverlay ở trên, nhưng mình vẫn giữ nguyên cấu trúc cho bạn */}
      {notifyModal.open && (
        <div className="modal">
          <div className={`modal-content notify-modal ${notifyModal.type}`}>
            <h3>
              {notifyModal.type === "success" ? "Thành công" : "Lỗi"}
            </h3>
            <p>{notifyModal.message}</p>
            <div className="modal-actions">
              <button onClick={() => setNotifyModal({ ...notifyModal, open: false })}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminManagerTeacher;