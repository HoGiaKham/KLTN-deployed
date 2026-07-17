import React, { useState } from "react";
import { FaUser, FaLock } from "react-icons/fa";
import { API_BASE } from "../config";

function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
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
              />
            </div>

            {error && <p style={styles.errorText}>{error}</p>}

            <button type="submit" style={styles.loginBtn}>
              Login
            </button>
          </form>

          <p style={styles.footerText}>
            Lưu ý: Sử dụng tài khoản được cấp bởi quản trị viên.
          </p>
        </div>
      </div>
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
    cursor: "pointer",
    marginTop: "10px",
    transition: "all 0.3s ease",
    boxShadow: "0 10px 25px rgba(139,92,246,0.3)",
  },

  loginBtnHover: {
    transform: "translateY(-2px)",
    boxShadow: "0 15px 30px rgba(139,92,246,0.5)",
  },

  errorText: {
    color: "#e74c3c",
    fontSize: "14px",
    textAlign: "center",
    marginBottom: "10px",
  },

  footerText: {
    marginTop: "25px",
    textAlign: "center",
    fontSize: "14px",
    color: "#555",
  },

  link: {
    color: "#8B5CF6",
    fontWeight: "600",
    textDecoration: "none",
  },
};

export default Login;
