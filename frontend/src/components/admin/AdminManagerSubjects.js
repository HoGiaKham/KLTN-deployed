import React, { useEffect, useState } from "react";
import axios from "axios";
import Modal from "../common/Modal";
import ModalOverlay from "../common/ModalOverlay";
import "../../styles/AdminManagerSubjects.css";
import { API_BASE } from "../../config";

const AdminManagerSubjects = () => {
  const [subjects, setSubjects] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState("");

  const [successModal, setSuccessModal] = useState(false);

  const [deleteModal, setDeleteModal] = useState(false);
  const [subjectToDelete, setSubjectToDelete] = useState(null);
  const [deleteSuccessModal, setDeleteSuccessModal] = useState(false);

  const [modal, setModal] = useState({
    show: false,
    type: "info",
    title: "",
    message: "",
    onConfirm: null,
    showCancel: false
  });

  useEffect(() => {
    fetchSubjects();
  }, []);

  // Lấy danh sách môn học
  const fetchSubjects = async () => {
    try {
      const res = await axios.get(`${API_BASE}/subjects`);
      setSubjects(res.data);
    } catch (error) {
      console.error("Lỗi lấy môn học:", error);
      setModal({
        show: true,
        type: "error",
        title: "Lỗi",
        message: "Không thể tải danh sách môn học!",
        onConfirm: () => setModal({ ...modal, show: false }),
        showCancel: false
      });
    }
  };

  // Thêm môn học mới
  const handleAddSubject = async () => {
    const name = newSubjectName.trim();
    if (!name) {
      setModal({
        show: true,
        type: "warning",
        title: "Cảnh báo",
        message: "Vui lòng nhập tên môn học!",
        onConfirm: () => setModal({ ...modal, show: false }),
        showCancel: false
      });
      return;
    }

    try {
      const res = await axios.post(`${API_BASE}/subjects`, { name });
      setSubjects(prev => [...prev, res.data]);
      setNewSubjectName("");
      setModalVisible(false);
      setSuccessModal(true);
    } catch (error) {
      console.error("Lỗi thêm môn học:", error);
      setModal({
        show: true,
        type: "error",
        title: "Lỗi",
        message: error.response?.data?.message || "Có lỗi xảy ra!",
        onConfirm: () => setModal({ ...modal, show: false }),
        showCancel: false
      });
    }
  };

  // Xóa môn học + XÓA TẤT CẢ PHÂN CÔNG LIÊN QUAN
const handleDelete = async () => {
  if (!subjectToDelete) return;

  try {
    await axios.delete(`${API_BASE}/subjects/${subjectToDelete._id}`);
    await axios.delete(`${API_BASE}/teaching-assignments/subject/${subjectToDelete._id}`);

    setSubjects(prev => prev.filter(s => s._id !== subjectToDelete._id));

    // đóng modal xác nhận
    setDeleteModal(false);

    // mở modal xoá thành công
    setDeleteSuccessModal(true);

    // clear môn
    setSubjectToDelete(null);

  } catch (err) {
    console.error("Lỗi xoá môn:", err);
    setModal({
      show: true,
      type: "error",
      title: "Lỗi",
      message: "Không thể xoá môn học!",
      onConfirm: () => setModal({ ...modal, show: false }),
      showCancel: false
    });
  }
};


  return (
    <div className="admin-subjects-container">
      <div className="admin-header-row">
        <h2>Quản lý môn học</h2>
        <button className="add-btn" onClick={() => setModalVisible(true)}>
          Thêm môn học
        </button>
      </div>

      {/* Bảng môn học */}
      <table className="subjects-table">
        <thead>
          <tr>
            <th>Tên môn học</th>
            <th>Hành động</th>
          </tr>
        </thead>
        <tbody>
          {subjects.length === 0 ? (
            <tr>
              <td colSpan="2" style={{ textAlign: "center", color: "#999", fontStyle: "italic" }}>
                Chưa có môn học nào
              </td>
            </tr>
          ) : (
            subjects.map((s) => (
              <tr key={s._id}>
                <td>{s.name}</td>
                <td>
                  <button
                    className="delete-btn"
                    onClick={() => {
                      setSubjectToDelete(s);
                      setDeleteModal(true);
                    }}
                  >
                    Xóa
                  </button>

                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
        {successModal && (
          <ModalOverlay onClose={() => setSuccessModal(false)}>
            <>
              <h3>🎉 Thêm môn học thành công!</h3>
              <div className="modal-actions">
                <button onClick={() => setSuccessModal(false)}>Đóng</button>
              </div>
            </>
          </ModalOverlay>
        )}


      {/* Modal thêm môn học */}
      {modalVisible && (
        <ModalOverlay onClose={() => setModalVisible(false)}>
          <>
            <h3>Thêm môn học mới</h3>
            <input
              type="text"
              placeholder="Nhập tên môn học"
              value={newSubjectName}
              onChange={(e) => setNewSubjectName(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleAddSubject()}
            />
            <div className="modal-actions">
              <button onClick={handleAddSubject}>Xác nhận</button>
              <button onClick={() => {
                setModalVisible(false);
                setNewSubjectName("");
              }}>Hủy</button>
            </div>
          </>
        </ModalOverlay>
      )}

        {deleteModal && (
          <ModalOverlay onClose={() => { setDeleteModal(false); setSubjectToDelete(null); }}>
            <>
              <h3>Xác nhận xoá môn học</h3>
              <p>
                Bạn có chắc muốn xoá môn:
                <strong> {subjectToDelete?.name}</strong>?
                <br />Tất cả phân công liên quan sẽ bị xoá.
              </p>

              <div className="modal-actions">
                <button onClick={handleDelete}>Xác nhận</button>
                <button
                  onClick={() => {
                    setDeleteModal(false);
                    setSubjectToDelete(null);
                  }}
                >
                  Hủy
                </button>
              </div>
            </>
          </ModalOverlay>
        )}


    {deleteSuccessModal && (
      <ModalOverlay onClose={() => setDeleteSuccessModal(false)}>
        <>
          <h3>Đã xoá môn học thành công!</h3>
          <div className="modal-actions">
            <button onClick={() => setDeleteSuccessModal(false)}>Đóng</button>
          </div>
        </>
      </ModalOverlay>
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
};

export default AdminManagerSubjects;