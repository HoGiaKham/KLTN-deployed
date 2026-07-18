import React, { useState } from "react";
import { FaUser, FaLock, FaSpinner } from "react-icons/fa";
import { API_BASE } from "../config";

function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  
  // ✅ Thêm state để quản lý trạng thái loading
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true); // Bắt đầu loading

    try {
      const res = await fetch(`${API_BASE}/users/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      
      if (res.ok) {
        const userInfo = {
          _id: data.user._id,
          username: data.user.username,
          role: data.user.role,
          name: data.user.name,
          subjects: data.user.subjects || [],
          token: data.token,
        };
        localStorage.setItem("app_user", JSON.stringify(userInfo));
        onLogin(userInfo);
      } else {
        setError(data.message || "Đăng nhập thất bại");
      }
    } catch (err) {
      console.error("Login error:", err);
      setError("Lỗi kết nối đến server");
    } finally {
      setIsLoading(false); // Kết thúc loading dù thành công hay thất bại
    }
  };

  return (
    <div style={styles.container}>
      {/* Left Gradient Panel */}
      <div style={styles.leftPanel}>
        <h1 style={styles.welcomeText}>Welcome Back!</h1>
        <p style={styles.subText}>Login to access your dashboard</p>
      </div>

      {/* Right Login Modal */}
      <div style={styles.rightPanel}>
        <div style={styles.formContainer}>
          <h2 style={styles.loginTitle}>Sign In</h2>

          <form onSubmit={handleSubmit}>
            <div style={styles.inputWrapper}>
              <FaUser style={styles.icon} />
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={styles.input}
                required
                disabled={isLoading} // Khóa input khi đang load
              />
            </div>

            <div style={styles.inputWrapper}>
              <FaLock style={styles.icon} />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={styles.input}
                required
                disabled={isLoading} // Khóa input khi đang load
              />
            </div>

            {error && <p style={styles.errorText}>{error}</p>}

            {/* ✅ Nút Login với hiệu ứng Loading */}
            <button 
              type="submit" 
              style={{
                ...styles.loginBtn,
                opacity: isLoading ? 0.7 : 1,
                cursor: isLoading ? "not-allowed" : "pointer"
              }}
              disabled={isLoading}
            >
              {isLoading ? (
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
                  <FaSpinner className="spinner-icon" style={{ animation: "spin 1s linear infinite" }} />
                  Đang đánh thức máy chủ (Khoảng 50s)...
                </span>
              ) : (
                "Login"
              )}
            </button>
          </form>

          {/* ✅ Khung hướng dẫn Demo cho Nhà tuyển dụng */}
          <div style={styles.demoBox}>
            <p style={{ margin: "0 0 5px 0", fontWeight: "600", color: "#8B5CF6" }}>💡 Tài khoản Demo (Dành cho nhà tuyển dụng)</p>
            <p style={{ margin: 0, fontSize: "14px" }}>Admin: <strong>admin</strong> | Pass: <strong>123456</strong></p>
          </div>

          <p style={styles.footerText}>
            Lưu ý: Bạn cần dùng tài khoản Quản trị viên để cấp phát tài khoản Giáo viên & Học sinh.
          </p>
        </div>
      </div>

      {/* CSS keyframe cho hiệu ứng xoay (có thể để thẳng vào thẻ style ở React) */}
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
}

// ====================== STYLES ======================
const styles = {
  container: {
    display: "flex",
    minHeight: "100vh",
    fontFamily: "'Poppins', 'Segoe UI', sans-serif",
    background: "#f5f6fa",
  },

  leftPanel: {
    flex: 1,
    background: "linear-gradient(135deg, #8B5CF6, #A78BFA)",
    color: "#fff",
    borderRadius: "0 80px 80px 0",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    textAlign: "center",
    padding: "40px",
  },

  welcomeText: {
    fontSize: "50px",
    fontWeight: "700",
    lineHeight: "1.2",
    marginBottom: "20px",
  },

  subText: {
    fontSize: "18px",
    opacity: 0.85,
  },

  rightPanel: {
    flex: 1,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "50px",
  },

  formContainer: {
    width: "100%",
    maxWidth: "520px",
    padding: "60px 50px",
    borderRadius: "35px",
    background: "rgba(255, 255, 255, 0.95)",
    boxShadow: "0 30px 60px rgba(0,0,0,0.15)",
    backdropFilter: "blur(10px)",
  },

  loginTitle: {
    fontSize: "42px",
    fontWeight: "700",
    marginBottom: "40px",
    color: "#333",
    textAlign: "center",
  },

  inputWrapper: {
    position: "relative",
    marginBottom: "28px",
  },

  input: {
    width: "100%",
    padding: "18px 20px 18px 50px",
    borderRadius: "15px",
    border: "1px solid #ddd",
    fontSize: "16px",
    outline: "none",
    transition: "all 0.3s ease",
  },

  icon: {
    position: "absolute",
    top: "50%",
    left: "18px",
    transform: "translateY(-50%)",
    fontSize: "18px",
    color: "#8B5CF6",
    opacity: 0.9,
  },

  loginBtn: {
    width: "100%",
    padding: "18px",
    borderRadius: "15px",
    border: "none",
    background: "linear-gradient(135deg, #8B5CF6, #A78BFA)",
    color: "#fff",
    fontSize: "18px",
    fontWeight: "600",
    marginTop: "10px",
    transition: "all 0.3s ease",
    boxShadow: "0 10px 25px rgba(139,92,246,0.3)",
  },

  errorText: {
    color: "#e74c3c",
    fontSize: "14px",
    textAlign: "center",
    marginBottom: "10px",
  },

  // ✅ Style cho khung hướng dẫn Demo
  demoBox: {
    marginTop: "25px",
    padding: "15px",
    background: "#f3f0ff",
    border: "1px dashed #8B5CF6",
    borderRadius: "10px",
    textAlign: "center",
    color: "#333",
  },

  footerText: {
    marginTop: "20px",
    textAlign: "center",
    fontSize: "13px",
    color: "#777",
  },
};

export default Login;