import React, { useEffect, useState } from "react";
import { API_BASE, API_HOST } from "../../../config";
import { useParams, useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import "../../../styles/TakeExamPage.css";
import { useLocation } from "react-router-dom";

function TakeTestExamPage() {
  const { examId } = useParams();
  const location = useLocation();
  const initialAnswers = location.state?.answers || {};
  const navigate = useNavigate();
  const [exam, setExam] = useState(null);
  const [answers, setAnswers] = useState(initialAnswers);
  const [timeLeft, setTimeLeft] = useState(0);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [flaggedQuestions, setFlaggedQuestions] = useState([]);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [hasAttempted, setHasAttempted] = useState(false);
  const [attemptResult, setAttemptResult] = useState(null);
  const [showResultPage, setShowResultPage] = useState(false);
  
  // ✅ ANTI-CHEATING: Track cảnh báo
  const [warningCount, setWarningCount] = useState(0);

  // 🧪 TEST MODE: Set to true to disable beforeUnload warning for testing
  // Có thể thay đổi trong DevTools: window.testMode = true
  const [testMode] = useState(() => {
    if (typeof window !== 'undefined') {
      window.testMode = false; // Default: false (production)
    }
    return false;
  });

  const QUESTIONS_PER_PAGE = 3;

  useEffect(() => {
    // 🔄 Khôi phục câu trả lời từ localStorage khi reload
    const savedAnswers = localStorage.getItem(`test-exam-${examId}-answers`);
    if (savedAnswers) {
      try {
        const parsed = JSON.parse(savedAnswers);
        setAnswers(parsed);
        console.log(`✅ Restored ${Object.keys(parsed).length} answers from localStorage`);
      } catch (e) {
        console.warn("Could not parse saved answers:", e);
      }
    }
    checkExamAttempt();
  }, [examId]);

  const getStudentId = () => {
    // ✅ FIX: Check "app_user" first (new storage location)
    let studentId = localStorage.getItem("app_user");

    if (studentId) {
      if (studentId.startsWith("{")) {
        try {
          const userObj = JSON.parse(studentId);
          studentId = userObj._id || userObj.id;
          return studentId;
        } catch (e) {
          console.error("Error parsing app_user:", e);
        }
      }
      return studentId;
    }

    // Fallback: Check "userId" (legacy storage location)
    studentId = localStorage.getItem("userId");

    if (studentId) {
      if (studentId.startsWith("{")) {
        try {
          const userObj = JSON.parse(studentId);
          studentId = userObj._id;
          return studentId;
        } catch (e) {
          console.error("Error parsing userId:", e);
        }
      }
      return studentId;
    }

    studentId = sessionStorage.getItem("userId");
    if (studentId) {
      if (studentId.startsWith("{")) {
        try {
          const userObj = JSON.parse(studentId);
          studentId = userObj._id;
          return studentId;
        } catch (e) {
          console.error("Error parsing userId:", e);
        }
      }
      return studentId;
    }

    const params = new URLSearchParams(window.location.search);
    studentId = params.get("studentId");
    if (studentId) {
      return studentId;
    }

    const keys = Object.keys(localStorage);
    const userKey = keys.find(key => 
      key.toLowerCase().includes("user") || 
      key.toLowerCase().includes("id") ||
      key === "_id"
    );

    if (userKey) {
      let value = localStorage.getItem(userKey);
      if (value && value.startsWith("{")) {
        try {
          const userObj = JSON.parse(value);
          value = userObj._id;
        } catch (e) {
          console.error("Error parsing from userKey:", e);
        }
      }
      return value;
    }

    return null;
  };

  const checkExamAttempt = async () => {
    try {
      const studentId = getStudentId();

      // ✅ FIX: Nếu không tìm thấy studentId, cừ cố fetch exam data trước
      // Nếu có dữ liệu exam, cho phép tiếp tục; nếu không mới báo lỗi
      if (!studentId) {
        console.warn("⚠️ Student ID not found, trying to fetch exam data anyway...");
        fetchExamForStudent();
        return;
      }

      console.log("🔍 Checking if student already attempted this exam...");

      const checkRes = await fetch(
        `${API_BASE}/test-exams/${examId}/check-attempt?studentId=${studentId}`
      );

      if (!checkRes.ok) {
        const error = await checkRes.json();
        throw new Error(error.error || "Không thể kiểm tra trạng thái bài thi");
      }

      const result = await checkRes.json();

      // ✅ VẤN ĐỀ 1: Nếu đã làm rồi, hiển thị nút "Xem lại" thay vì làm lại
      if (result.hasAttempted) {
        console.log("⚠️ Student already attempted this exam");
        setHasAttempted(true);
        setAttemptResult(result);
        setExam({ title: "" });
        setLoading(false);
        return;
      }

      console.log("✅ Student can take this exam");
      fetchExamForStudent();
    } catch (err) {
      console.error("Error checking exam attempt:", err);
      await Swal.fire({
        icon: "error",
        title: "Lỗi",
        text: err.message || "Đã xảy ra lỗi khi kiểm tra bài thi",
        confirmButtonText: "Quay lại danh sách",
        allowOutsideClick: false,
        allowEscapeKey: false,
      });
      navigate("/myTest");
    }
  };

  // ✅ ANTI-CHEATING: Detect Copy
  useEffect(() => {
    const handleCopy = (e) => {
      if (!isSubmitted && !hasAttempted) {
        e.preventDefault();
        handleWarning("copy");
      }
      return false;
    };

    document.addEventListener("copy", handleCopy);
    return () => document.removeEventListener("copy", handleCopy);
  }, [isSubmitted, hasAttempted, warningCount]);

  // ✅ ANTI-CHEATING: Detect Tab Switch
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && !isSubmitted && !hasAttempted) {
        handleWarning("tabswitch");
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [isSubmitted, hasAttempted, warningCount]);

  // ✅ ANTI-CHEATING: Detect Right Click
  useEffect(() => {
    const handleContextMenu = (e) => {
      if (!isSubmitted && !hasAttempted) {
        e.preventDefault();
        handleWarning("rightclick");
      }
      return false;
    };

    document.addEventListener("contextmenu", handleContextMenu);
    return () => document.removeEventListener("contextmenu", handleContextMenu);
  }, [isSubmitted, hasAttempted, warningCount]);

  // ✅ ANTI-CHEATING: Prevent Page Unload
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      // 🧪 Skip check if testMode is enabled (for testing timer reset)
      if (window.testMode) {
        return; // Allow page unload without warning
      }

      if (!isSubmitted && exam && !hasAttempted) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isSubmitted, exam, hasAttempted]);

  // ✅ ANTI-CHEATING: Xử lý cảnh báo
  const handleWarning = (type) => {
    const newCount = warningCount + 1;
    setWarningCount(newCount);

    let warningMessage = "";
    let warningTitle = "⚠️ Cảnh báo";

    switch (type) {
      case "copy":
        warningMessage = "Không được copy câu hỏi!";
        break;
      case "tabswitch":
        warningMessage = "Không được chuyển sang tab khác!";
        break;
      case "rightclick":
        warningMessage = "Không được dùng chuột phải!";
        break;
      default:
        warningMessage = "Vi phạm quy tắc làm bài!";
    }

    if (newCount === 1) {
      // Cảnh báo lần 1
      Swal.fire({
        icon: "warning",
        title: warningTitle,
        text: `${warningMessage}\n\nCảnh báo 1/3 - Vi phạm 2 lần nữa sẽ tự động nộp bài!`,
        confirmButtonText: "Đã hiểu",
        allowOutsideClick: false,
        allowEscapeKey: false,
      });
    } else if (newCount === 2) {
      // Cảnh báo lần 2
      Swal.fire({
        icon: "warning",
        title: warningTitle,
        text: `${warningMessage}\n\nCảnh báo 2/3 - Vi phạm 1 lần nữa sẽ tự động nộp bài!`,
        confirmButtonText: "Đã hiểu",
        allowOutsideClick: false,
        allowEscapeKey: false,
      });
    } else if (newCount >= 3) {
      // Cảnh báo lần 3 - Tự động nộp bài
      Swal.fire({
        icon: "error",
        title: "❌ Vi phạm quy tắc!",
        text: "Bạn đã vi phạm 3 lần. Bài thi sẽ được tự động nộp!",
        confirmButtonText: "Tôi đã hiểu",
        allowOutsideClick: false,
        allowEscapeKey: false,
      }).then(() => {
        handleFinalSubmit(true);
      });
    }
  };

  useEffect(() => {
    if (!exam || hasAttempted || showResultPage) return;

    // 🕐 Ưu tiên lấy endTime từ localStorage (nếu đang tiếp tục từ bài làm cũ)
    // Chỉ dùng backend endTime nếu đây là lần đầu tiên
    let endTime;

    const storedEndTime = localStorage.getItem(`test-exam-${examId}-endTime`);

    if (storedEndTime) {
      // ✅ Đã từng vào làm bài này, tiếp tục từ thời gian cũ
      endTime = parseInt(storedEndTime);
      console.log(`✅ Using endTime from localStorage (resume): ${new Date(endTime).toLocaleTimeString()}`);
    } else if (exam.endTime) {
      // Lần đầu tiên vào, dùng endTime từ backend
      endTime = new Date(exam.endTime).getTime();
      localStorage.setItem(`test-exam-${examId}-endTime`, endTime);
      localStorage.setItem(`test-exam-${examId}-serverTime`, new Date(exam.serverTime).getTime());
      console.log(`✅ Using endTime from backend (first time): ${new Date(endTime).toLocaleTimeString()}`);
    } else {
      // Fallback: tính từ client (không nên xảy ra)
      endTime = Date.now() + (exam.duration || 60) * 60 * 1000;
      localStorage.setItem(`test-exam-${examId}-endTime`, endTime);
      console.log(`⚠️ Calculated endTime from client: ${new Date(endTime).toLocaleTimeString()}`);
    }

    const updateTime = () => {
      const now = Date.now();
      const diff = Math.ceil((endTime - now) / 1000);
      if (diff <= 0) {
        setTimeLeft(0);
        handleFinalSubmit(true);
      } else {
        setTimeLeft(diff);
      }
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, [exam, examId, hasAttempted, showResultPage]);

  const fetchExamForStudent = async () => {
    try {
      const res = await fetch(`${API_BASE}/test-exams/student/${examId}/take`);

      if (!res.ok) {
        let errorMessage = "Không thể tải đề thi";
        try {
          const error = await res.json();
          errorMessage = error.error || error.message || errorMessage;
        } catch (e) {
          console.error("Could not parse error response");
        }
        throw new Error(errorMessage);
      }

      const data = await res.json();

      if (!data || !data._id) {
        throw new Error("Dữ liệu đề thi không hợp lệ");
      }

      if (!data.questions || data.questions.length === 0) {
        throw new Error("Đề thi không có câu hỏi nào");
      }

      // 🕐 Lưu endTime & serverTime từ backend vào localStorage để tránh reset khi mất mạng
      // ⚠️ KHÔNG overwrite nếu đã có (để giữ lại endTime từ lần làm bài trước)
      if (data.endTime && data.serverTime) {
        const existingEndTime = localStorage.getItem(`test-exam-${examId}-endTime`);
        if (!existingEndTime) {
          // Lần đầu tiên, lưu endTime từ backend
          const endTimeMs = new Date(data.endTime).getTime();
          const serverTimeMs = new Date(data.serverTime).getTime();
          localStorage.setItem(`test-exam-${examId}-endTime`, endTimeMs);
          localStorage.setItem(`test-exam-${examId}-serverTime`, serverTimeMs);
          console.log(`✅ Saved endTime to localStorage (first time): ${new Date(endTimeMs).toLocaleTimeString()}`);
        } else {
          // Đã có endTime từ lần trước, không overwrite
          console.log(`✅ Keeping existing endTime from localStorage`);
        }
      }

      // ✅ FIX: KHÔNG lưu exam data vào localStorage
      // Lý do: Shuffle order từ backend sẽ bị cache nếu lưu
      // Mỗi lần vào làm bài cần fetch lại để nhận shuffle order mới
      // localStorage.setItem(`test-exam-${examId}-data`, JSON.stringify(data));
      console.log(`✅ Fetched exam data from backend (not cached to ensure fresh shuffle order)`);

      // ✅ DEBUG: Log các câu hỏi để kiểm tra dữ liệu
      console.log(`📋 Total questions received: ${data.questions.length}`);
      data.questions.forEach((q, idx) => {
        if (q.questionId) {
          const hasImage = q.questionId.image || q.questionId.imageUrl;
          console.log(`Q${idx + 1}: image="${q.questionId.image}", imageUrl="${q.questionId.imageUrl}", hasImage=${!!hasImage}`);
          if (hasImage) {
            console.log(`  → Question ${idx + 1} image details:`, {
              image: q.questionId.image,
              imageUrl: q.questionId.imageUrl
            });
          }
        }
      });

      setExam(data);
      // 🕐 FIX: Chỉ set timeLeft = full duration nếu không có saved endTime
      // Nếu có saved endTime (vừa fetch từ localStorage), timer sẽ tự update trong useEffect
      const storedEndTime = localStorage.getItem(`test-exam-${examId}-endTime`);
      if (!storedEndTime) {
        // Lần đầu tiên vào làm bài, khởi tạo full duration
        setTimeLeft(data.duration * 60);
      }
      // Nếu có storedEndTime, mỗi lần exam state thay đổi sẽ trigger timer useEffect
      // và sẽ tính toán đúng thời gian còn lại từ endTime
    } catch (err) {
      const errorMessage = err.message || "Đã xảy ra lỗi khi tải đề thi";

      Swal.fire({
        icon: "error",
        title: "Không thể tải đề thi",
        text: errorMessage,
        confirmButtonText: "Quay lại",
        allowOutsideClick: false
      }).then(() => {
        navigate("/myTest");
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerChange = (questionId, optionIndex) => {
    const newAnswers = { ...answers, [questionId]: optionIndex };
    setAnswers(newAnswers);
    localStorage.setItem(`test-exam-${examId}-answers`, JSON.stringify(newAnswers));
  };

  const toggleFlag = (questionId) => {
    setFlaggedQuestions((prev) =>
      prev.includes(questionId)
        ? prev.filter((id) => id !== questionId)
        : [...prev, questionId]
    );
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const calculateScore = () => {
    let correctCount = 0;
    let totalPoints = 0;
    let earnedPoints = 0;

    // ✅ FIX: Lọc bỏ các câu hỏi null trước khi tính điểm
    exam.questions
      .filter(q => q && q.questionId) // ✅ Bỏ qua nếu questionId là null/undefined
      .forEach((q) => {
        const question = q.questionId;
        const userAnswer = answers[question._id];
        const correctAnswer =
          question.originalCorrectAnswer !== undefined
            ? question.originalCorrectAnswer
            : question.correctAnswer;

        totalPoints += q.points || 1;

        // ✅ FIX: Convert to number for reliable comparison
        const userAnswerNum = userAnswer !== undefined && userAnswer !== null ? Number(userAnswer) : null;
        const correctAnswerNum = Number(correctAnswer);

        if (userAnswerNum === correctAnswerNum && userAnswerNum !== null) {
          correctCount++;
          earnedPoints += q.points || 1;
        }
      });

    const percentage = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0;

    return {
      correctCount,
      totalQuestions: exam.questions.length,
      earnedPoints: earnedPoints.toFixed(2),
      totalPoints: totalPoints.toFixed(2),
      percentage: percentage.toFixed(2)
    };
  };

  const handleSubmit = () => {
    setShowSummaryModal(true);
  };

  const handleGoBack = () => {
    setShowSummaryModal(false);
  };

  const handleConfirmSubmit = () => {
    setShowSummaryModal(false);
    setShowConfirmModal(true);
  };

  const handleFinalSubmit = async (isAutoSubmit = false) => {
    if (isSubmitted) return;

    setIsSubmitted(true);
    const score = calculateScore();

    try {
      const studentId = getStudentId();
      if (!studentId) {
        throw new Error("Không tìm thấy thông tin sinh viên");
      }

      // ✅ FIX: Convert answers từ shuffled index về original index
      const convertedAnswers = {};
      const shuffleMappings = {}; // ✅ NEW: Collect shuffle mappings for review
      Object.entries(answers).forEach(([questionId, shuffledIndex]) => {
        const question = exam.questions.find(q => q && q.questionId && q.questionId._id === questionId);
        if (question && question.questionId && question.questionId.shuffleMapping) {
          // Nếu có shuffleMapping, convert shuffled index về original index
          const originalIndex = question.questionId.shuffleMapping[shuffledIndex];
          convertedAnswers[questionId] = originalIndex !== undefined ? originalIndex : shuffledIndex;
          // ✅ NEW: Store shuffle mapping for this question
          shuffleMappings[questionId] = question.questionId.shuffleMapping;
        } else {
          // Nếu không xáo, giữ nguyên
          convertedAnswers[questionId] = shuffledIndex;
        }
      });

      console.log("📤 Converting shuffled answers to original indices...");
      console.log("Original answers:", answers);
      console.log("Converted answers:", convertedAnswers);
      console.log("Shuffle mappings:", shuffleMappings); // ✅ NEW

      // Tính timeSpent: từ duration - timeLeft (convert to seconds)
      const timeSpentSeconds = ((exam.duration || 60) * 60) - timeLeft;

      // ✅ NEW: Lưu thứ tự câu hỏi đã shuffle (để xem lại đúng)
      const questionOrder = exam.questions.map(q => q && q.questionId ? q.questionId._id : null);

      // ✅ NEW: Lưu thứ tự options đã shuffle cho mỗi câu (để xem lại đúng)
      const optionOrder = {};
      exam.questions.forEach((q) => {
        if (q && q.questionId && q.questionId.shuffleMapping) {
          optionOrder[q.questionId._id] = q.questionId.shuffleMapping;
        }
      });

      const submitRes = await fetch(
        `${API_BASE}/test-exams/${examId}/submit`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            answers: convertedAnswers, // ✅ Gửi answers đã convert
            shuffleMappings, // ✅ NEW: Send shuffle mappings for review purposes
            questionOrder, // ✅ NEW: Lưu thứ tự câu đã shuffle
            optionOrder, // ✅ NEW: Lưu thứ tự options đã shuffle
            studentId,
            timeSpent: timeSpentSeconds,
          }),
        }
      );

      if (!submitRes.ok) {
        const result = await submitRes.json();
        throw new Error(result.error || "Lỗi khi nộp bài");
      }

      const result = await submitRes.json();
      setAttemptResult(result);
      setShowResultPage(true);

      // 🧹 Clear localStorage data sau khi nộp bài thành công
      localStorage.removeItem(`test-exam-${examId}-answers`);
      localStorage.removeItem(`test-exam-${examId}-endTime`);
      localStorage.removeItem(`test-exam-${examId}-data`);
      console.log(`✅ Cleaned up localStorage for exam ${examId}`);
    } catch (err) {
      console.error("Error submitting exam:", err);
      await Swal.fire({
        icon: "error",
        title: "Lỗi nộp bài",
        text: err.message || "Đã xảy ra lỗi khi nộp bài",
        confirmButtonText: "Thử lại",
      });
      setIsSubmitted(false);
    }
  };

  const handleQuestionClick = (index) => {
    const targetPage = Math.floor(index / QUESTIONS_PER_PAGE);
    setCurrentPage(targetPage);
    document.getElementById(`question-${index}`)?.scrollIntoView({ behavior: "smooth" });
  };

  const handleNextPage = () => {
    if ((currentPage + 1) * QUESTIONS_PER_PAGE < exam.questions.length) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  if (loading) return <p>Đang tải đề thi...</p>;

  // ✅ VẤN ĐỀ 1A: Nếu đã làm rồi, hiển thị nút "Xem lại"
  if (hasAttempted) {
    return (
      <div className="exam-container" style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "500px", padding: "20px" }}>
        <div style={{
          backgroundColor: "#fff",
          padding: "40px",
          borderRadius: "10px",
          boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
          maxWidth: "500px",
          width: "100%",
          textAlign: "center"
        }}>
          <h1 style={{ color: "#ffc107", marginBottom: "30px", fontSize: "28px" }}>
            ⚠️ Bạn đã làm bài kiểm tra này rồi
          </h1>

          <div style={{
            backgroundColor: "#f8f9fa",
            padding: "30px",
            borderRadius: "8px",
            marginBottom: "30px"
          }}>
            <p style={{ fontSize: "16px", color: "#666", marginBottom: "20px" }}>
              Bạn chỉ được làm bài kiểm tra một lần. Không thể làm lại bài kiểm tra này.
            </p>
            <p style={{ fontSize: "14px", color: "#999" }}>
              Nếu muốn xem chi tiết bài làm, vui lòng click nút "Xem chi tiết" bên dưới.
            </p>
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={() => navigate(`/review/${examId}`)}
              style={{
                flex: 1,
                padding: "12px 30px",
                fontSize: "16px",
                backgroundColor: "#667eea",
                color: "white",
                border: "none",
                borderRadius: "5px",
                cursor: "pointer"
              }}
            >
              📋 Xem chi tiết
            </button>
            
            <button
              onClick={() => navigate("/myTest")}
              style={{
                padding: "12px 30px",
                fontSize: "16px",
                backgroundColor: "#6c757d",
                color: "white",
                border: "none",
                borderRadius: "5px",
                cursor: "pointer"
              }}
            >
              ← Quay lại danh sách
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ✅ VẤN ĐỀ 2A & 2B: Hiển thị kết quả (nếu showResultImmediately = true)
  if (showResultPage && attemptResult) {
    return (
      <div className="exam-container" style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "500px", padding: "20px" }}>
        <div style={{
          backgroundColor: "#fff",
          padding: "40px",
          borderRadius: "10px",
          boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
          maxWidth: "500px",
          width: "100%",
          textAlign: "center"
        }}>
          <h1 style={{ color: "#28a745", marginBottom: "30px", fontSize: "28px" }}>
            ✅ Nộp bài thành công
          </h1>

          <div style={{
            backgroundColor: "#f8f9fa",
            padding: "30px",
            borderRadius: "8px",
            marginBottom: "30px"
          }}>
            {/* Số câu đúng */}
            <div style={{ marginBottom: "25px" }}>
              <p style={{ fontSize: "14px", color: "#666", marginBottom: "10px", fontWeight: "500" }}>Số câu đúng</p>
              <p style={{ fontSize: "36px", fontWeight: "bold", color: "#28a745" }}>
                {attemptResult.correctCount}/{attemptResult.totalQuestions}
              </p>
            </div>

            {/* Điểm số - Hệ 10 */}
            <div style={{ marginBottom: "0" }}>
              <p style={{ fontSize: "14px", color: "#666", marginBottom: "10px", fontWeight: "500" }}>Điểm số</p>
              <p style={{ fontSize: "36px", fontWeight: "bold", color: "#007bff" }}>
                {attemptResult.scoreOut10}/10
              </p>
            </div>
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={() => navigate(`/review/${examId}`)}
              style={{
                flex: 1,
                padding: "12px 20px",
                fontSize: "16px",
                backgroundColor: "#667eea",
                color: "white",
                border: "none",
                borderRadius: "5px",
                cursor: "pointer",
                fontWeight: "bold"
              }}
            >
              📋 Xem chi tiết
            </button>

            <button
              onClick={() => navigate("/myTest")}
              style={{
                flex: 1,
                padding: "12px 20px",
                fontSize: "16px",
                backgroundColor: "#6c757d",
                color: "white",
                border: "none",
                borderRadius: "5px",
                cursor: "pointer",
                fontWeight: "bold"
              }}
            >
              ← Quay lại
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!exam) return <p>Không tìm thấy đề thi!</p>;

  const currentQuestions = exam.questions.slice(
    currentPage * QUESTIONS_PER_PAGE,
    (currentPage + 1) * QUESTIONS_PER_PAGE
  );

  return (
    <div className="exam-container">
      {/* SIDEBAR */}
      <div className="sidebar">
        <h3>Danh sách câu hỏi</h3>
        <div className="question-list">
          {exam.questions.map((q, i) => {
            // ✅ FIX: Kiểm tra q.questionId có tồn tại không
            if (!q || !q.questionId) {
              console.warn(`⚠️ Question ${i} is null or missing questionId`);
              return null;
            }
            const isAnswered = answers[q.questionId._id] !== undefined;
            const isFlagged = flaggedQuestions.includes(q.questionId._id);

            const startIndex = currentPage * QUESTIONS_PER_PAGE;
            const endIndex = startIndex + QUESTIONS_PER_PAGE;
            const isCurrentPage = i >= startIndex && i < endIndex;

            return (
              <div
                key={q._id}
                className={`question-number ${isAnswered ? "answered" : ""} ${isFlagged ? "flagged" : ""} ${isCurrentPage ? "current-page" : ""}`}
                onClick={() => handleQuestionClick(i)}
              >
                {i + 1}
              </div>
            );
          })}
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="main-content">
        <div className="header">
          {/* ✅ Xóa nút "Quay lại" khi đang làm bài - không cho thoát */}
          {/* ✅ ANTI-CHEATING: Hiển thị số cảnh báo */}
          <div style={{ color: warningCount > 0 ? "#dc3545" : "#666", fontWeight: "bold", fontSize: "14px", minWidth: "120px" }}>
            ⚠️ Cảnh báo: {warningCount}/3
          </div>
          <h2 style={{ flex: 1, textAlign: "center", margin: 0 }}>{exam.title}</h2>
          <div className="timer">⏰ {formatTime(timeLeft)}</div>
        </div>

        {currentQuestions
          .filter(q => q && q.questionId) // ✅ FIX: Lọc bỏ các câu hỏi null
          .map((currentQuestion, index) => {
            const question = currentQuestion.questionId;
            // ✅ Tìm globalIndex từ original position (trước khi filter)
            const globalIndex = exam.questions.findIndex(q => q && q.questionId && q._id === currentQuestion._id);

            return (
            <div
              key={question._id}
              className="question-item"
              id={`question-${globalIndex}`}
            >
              <div className="question-item-header">
                <h3>
                  {globalIndex + 1}. {question.title && question.title.includes('<') ? (
                    <div dangerouslySetInnerHTML={{ __html: question.title }} />
                  ) : (
                    question.title
                  )}
                </h3>
                <button
                  className={`flag-btn ${flaggedQuestions.includes(question._id) ? "flagged" : ""}`}
                  onClick={() => toggleFlag(question._id)}
                >
                  🚩
                </button>
              </div>

              {question.imageUrl && (
                <div className="question-image-inline">
                  <img
                    src={`${API_HOST}${question.imageUrl}`}
                    alt="question-image"
                    onError={(e) => {
                      console.warn(`❌ Failed to load image: ${question.imageUrl}`);
                      e.target.style.display = 'none';
                    }}
                  />
                </div>
              )}

              {question.options.map((option, optIndex) => {
                const inputId = `answer-${question._id}-${optIndex}`;
                return (
                  <div key={optIndex} className="option">
                    <input
                      id={inputId}
                      type="radio"
                      name={`question-${question._id}`}
                      checked={answers[question._id] === optIndex}
                      onChange={() => handleAnswerChange(question._id, optIndex)}
                    />
                    <label htmlFor={inputId} style={{ cursor: "pointer", flex: 1 }}>
                      {String.fromCharCode(65 + optIndex)}. {option}
                    </label>
                  </div>
                );
              })}
            </div>
            );
          })}

        <div className="bottom-buttons">
          <button
            onClick={handlePrevPage}
            disabled={currentPage === 0}
            style={{ marginTop: "20px" }}
          >
            ← Trang trước
          </button>
          <button
            onClick={handleNextPage}
            disabled={(currentPage + 1) * QUESTIONS_PER_PAGE >= exam.questions.length}
            style={{ marginTop: "20px" }}
          >
            Trang kế →
          </button>
          <button className="submit-btn" onClick={handleSubmit} style={{ marginTop: "20px" }}>
            Nộp bài
          </button>
        </div>
      </div>

      {/* SUMMARY MODAL */}
      {showSummaryModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Danh sách câu trả lời đã lưu:</h3>
            {exam.questions.map((q, i) => {
              // ✅ FIX: Kiểm tra q.questionId có tồn tại không
              if (!q || !q.questionId) {
                return null;
              }
              return (
                <p key={q._id}>
                  Câu {i + 1} — {answers[q.questionId._id] !== undefined ? "✅ đã trả lời" : "❌ chưa trả lời"}
                </p>
              );
            })}
            <div className="modal-buttons">
              <button onClick={handleGoBack}>Quay lại trang trước</button>
              <button onClick={handleConfirmSubmit}>Nộp bài</button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM MODAL */}
      {showConfirmModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Bạn xác nhận nộp bài?</h3>
            <p style={{ color: "#666", marginBottom: "20px" }}>
              ⚠️ <strong>Lưu ý:</strong> Sau khi nộp, bạn sẽ không thể làm lại bài kiểm tra này
            </p>
            <div className="modal-buttons">
              <button onClick={() => setShowConfirmModal(false)}>Hủy</button>
              <button onClick={() => handleFinalSubmit(false)} style={{ backgroundColor: "#28a745" }}>Xác nhận nộp bài</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TakeTestExamPage;