import React, { useEffect, useState } from "react";
import Swal from "sweetalert2";
import axios from "axios";
import "../styles/CategoryPage.css";
import { API_BASE } from "../config";

function CategoryPage({ onSelectCategory, selectedSubjectId, onSelectSubject }) {
  const [allSubjects, setAllSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState(selectedSubjectId || null);
  const [categories, setCategories] = useState([]);
  const [newCategory, setNewCategory] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [editCategoryName, setEditCategoryName] = useState("");
  const [editCategoryDescription, setEditCategoryDescription] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterOption, setFilterOption] = useState("all");
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);

  // ✅ BƯỚC 1: Load user + môn học + danh mục
  useEffect(() => {
    setLoading(true);
    const storedUser = JSON.parse(localStorage.getItem("app_user"));
    setUser(storedUser);

    if (storedUser?.role === "teacher") {
      // ✅ Gọi endpoint MỚI: trả về subjects + categories
      loadTeacherData(storedUser._id);
    } else {
      // Admin: Load all subjects
      loadAllSubjects();
    }
  }, []);

  // ✅ Hàm load dữ liệu teacher
  const loadTeacherData = async (teacherId) => {
    try {
      console.log("📥 Đang tải dữ liệu teacher...");
      
      const response = await axios.get(`${API_BASE}/categories/teacher-subjects/${teacherId}`);
      
      console.log("✅ Dữ liệu teacher:", response.data);
      setAllSubjects(response.data);
      
    } catch (error) {
      console.error("❌ Lỗi tải dữ liệu:", error);
      Swal.fire("Lỗi!", "Không thể tải danh sách môn học", "error");
    } finally {
      setLoading(false);
    }
  };

  // ✅ Hàm load tất cả môn (admin)
  const loadAllSubjects = async () => {
    try {
      const response = await axios.get(`${API_BASE}/subjects`);
      console.log("✅ Tất cả môn học:", response.data);
      setAllSubjects(response.data);
    } catch (error) {
      console.error("❌ Lỗi tải môn học:", error);
    } finally {
      setLoading(false);
    }
  };

  // ✅ BƯỚC 2: Khi chọn môn → lấy danh mục từ dữ liệu đã load
  useEffect(() => {
    if (selectedSubject && allSubjects.length > 0) {
      console.log("🔍 Tìm subject:", selectedSubject);
      
      // ✅ Tìm subject trong dữ liệu đã fetch
      const foundSubject = allSubjects.find(s => s._id === selectedSubject);
      
      if (foundSubject) {
        console.log("✅ Tìm thấy subject:", foundSubject.name);
        
        // ✅ Lấy categories từ subject (nếu có)
        if (foundSubject.categories && foundSubject.categories.length > 0) {
          console.log("📂 Danh mục từ nested:", foundSubject.categories);
          setCategories(foundSubject.categories);
        } else {
          // ❌ Nếu không có categories nested (admin mode), set rỗng
          console.log("⚠️ Không có danh mục nested");
          setCategories([]);
        }
      } else {
        console.warn("⚠️ Không tìm thấy subject");
        setCategories([]);
      }
    } else {
      setCategories([]);
    }
  }, [selectedSubject, allSubjects]);

  // ✅ Thêm danh mục
  const handleAddCategory = async () => {
    if (!newCategory.trim() || !selectedSubject) return;
    try {
      const response = await axios.post(
        `${API_BASE}/categories/${selectedSubject}`,
        {
          name: newCategory,
          description: newDescription,
          teacherId: user._id
        }
      );

      setNewCategory("");
      setNewDescription("");
      setShowAddForm(false);
      
      // ✅ Reload dữ liệu
      await loadTeacherData(user._id);
      
      Swal.fire("Thành công!", "Đã thêm danh mục mới.", "success");
    } catch (err) {
      console.error("❌ Error:", err);
      Swal.fire("Lỗi!", err.response?.data?.message || "Không thể thêm danh mục", "error");
    }
  };

  // ✅ Sửa danh mục
  const handleEditCategory = async (categoryId) => {
    if (!editCategoryName.trim()) return;
    try {
      await axios.put(
        `${API_BASE}/categories/${categoryId}`,
        {
          name: editCategoryName,
          description: editCategoryDescription,
          teacherId: user._id
        }
      );

      setEditingCategory(null);
      setEditCategoryName("");
      setEditCategoryDescription("");
      
      // ✅ Reload dữ liệu
      await loadTeacherData(user._id);
      
      Swal.fire("Thành công!", "Đã cập nhật danh mục.", "success");
    } catch (err) {
      console.error("❌ Error:", err);
      Swal.fire("Lỗi!", err.response?.data?.message || "Không thể cập nhật danh mục", "error");
    }
  };

  // ✅ Xóa danh mục
  const handleDeleteCategory = async (categoryId) => {
    const result = await Swal.fire({
      title: "Bạn có chắc?",
      text: "Bạn có muốn xóa danh mục này không?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Xóa",
      cancelButtonText: "Hủy",
    });
    
    if (result.isConfirmed) {
      try {
        await axios.delete(
          `${API_BASE}/categories/${categoryId}?teacherId=${user._id}`
        );

        // ✅ Reload dữ liệu
        await loadTeacherData(user._id);
        
        Swal.fire("Đã xóa!", "Danh mục đã được xóa.", "success");
      } catch (error) {
        console.error("❌ Error:", error);
        Swal.fire("Lỗi!", error.response?.data?.message || "Không thể xóa danh mục", "error");
      }
    }
  };

  // ✅ Lọc danh mục
  const filteredCategories = categories
    .filter((category) => {
      const matchesSearch =
        category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (category.description && category.description.toLowerCase().includes(searchTerm.toLowerCase()));

      if (filterOption === "withDescription") {
        return matchesSearch && category.description;
      } else if (filterOption === "withoutDescription") {
        return matchesSearch && !category.description;
      }
      return matchesSearch;
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'));

  if (loading) {
    return <div className="category-page"><p>⏳ Đang tải dữ liệu...</p></div>;
  }

  return (
    <div className="category-page">
      <div className="filters">
        <h3>Quản lý ngân hàng câu hỏi</h3>
        <div className="filter-group">
          <label>Môn học</label>
          <select
            onChange={(e) => {
              const value = e.target.value;
              setSelectedSubject(value);
              if (onSelectSubject) {
                onSelectSubject(value);
              }
            }}
            value={selectedSubject || ""}
          >
            <option value="">-- Chọn môn học --</option>
            {allSubjects.length > 0 ? (
              allSubjects.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                </option>
              ))
            ) : (
              <option disabled>Không có môn học nào</option>
            )}
          </select>
        </div>
        {selectedSubject && (
          <div className="search-filter-group">
            <input
              type="text"
              placeholder="Tìm kiếm danh mục..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
            <select
              value={filterOption}
              onChange={(e) => setFilterOption(e.target.value)}
              className="filter-select"
            >
              <option value="all">Tất cả</option>
              <option value="withDescription">Có mô tả</option>
              <option value="withoutDescription">Không có mô tả</option>
            </select>
          </div>
        )}
      </div>

      <div className="subject-list">
        {selectedSubject ? (
          <>
            <div className="header">
              <h4>Danh sách danh mục ({filteredCategories.length})</h4>
              <button className="add-btn" onClick={() => setShowAddForm(true)}>
                Thêm danh mục
              </button>
            </div>

            {showAddForm && (
              <div className="add-category-form">
                <h4>Thêm danh mục mới</h4>
                <input
                  type="text"
                  placeholder="Nhập tên danh mục..."
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                />
                <textarea
                  placeholder="Nhập mô tả danh mục (tùy chọn)..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  rows={3}
                />
                <div className="form-actions">
                  <button onClick={handleAddCategory}>Lưu</button>
                  <button
                    onClick={() => {
                      setShowAddForm(false);
                      setNewCategory("");
                      setNewDescription("");
                    }}
                    className="cancel-btn"
                  >
                    Hủy
                  </button>
                </div>
              </div>
            )}

            <ul>
              {filteredCategories.length > 0 ? (
                filteredCategories.map((c) => (
                  <li key={c._id}>
                    {editingCategory === c._id ? (
                      <div className="edit-category-form">
                        <input
                          type="text"
                          value={editCategoryName}
                          onChange={(e) => setEditCategoryName(e.target.value)}
                          placeholder="Nhập tên mới..."
                        />
                        <textarea
                          value={editCategoryDescription}
                          onChange={(e) => setEditCategoryDescription(e.target.value)}
                          placeholder="Nhập mô tả mới..."
                          rows={3}
                        />
                        <div className="form-actions">
                          <button onClick={() => handleEditCategory(c._id)}>Lưu</button>
                          <button
                            onClick={() => setEditingCategory(null)}
                            className="cancel-btn"
                          >
                            Hủy
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="category-item">
                        <span
                          onClick={() => {
                            const subject = allSubjects.find((s) => s._id === selectedSubject);
                            onSelectCategory({
                              categoryId: c._id,
                              categoryName: c.name,
                              subjectName: subject?.name || "Không xác định",
                              subjectId: selectedSubject,
                            });
                          }}
                          style={{ cursor: "pointer", flex: 1 }}
                        >
                          {c.name}
                          {c.description && (
                            <p className="category-description">{c.description}</p>
                          )}
                        </span>
                        <div className="actions">
                          <button
                            className="edit-btn"
                            onClick={() => {
                              setEditingCategory(c._id);
                              setEditCategoryName(c.name);
                              setEditCategoryDescription(c.description || "");
                            }}
                          >
                            Sửa
                          </button>
                          <button
                            className="delete-btn"
                            onClick={() => handleDeleteCategory(c._id)}
                          >
                            Xóa
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                ))
              ) : (
                <li style={{ textAlign: "center", padding: "20px", color: "#999" }}>
                  Chưa có danh mục nào. Hãy thêm danh mục mới bằng nút "Thêm danh mục"
                </li>
              )}
            </ul>
          </>
        ) : (
          <p className="no-subject-message">Vui lòng chọn môn học để xem danh mục.</p>
        )}
      </div>
    </div>
  );
}

export default CategoryPage;