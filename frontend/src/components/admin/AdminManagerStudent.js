import React, { useEffect, useState, useMemo, useRef } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import Modal from "../common/Modal";
import ModalOverlay from "../common/ModalOverlay";
import "../../styles/AdminManagerStudent.css";
import StudentDetailModal from "../admin/StudentDetailModal";
import { API_BASE } from "../../config";

const normalizeString = (str) =>
  str?.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() || "";


const AdminManagerStudent = () => {
  const [students, setStudents] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);

  const [successMessage, setSuccessMessage] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState({
    show: false,
    id: null,
    name: "",
  });

  const [modal, setModal] = useState({
    show: false,
    type: "info",
    title: "",
    message: "",
    onConfirm: null,
    showCancel: false
  });


  const [sortConfig, setSortConfig] = useState({
    key: "username",
    direction: "asc",
  });

  const [newStudent, setNewStudent] = useState({
    username: "",
    name: "",
  });

  // Import Excel
  const [importPreview, setImportPreview] = useState([]);
  const fileInputExcelRef = useRef(null);

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    try {
      const res = await axios.get(`${API_BASE}/users`);
      const studentData = res.data.filter((u) => u.role === "student");
      setStudents(studentData);
    } catch (error) {
      console.error("Lỗi lấy danh sách sinh viên:", error);
      setModal({
        show: true,
        type: "error",
        title: "Lỗi",
        message: "Không thể tải dữ liệu!",
        onConfirm: () => setModal({ ...modal, show: false }),
        showCancel: false
      });
    }
  };

  const handleDelete = async () => {
    try {
      await axios.delete(`${API_BASE}/users/${deleteConfirm.id}`);
      setStudents(prev => prev.filter(s => s._id !== deleteConfirm.id));
      setDeleteConfirm({ show: false, id: null, name: "" });
      setSuccessMessage("Xóa sinh viên thành công!");
    } catch (error) {
      console.error("Lỗi khi xóa sinh viên:", error);
      setModal({
        show: true,
        type: "error",
        title: "Lỗi",
        message: "Không thể xóa sinh viên!",
        onConfirm: () => setModal({ ...modal, show: false }),
        showCancel: false
      });
    }
  };


  const handleAddStudent = async (e) => {
    e.preventDefault();
    const username = newStudent.username.trim();
    const name = newStudent.name.trim();

    if (!username || !name) {
      setModal({
        show: true,
        type: "warning",
        title: "Cảnh báo",
        message: "Vui lòng nhập mã sinh viên và họ tên!",
        onConfirm: () => setModal({ ...modal, show: false }),
        showCancel: false
      });
      return;
    }

    if (username.length > 8) {
      setModal({
        show: true,
        type: "warning",
        title: "Cảnh báo",
        message: "Mã sinh viên không được vượt quá 8 ký tự!",
        onConfirm: () => setModal({ ...modal, show: false }),
        showCancel: false
      });
      return;
    }

    const isDuplicate = students.some(s => s.username === username);
    if (isDuplicate) {
      setModal({
        show: true,
        type: "warning",
        title: "Cảnh báo",
        message: `Mã sinh viên ${username} đã tồn tại!`,
        onConfirm: () => setModal({ ...modal, show: false }),
        showCancel: false
      });
      return;
    }

    try {
      const res = await axios.post(`${API_BASE}/users`, {
        username,
        name,
        password: "123456",
        role: "student",
      });
      setStudents((prev) => [...prev, res.data]);
      setNewStudent({ username: "", name: "" });
      setSuccessMessage("Thêm sinh viên thành công! Mật khẩu mặc định: 123456");
    } catch (error) {
      setModal({
        show: true,
        type: "error",
        title: "Lỗi",
        message: error.response?.data?.message || "Không thể thêm sinh viên!",
        onConfirm: () => setModal({ ...modal, show: false }),
        showCancel: false
      });
    }
  };


  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const getSortArrow = (key) => {
    if (sortConfig.key !== key) return "⇅";
    return sortConfig.direction === "asc" ? "▲" : "▼";
  };


  // Tách họ và tên
  const splitName = (fullName) => {
    if (!fullName) return { firstName: "", lastName: "" };
    const parts = fullName.trim().split(" ");
    const firstName = parts.pop() || "";
    const lastName = parts.join(" ");
    return { firstName, lastName };
  };

  // Filter + Sort
  const filteredStudents = useMemo(() => {
    const term = normalizeString(searchTerm);
    return students
      .filter((s) => {
        if (!term) return true;
        const { firstName, lastName } = splitName(s.name);
        return (
          normalizeString(s.username).includes(term) ||
          normalizeString(firstName).includes(term) ||
          normalizeString(lastName).includes(term)
        );
      })
      .sort((a, b) => {
        const { firstName: aFirst, lastName: aLast } = splitName(a.name);
        const { firstName: bFirst, lastName: bLast } = splitName(b.name);

        let aValue = "";
        let bValue = "";

        if (sortConfig.key === "firstName") {
          aValue = normalizeString(aFirst);
          bValue = normalizeString(bFirst);
        } else if (sortConfig.key === "lastName") {
          aValue = normalizeString(aLast);
          bValue = normalizeString(bLast);
        } else {
          aValue = normalizeString(a[sortConfig.key] || "");
          bValue = normalizeString(b[sortConfig.key] || "");
        }

        if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
  }, [students, searchTerm, sortConfig]);

  const handleExcelFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

        // === KIỂM TRA SỐ CỘT ===
        if (data.length === 0) {
          setModal({
            show: true,
            type: "warning",
            title: "Cảnh báo",
            message: "File Excel rỗng! Vui lòng kiểm tra lại.",
            onConfirm: () => setModal({ ...modal, show: false }),
            showCancel: false
          });
          return;
        }

        const headerRow = data[0];
        if (headerRow.length !== 2) {
          setModal({
            show: true,
            type: "error",
            title: "Lỗi định dạng",
            message: `File phải có đúng 2 cột: "Mã SV" và "Họ tên".\nHiện tại file có ${headerRow.length} cột.\n\nVui lòng tải lại file mẫu và nhập đúng định dạng.`,
            onConfirm: () => setModal({ ...modal, show: false }),
            showCancel: false
          });
          return;
        }

        // Kiểm tra header (khuyến khích, không bắt buộc)
        const expectedHeaders = ["Mã SV", "Họ tên"];
        const normalizedHeader = headerRow.map(h => normalizeString(String(h).trim()));
        const expectedNormalized = expectedHeaders.map(normalizeString);
        const isHeaderMatch = normalizedHeader.every((h, i) => h === expectedNormalized[i]);

        if (!isHeaderMatch) {
          setModal({
            show: true,
            type: "confirm",
            title: "Cảnh báo",
            message: `Tiêu đề cột không khớp với mẫu!\n\nDòng 1: [${headerRow.join(", ")}]\nMẫu yêu cầu: [${expectedHeaders.join(", ")}]\n\nBạn có muốn tiếp tục import không?`,
            onConfirm: () => {
              setModal({ ...modal, show: false });
              processExcelRows(data);
            },
            showCancel: true,
            confirmText: "Tiếp tục",
            cancelText: "Hủy"
          });
          return;
        }

        processExcelRows(data);
      } catch (error) {
        setImportPreview([]);
        if (fileInputExcelRef.current) fileInputExcelRef.current.value = "";
      }
    };
    reader.readAsBinaryString(file);
  };

  const processExcelRows = (data) => {
    try {
      const rows = data.slice(1);
      const studentsFromExcel = rows
        .map((row, idx) => {
          // Kiểm tra số lượng cột
          if (row.length !== 2) {
            setModal({
              show: true,
              type: "error",
              title: "Lỗi",
              message: `Lỗi ở dòng ${idx + 2}: File chỉ được phép có 2 cột (Mã SV, Họ tên).`,
              onConfirm: () => setModal({ ...modal, show: false }),
              showCancel: false
            });
            throw new Error("Sai số lượng cột");
          }

          const username = String(row[0] || "").trim();
          const name = String(row[1] || "").trim();

          if (!username || !name) {
            setModal({
              show: true,
              type: "error",
              title: "Lỗi",
              message: `Lỗi ở dòng ${idx + 2}: Mã SV hoặc Họ tên bị trống.`,
              onConfirm: () => setModal({ ...modal, show: false }),
              showCancel: false
            });
            throw new Error("Dữ liệu trống");
          }

          if (username.length > 8) {
            setModal({
              show: true,
              type: "error",
              title: "Lỗi",
              message: `Lỗi ở dòng ${idx + 2}: Mã sinh viên "${username}" vượt quá 8 ký tự.`,
              onConfirm: () => setModal({ ...modal, show: false }),
              showCancel: false
            });
            throw new Error("Mã SV quá dài");
          }

          return { username, name, password: "123456", row: idx + 2 };
        })
        .filter(Boolean);

      setImportPreview(studentsFromExcel);
    } catch (error) {
      setImportPreview([]);
      if (fileInputExcelRef.current) fileInputExcelRef.current.value = "";
    }
  };

  const handleConfirmImport = async () => {
    const existingUsernames = students.map(s => s.username);
    const newStudents = [];

    const seen = new Set();

    for (const s of importPreview) {
      // Trùng trong file import
      if (seen.has(s.username)) {
        setModal({
          show: true,
          type: "error",
          title: "Lỗi",
          message: `Mã SV ${s.username} bị trùng trong file Excel (dòng ${s.row}).`,
          onConfirm: () => setModal({ ...modal, show: false }),
          showCancel: false
        });
        return;
      }
      seen.add(s.username);

      // Trùng với hệ thống
      if (existingUsernames.includes(s.username)) {
        setModal({
          show: true,
          type: "error",
          title: "Lỗi",
          message: `Mã SV ${s.username} đã tồn tại trong hệ thống!`,
          onConfirm: () => setModal({ ...modal, show: false }),
          showCancel: false
        });
        return;
      }

      newStudents.push({
        username: s.username,
        name: s.name,
        password: "123456",
        role: "student",
      });
    }


    try {
      const responses = await Promise.all(
        newStudents.map(s => axios.post(`${API_BASE}/users`, s))
      );

      const added = responses.map(res => res.data);
      setStudents(prev => [...prev, ...added]);
      setImportPreview([]);
      if (fileInputExcelRef.current) fileInputExcelRef.current.value = "";
      setSuccessMessage(`Thêm thành công ${added.length} sinh viên! Mật khẩu mặc định: 123456`);
    } catch (error) {
      setModal({
        show: true,
        type: "error",
        title: "Lỗi",
        message: "Lỗi khi thêm sinh viên từ Excel!",
        onConfirm: () => setModal({ ...modal, show: false }),
        showCancel: false
      });
      console.error(error);
    }
  };

  const downloadStudentTemplate = () => {
    const wb = XLSX.utils.book_new();
    const wsData = [
      ["Mã SV", "Họ tên"],
      ["20120001", "Nguyễn Văn A"],
      ["20120002", "Trần Thị B"],
      ["20120003", "Lê Văn C"]
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [{ wch: 15 }, { wch: 25 }];
    XLSX.utils.book_append_sheet(wb, ws, "DanhSachSV");
    XLSX.writeFile(wb, "Mau_Import_SinhVien.xlsx");
  };

  // Reset khi đóng modal
  const handleCloseModal = () => {
    setShowAddModal(false);
    setImportPreview([]);
    setNewStudent({ username: "", name: "" });
    if (fileInputExcelRef.current) fileInputExcelRef.current.value = "";
  };

  return (
    <div className="admin-student-container">
      <div className="admin-header-row">
        <h2>Quản lý sinh viên</h2>
        <button className="add-btn" onClick={() => setShowAddModal(true)}>
          Thêm sinh viên
        </button>
      </div>

      <div className="search-filter student-search-filter">
        <input
          type="text"
          placeholder="Tìm kiếm sinh viên..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <table>
        <thead>
          <tr>
            <th onClick={() => handleSort("username")}>
              Mã sinh viên {getSortArrow("username")}
            </th>
            <th onClick={() => handleSort("lastName")}>
              Họ {getSortArrow("lastName")}
            </th>
            <th onClick={() => handleSort("firstName")}>
              Tên {getSortArrow("firstName")}
            </th>
            <th>Hành động</th>
          </tr>
        </thead>
        <tbody>
          {filteredStudents.length > 0 ? (
            filteredStudents.map((s) => {
              const { firstName, lastName } = splitName(s.name);
              return (
                <tr key={s._id}>
                  <td>{s.username}</td>
                  <td>{lastName}</td>
                  <td>{firstName}</td>
                  <td>
                    <button
                      onClick={() => setSelectedStudent(s)}
                      className="btn btn-info btn-sm me-2"
                      title="Xem chi tiết"
                    >
                      Xem
                    </button>
                    <button
                      onClick={() =>
                        setDeleteConfirm({ show: true, id: s._id, name: s.name })
                      }
                      className="btn btn-danger btn-sm"
                      title="Xóa"
                    >
                      Xóa
                    </button>
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan="4" style={{ textAlign: "center", color: "#999" }}>
                Không tìm thấy sinh viên nào.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {showAddModal && (
        <ModalOverlay onClose={handleCloseModal}>
          <div>
            <h3 >Thêm sinh viên mới</h3>

            <div style={{
              display: "flex",
              justifyContent: "center",
              gap: "10px",
              marginBottom: "15px"
            }}>
              <button
                onClick={() => fileInputExcelRef.current?.click()}
                style={{
                  fontSize: "13px",
                  padding: "6px 12px",
                  background: "#0d6efd",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer"
                }}
              >
                Import Excel
              </button>

              <button
                onClick={downloadStudentTemplate}
                style={{
                  fontSize: "13px",
                  padding: "6px 12px",
                  background: "#6c757d",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer"
                }}
              >
                Tải mẫu
              </button>
            </div>

            <input
              ref={fileInputExcelRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleExcelFileChange}
              style={{ display: "none" }}
            />

            {/* PREVIEW IMPORT */}
            {importPreview.length > 0 ? (
              <div style={{
                background: "#f0f8ff",
                border: "1px solid #b3e0ff",
                borderRadius: "8px",
                padding: "14px",
                margin: "16px 0",
                maxHeight: "200px",
                overflowY: "auto"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                  <strong>Preview import ({importPreview.length} SV)</strong>
                  <div>
                    <button
                      onClick={handleConfirmImport}
                      style={{
                        background: "#28a745",
                        color: "white",
                        border: "none",
                        padding: "5px 10px",
                        borderRadius: "4px",
                        fontSize: "13px",
                        marginRight: "6px"
                      }}
                    >
                      Xác nhận
                    </button>
                    <button
                      onClick={handleCloseModal}
                      style={{
                        background: "#dc3545",
                        color: "white",
                        border: "none",
                        padding: "5px 10px",
                        borderRadius: "4px",
                        fontSize: "13px"
                      }}
                    >
                      Hủy
                    </button>
                  </div>
                </div>
                <div style={{ fontSize: "13.5px" }}>
                  {importPreview.map((s, i) => (
                    <div key={i} style={{ padding: "3px 0", display: "flex", justifyContent: "space-between" }}>
                      <span>{s.username} - {s.name}</span>
                      <span style={{ color: "#28a745", fontSize: "12px" }}>
                        Mật khẩu: 123456
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <form onSubmit={handleAddStudent}>
                <input
                  type="text"
                  placeholder="Mã sinh viên"
                  value={newStudent.username}
                  onChange={(e) =>
                    setNewStudent({ ...newStudent, username: e.target.value })
                  }
                  required
                />
                <input
                  type="text"
                  placeholder="Họ và tên (VD: Nguyễn Văn A)"
                  value={newStudent.name}
                  onChange={(e) =>
                    setNewStudent({ ...newStudent, name: e.target.value })
                  }
                  required
                />
                <p style={{ fontSize: "13px", color: "#666", margin: "8px 0 16px" }}>
                  Mật khẩu mặc định: <strong>123456</strong>
                </p>
                <div className="modal-buttons">
                  <button type="submit" className="save-btn">
                    Lưu
                  </button>
                  <button
                    type="button"
                    className="cancel-btn"
                    onClick={handleCloseModal}
                  >
                    Hủy
                  </button>
                </div>
              </form>
            )}
            {importPreview.length > 0 && (
              <div style={{ textAlign: "right", marginTop: "10px" }}>
                <button
                  onClick={handleCloseModal}
                  style={{
                    background: "#6c757d",
                    color: "white",
                    border: "none",
                    padding: "8px 16px",
                    borderRadius: "6px",
                    fontSize: "14px",
                    cursor: "pointer"
                  }}
                >
                  Đóng
                </button>
              </div>
            )}
          </div>
        </ModalOverlay>
      )}

      {deleteConfirm.show && (
        <ModalOverlay onClose={() => setDeleteConfirm({ show: false, id: null, name: "" })}>
          <div style={{ textAlign: "center", maxWidth: "520px", width: "100%" }}>
            <h3 style={{ marginBottom: "10px" }}>Xác nhận xoá</h3>
            <p>Bạn có chắc muốn xoá sinh viên <b>{deleteConfirm.name}</b> không?</p>

            <div style={{ marginTop: "20px", display: "flex", justifyContent: "center", gap: "10px" }}>
              <button
                onClick={handleDelete}
                style={{
                  background: "#dc3545",
                  color: "white",
                  padding: "8px 16px",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer"
                }}
              >
                Xoá
              </button>

              <button
                onClick={() => setDeleteConfirm({ show: false, id: null, name: "" })}
                style={{
                  background: "#6c757d",
                  color: "white",
                  padding: "8px 16px",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer"
                }}
              >
                Hủy
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {selectedStudent && (
        <StudentDetailModal
          student={selectedStudent}
          onClose={() => setSelectedStudent(null)}
        />
      )}

      {successMessage && (
        <ModalOverlay onClose={() => setSuccessMessage("")}>
          <div style={{ textAlign: "center", maxWidth: "520px", width: "100%" }}>
            <h3>✔ Thành công!</h3>
            <p style={{ margin: "10px 0 20px" }}>{successMessage}</p>
            <button
              onClick={() => setSuccessMessage("")}
              style={{
                background: "#0d6efd",
                padding: "8px 16px",
                border: "none",
                borderRadius: "6px",
                color: "white",
                cursor: "pointer"
              }}
            >
              Đóng
            </button>
          </div>
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

export default AdminManagerStudent;