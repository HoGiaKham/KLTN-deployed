import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE } from "../../config";

const QuestionAnalysis = ({ examId, examTitle }) => {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('wrong'); // 'wrong' or 'correct'

  useEffect(() => {
    if (examId) {
      fetchAnalysis();
    }
  }, [examId]);

  const fetchAnalysis = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${API_BASE}/exam-analysis/${examId}/question-analysis`);
      setAnalysis(response.data);
    } catch (err) {
      console.error('Error fetching question analysis:', err);
      setError(err.response?.data?.error || 'Không thể tải phân tích câu hỏi');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Đang phân tích câu hỏi...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">{error}</p>
          <button
            onClick={fetchAnalysis}
            className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  if (!analysis || analysis.totalAttempts === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <p className="text-gray-500 text-center py-8">
          Chưa có sinh viên nào làm bài. Không thể phân tích.
        </p>
      </div>
    );
  }

  const { mostWrong, mostCorrect, totalAttempts, totalQuestions } = analysis;

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h3 className="text-2xl font-bold text-gray-800 mb-4">
        Phân tích câu hỏi - {examTitle || analysis.examTitle}
      </h3>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg">
          <p className="text-sm text-gray-600">Tổng số câu hỏi</p>
          <p className="text-2xl font-bold text-blue-600">{totalQuestions}</p>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <p className="text-sm text-gray-600">Sinh viên làm bài</p>
          <p className="text-2xl font-bold text-green-600">{totalAttempts}</p>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg">
          <p className="text-sm text-gray-600">Phân tích chi tiết</p>
          <p className="text-2xl font-bold text-purple-600">
            {mostWrong.length + mostCorrect.length}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex -mb-px">
          <button
            onClick={() => setActiveTab('wrong')}
            className={`mr-8 py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'wrong'
                ? 'border-red-500 text-red-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Câu hỏi hay sai nhất ({mostWrong.length})
          </button>
          <button
            onClick={() => setActiveTab('correct')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'correct'
                ? 'border-green-500 text-green-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Câu hỏi hay đúng nhất ({mostCorrect.length})
          </button>
        </nav>
      </div>

      {/* Content */}
      {activeTab === 'wrong' && (
        <div className="space-y-4">
          <h4 className="text-lg font-semibold text-red-600 mb-3">
            Top {mostWrong.length} câu hỏi sinh viên hay sai nhất
          </h4>
          {mostWrong.map((q, idx) => (
            <div
              key={q.questionId}
              className="border border-red-200 rounded-lg p-4 bg-red-50"
            >
              <div className="flex justify-between items-start mb-2">
                <h5 className="font-semibold text-gray-800 flex-1">
                  #{idx + 1}. {q.title}
                </h5>
                <span className="ml-4 px-3 py-1 bg-red-600 text-white text-sm font-bold rounded">
                  Sai: {q.errorRate}%
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 text-sm">
                <div>
                  <p className="text-gray-600">Độ khó</p>
                  <p className="font-semibold">{q.difficulty}</p>
                </div>
                <div>
                  <p className="text-gray-600">Trả lời đúng</p>
                  <p className="font-semibold text-green-600">
                    {q.correctCount}/{totalAttempts}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Trả lời sai</p>
                  <p className="font-semibold text-red-600">
                    {q.wrongCount}/{totalAttempts}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Không trả lời</p>
                  <p className="font-semibold text-gray-600">
                    {q.noAnswerCount}/{totalAttempts}
                  </p>
                </div>
              </div>
              <div className="mt-3 w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className="bg-red-600 h-2.5 rounded-full"
                  style={{ width: `${q.errorRate}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'correct' && (
        <div className="space-y-4">
          <h4 className="text-lg font-semibold text-green-600 mb-3">
            Top {mostCorrect.length} câu hỏi sinh viên hay đúng nhất
          </h4>
          {mostCorrect.map((q, idx) => (
            <div
              key={q.questionId}
              className="border border-green-200 rounded-lg p-4 bg-green-50"
            >
              <div className="flex justify-between items-start mb-2">
                <h5 className="font-semibold text-gray-800 flex-1">
                  #{idx + 1}. {q.title}
                </h5>
                <span className="ml-4 px-3 py-1 bg-green-600 text-white text-sm font-bold rounded">
                  Đúng: {q.correctRate}%
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 text-sm">
                <div>
                  <p className="text-gray-600">Độ khó</p>
                  <p className="font-semibold">{q.difficulty}</p>
                </div>
                <div>
                  <p className="text-gray-600">Trả lời đúng</p>
                  <p className="font-semibold text-green-600">
                    {q.correctCount}/{totalAttempts}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Trả lời sai</p>
                  <p className="font-semibold text-red-600">
                    {q.wrongCount}/{totalAttempts}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Không trả lời</p>
                  <p className="font-semibold text-gray-600">
                    {q.noAnswerCount}/{totalAttempts}
                  </p>
                </div>
              </div>
              <div className="mt-3 w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className="bg-green-600 h-2.5 rounded-full"
                  style={{ width: `${q.correctRate}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default QuestionAnalysis;
