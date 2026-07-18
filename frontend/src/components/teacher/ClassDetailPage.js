import React, { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { fetchClassById } from "../../api";
import "../../styles/ProfileTeacher.css";

function ClassDetailPage() {
  const { classId } = useParams();
  const navigate = useNavigate();
  const [classInfo, setClassInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState(null);
  const [sortOrder, setSortOrder] = useState("asc");

  // State cho phân trang
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25; // Hiển thị 25 sinh viên 1 trang

  useEffect(() => {
    const loadClassDetail = async () => {
      try {
        setLoading(true);
        const data = await fetchClassById(classId);
        setClassInfo(data);
      } catch (err) {
        setError("Không thể tải thông tin lớp học. Vui lòng thử lại.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadClassDetail();
  }, [classId]);

  // Reset về trang 1 khi tìm kiếm hoặc sắp xếp
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, sortField, sortOrder]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const normalizeString = (str) =>
    str?.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() || "";

  const filteredStudents = useMemo(() => {
    if (!classInfo?.students) return [];
    let students = [...classInfo.students];

    if (searchTerm) {
      const term = normalizeString(searchTerm);
      students = students.filter((s) => {
        const username = normalizeString(s.username);
        const name = normalizeString(s.name);
        return username.includes(term) || name.includes(term);
      });
    }

    if (sortField) {
      students.sort((a, b) => {
        const getLastName = (fullName) =>
          normalizeString(fullName.trim().split(" ").slice(-1)[0]);

        const valA = sortField === "name" ? getLastName(a.name) : normalizeString(a[sortField]);
        const valB = sortField === "name" ? getLastName(b.name) : normalizeString(b[sortField]);

        if (valA < valB) return sortOrder === "asc" ? -1 : 1;
        if (valA > valB) return sortOrder === "asc" ? 1 : -1;
        return 0;
      });
    }
    return students;
  }, [classInfo, searchTerm, sortField, sortOrder]);

  // Tính toán dữ liệu cho trang hiện tại
  const totalPages = Math.ceil(filteredStudents.length / itemsPerPage) || 1;
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentStudents = filteredStudents.slice(indexOfFirstItem, indexOfLastItem);

  if (loading) return <div className="loading">Đang tải thông tin lớp học...</div>;
  if (error) return <div className="error">{error}</div>;
  if (!classInfo) return <div className="error">Không tìm thấy dữ liệu lớp học.</div>;

  return (
    <div 
      className="teacher-profile-page" 
      style={{ 
        padding: "20px", 
        height: "100vh", 
        display: "flex", 
        flexDirection: "column", 
        boxSizing: "border-box" 
      }}
    >
      
      {/* HEADER: Nút quay lại (trái) và Tiêu đề (giữa) cùng 1 hàng */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", position: "relative", marginBottom: "20px", flexShrink: 0 }}>
        <button 
          onClick={() => navigate(-1)}
          style={{
            position: "absolute",
            left: 0,
            padding: "8px 16px",
            backgroundColor: "#6c757d",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: "500"
          }}
        >
          ← Quay lại
        </button>

        <h2 style={{ margin: "0", fontSize: "24px", color: "#2c3e50" }}>
          Danh sách sinh viên
        </h2>
      </div>

      {/* Box màu trắng - Đã FIX lỗi bé tí bằng alignItems: "stretch" */}
      <div 
        className="profile-card" 
        style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'stretch', /* FIX ÉP CHIỀU NGANG TRẢ LẠI 100% */
          flex: 1, 
          padding: '20px', 
          marginTop: 0, 
          minHeight: 0 
        }}
      >
        
        {/* THANH CÔNG CỤ: Thông tin lớp và Tìm kiếm cùng 1 hàng */}
        <div style={{ display: "flex", alignItems: "center", marginBottom: "-15px", gap: "20px", flexShrink: 0 }}>          
          {/* Thông tin lớp - Ép sát trái */}
          <div style={{ 
            backgroundColor: "#eef4ff", 
            padding: "10px 16px", 
            borderRadius: "6px",
            border: "1px solid #d6e2ff",
            color: "#1976d2",
            fontWeight: "500",
            whiteSpace: "nowrap"
          }}>
            <span style={{ marginRight: "15px" }}>🏫 Lớp: <strong>{classInfo.className}</strong></span>
            <span>👥 Sĩ số: <strong>{classInfo.students?.length || 0}</strong> sinh viên</span>
          </div>

          {/* Ô tìm kiếm - Chiếm trọn không gian còn lại */}
          <div style={{ flex: 1 }}>
            <input
              type="text"
              placeholder="🔍 Tìm sinh viên theo mã hoặc họ tên..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ 
                width: "100%", 
                padding: "10px 15px", 
                borderRadius: "8px", 
                border: "1px solid #ccc", 
                fontSize: "14px",
                boxSizing: "border-box",
                outline: "none"
              }}
            />
          </div>

        </div>

        {/* BẢNG SINH VIÊN */}
        <div className="student-table-wrapper" style={{ flex: 1, overflowY: "auto", border: "1px solid #eee", borderRadius: "8px" }}>
          {currentStudents.length > 0 ? (
            <table className="student-table" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ position: "sticky", top: 0, zIndex: 1 }}>
                <tr>
                  <th style={{ background: "#1976d2", color: "white", padding: "14px 12px" }}>STT</th>
                  <th
                    onClick={() => handleSort("username")}
                    style={{ background: "#1976d2", color: "white", padding: "14px 12px", cursor: "pointer" }}
                  >
                    Mã sinh viên {sortField === "username" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
                  </th>
                  <th
                    onClick={() => handleSort("name")}
                    style={{ background: "#1976d2", color: "white", padding: "14px 12px", cursor: "pointer" }}
                  >
                    Họ và tên {sortField === "name" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
                  </th>
                </tr>
              </thead>
              <tbody>
                {currentStudents.map((student, index) => (
                  <tr key={student._id || index} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "12px" }}>{indexOfFirstItem + index + 1}</td>
                    <td style={{ padding: "12px" }}>{student.username}</td>
                    <td style={{ padding: "12px" }}>{student.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="no-students" style={{ textAlign: "center", padding: "20px" }}>Không tìm thấy sinh viên nào.</p>
          )}
        </div>

        {/* Thanh Phân Trang */}
        {filteredStudents.length > itemsPerPage && (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", marginTop: "15px", gap: "10px", flexShrink: 0 }}>
            <button
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              style={{
                padding: "8px 16px",
                borderRadius: "4px",
                border: "1px solid #ccc",
                backgroundColor: currentPage === 1 ? "#f8f9fa" : "#fff",
                cursor: currentPage === 1 ? "not-allowed" : "pointer",
                color: currentPage === 1 ? "#aaa" : "#333"
              }}
            >
              Trước
            </button>
            <span style={{ fontSize: "14px", fontWeight: "500", color: "#333" }}>
              Trang {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              style={{
                padding: "8px 16px",
                borderRadius: "4px",
                border: "1px solid #ccc",
                backgroundColor: currentPage === totalPages ? "#f8f9fa" : "#fff",
                cursor: currentPage === totalPages ? "not-allowed" : "pointer",
                color: currentPage === totalPages ? "#aaa" : "#333"
              }}
            >
              Sau
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ClassDetailPage;