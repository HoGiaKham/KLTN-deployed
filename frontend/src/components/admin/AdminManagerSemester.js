import React, { useEffect, useState } from "react";
import axios from "axios";
import Modal from "../common/Modal";
import "../../styles/AdminManagerSemester.css";
import { API_BASE } from "../../config";

function AdminManagerSemester() {
  const [semesters, setSemesters] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingSemester, setEditingSemester] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    startDate: "", // YYYY-MM-DD (cho input date)
    endDate: "",   // YYYY-MM-DD
    isActive: false,
  });
  const [modal, setModal] = useState({
    show: false,
    type: "info",
    title: "",
    message: "",
    onConfirm: null,
    showCancel: false
  });

  // Format Date → "01/09/2024"
  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const d = String(date.getDate()).padStart(2, "0");
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const y = date.getFullYear();
    return `${d}/${m}/${y}`;
  };

  useEffect(() => {
    fetchSemesters();
  }, []);

  const fetchSemesters = async () => {
    try {
      const res = await axios.get(`${API_BASE}/semesters`);
      setSemesters(res.data);
    } catch (err) {
      setModal({
        show: true,
        type: "error",
        title: "Lỗi",
        message: "Lỗi tải danh sách học kỳ!",
        onConfirm: () => setModal({ ...modal, show: false }),
        showCancel: false
      });
    }
  };

  const openModal = (semester = null) => {
    setEditingSemester(semester);
    if (semester) {
      setFormData({
        name: semester.name,
        startDate: semester.startDate.split("T")[0], // YYYY-MM-DD
        endDate: semester.endDate.split("T")[0],     // YYYY-MM-DD
        isActive: semester.isActive,
      });
    } else {
      setFormData({
        name: "",
        startDate: "",
        endDate: "",
        isActive: false,
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingSemester(null);
    setFormData({ name: "", startDate: "", endDate: "", isActive: false });
  };

const handleSubmit = async () => {
  if (!formData.name.trim()) {
    return setModal({
      show: true,
      type: "warning",
      title: "Cảnh báo",
      message: "Vui lòng nhập tên học kỳ!",
      onConfirm: () => setModal({ ...modal, show: false }),
      showCancel: false
    });
  }
  if (!formData.startDate || !formData.endDate) {
    return setModal({
      show: true,
      type: "warning",
      title: "Cảnh báo",
      message: "Vui lòng chọn ngày bắt đầu và kết thúc!",
      onConfirm: () => setModal({ ...modal, show: false }),
      showCancel: false
    });
  }

  const start = new Date(formData.startDate);
  const end = new Date(formData.endDate);

  if (start >= end) {
    return setModal({
      show: true,
      type: "warning",
      title: "Cảnh báo",
      message: "Ngày bắt đầu phải trước ngày kết thúc!",
      onConfirm: () => setModal({ ...modal, show: false }),
      showCancel: false
    });
  }

  // Nếu đánh dấu active, kiểm tra ngày hôm nay nằm trong khoảng (fix timezone)
  if (formData.isActive) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startCheckDate = new Date(formData.startDate);
    startCheckDate.setHours(0, 0, 0, 0);
    const endCheckDate = new Date(formData.endDate);
    endCheckDate.setHours(0, 0, 0, 0);

    if (today < startCheckDate || today > endCheckDate) {
      return setModal({
        show: true,
        type: "warning",
        title: "Cảnh báo",
        message: "Không thể đặt học kỳ này là kỳ hiện tại vì ngày hôm nay không nằm trong thời gian mở của học kỳ!",
        onConfirm: () => setModal({ ...modal, show: false }),
        showCancel: false
      });
    }
  }

  // Kiểm tra khoảng thời gian mở không trùng với các học kỳ khác (strict check)
  const overlap = semesters.some((sem) => {
    // Bỏ qua nếu đang chỉnh sửa học kỳ hiện tại
    if (editingSemester && sem._id === editingSemester._id) return false;

    const semStart = new Date(sem.startDate);
    const semEnd = new Date(sem.endDate);

    // Kiểm tra có chồng lấn không (strict: không cho phép chỉ chạm tới)
    return (start < semEnd && end > semStart);
  });

  if (overlap) {
    return setModal({
      show: true,
      type: "warning",
      title: "Cảnh báo",
      message: "Khoảng thời gian của học kỳ này trùng lặp với học kỳ khác. Vui lòng chọn lại!",
      onConfirm: () => setModal({ ...modal, show: false }),
      showCancel: false
    });
  }

  const payload = {
    name: formData.name.trim(),
    startDate: new Date(formData.startDate).toISOString(),
    endDate: new Date(formData.endDate).toISOString(),
    isActive: formData.isActive,
  };

  try {
    if (editingSemester) {
      await axios.put(`${API_BASE}/semesters/${editingSemester._id}`, payload);
      closeModal();
      fetchSemesters();
      setModal({
        show: true,
        type: "success",
        title: "Thành công",
        message: "Cập nhật học kỳ thành công!",
        onConfirm: () => setModal({ ...modal, show: false }),
        showCancel: false
      });
    } else {
      await axios.post(`${API_BASE}/semesters`, payload);
      closeModal();
      fetchSemesters();
      setModal({
        show: true,
        type: "success",
        title: "Thành công",
        message: "Tạo học kỳ thành công!",
        onConfirm: () => setModal({ ...modal, show: false }),
        showCancel: false
      });
    }
  } catch (err) {
    setModal({
      show: true,
      type: "error",
      title: "Lỗi",
      message: err.response?.data?.message || "Lỗi khi lưu học kỳ!",
      onConfirm: () => setModal({ ...modal, show: false }),
      showCancel: false
    });
  }
};



  const handleDelete = async (id) => {
    setModal({
      show: true,
      type: "confirm",
      title: "Xác nhận xóa",
      message: "Xóa học kỳ này? Các lớp liên quan sẽ bị ảnh hưởng!",
      onConfirm: () => confirmDelete(id),
      showCancel: true,
      confirmText: "Xóa",
      cancelText: "Hủy"
    });
  };

  const confirmDelete = async (id) => {
    setModal({ ...modal, show: false });
    try {
      await axios.delete(`${API_BASE}/semesters/${id}`);
      fetchSemesters();
      setModal({
        show: true,
        type: "success",
        title: "Thành công",
        message: "Xóa học kỳ thành công!",
        onConfirm: () => setModal({ ...modal, show: false }),
        showCancel: false
      });
    } catch (err) {
      setModal({
        show: true,
        type: "error",
        title: "Lỗi",
        message: err.response?.data?.message || "Không thể xóa (đang có lớp sử dụng)",
        onConfirm: () => setModal({ ...modal, show: false }),
        showCancel: false
      });
    }
  };

  return (
    <div className="admin-semester-container">
      <div className="header">
        <h2>Quản lý học kỳ</h2>
        <button className="add-btn" onClick={() => openModal()}>
          Thêm học kỳ mới
        </button>
      </div>

      <div className="semester-grid">
        {semesters.length === 0 ? (
          <p className="no-data">Chưa có học kỳ nào. Hãy tạo học kỳ đầu tiên!</p>
        ) : (
          semesters.map((sem) => (
            <div
              key={sem._id}
              className={`semester-card ${sem.isActive ? "active" : ""}`}
            >
              <div className="card-header">
                <h3>{sem.name}</h3>
                {sem.isActive && <span className="badge active">Kỳ hiện tại</span>}
              </div>
              <div className="card-body">
                <p>
                  <strong>Từ:</strong> {formatDate(sem.startDate)}
                </p>
                <p>
                  <strong>Đến:</strong> {formatDate(sem.endDate)}
                </p>
              </div>
              <div className="card-actions">
                <button onClick={() => openModal(sem)} className="btn-edit">
                  Sửa
                </button>
                <button onClick={() => handleDelete(sem._id)} className="btn-delete">
                  Xóa
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>{editingSemester ? "Sửa học kỳ" : "Thêm học kỳ mới"}</h3>

            <div className="form-group">
              <label>Tên học kỳ</label>
              <input
                type="text"
                placeholder="VD: Học kỳ 1 2024-2025"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Ngày bắt đầu</label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              />
              <small className="date-hint">
                Bạn chọn: <strong>{formData.startDate ? formatDate(formData.startDate) : "Chưa chọn"}</strong>
              </small>
            </div>

            <div className="form-group">
              <label>Ngày kết thúc</label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              />
              <small className="date-hint">
                Bạn chọn: <strong>{formData.endDate ? formatDate(formData.endDate) : "Chưa chọn"}</strong>
              </small>
            </div>

            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              />
              Đánh dấu là kỳ hiện tại (chỉ 1 kỳ được active)
            </label>

            <div className="modal-actions">
              <button onClick={closeModal} className="btn-cancel">
                Hủy
              </button>
              <button onClick={handleSubmit} className="btn-confirm">
                {editingSemester ? "Cập nhật" : "Tạo mới"}
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

export default AdminManagerSemester;