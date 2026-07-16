import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import QuestionAnalysis from './QuestionAnalysis';
import TeachingRecommendations from './TeachingRecommendations';
import { API_BASE } from "../../config";

function ExamAnalysisPage() {
  const { examId } = useParams();
  const navigate = useNavigate();
  const [exam, setExam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('questions'); // 'questions' or 'recommendations'

  useEffect(() => {
    fetchExam();
  }, [examId]);

  const fetchExam = async () => {
    try {
      console.log('🔍 Fetching exam with URL:', `${API_BASE}/test-exams/${examId}`);
      const response = await axios.get(`${API_BASE}/test-exams/${examId}`);
      setExam(response.data);
    } catch (err) {
      console.error('Error fetching exam:', err);
      console.error('Failed URL:', `${API_BASE}/test-exams/${examId}`);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Đang tải thông tin đề thi...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white p-6 rounded-lg shadow-md text-center">
            <p className="text-red-600 mb-4">Không tìm thấy đề thi</p>
            <button
              onClick={() => navigate('/teacher/reports')}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Quay lại
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <div className="flex items-center justify-between">
            <div>
              <button
                onClick={() => navigate(-1)}
                className="text-blue-600 hover:text-blue-800 mb-2 flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Quay lại
              </button>
              <h1 className="text-3xl font-bold text-gray-900">{exam.title}</h1>
              <p className="text-gray-600 mt-1">
                Môn: {exam.subject?.name} | Lớp: {exam.class?.className}
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-md mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('questions')}
                className={`px-6 py-4 border-b-2 font-medium text-sm ${
                  activeTab === 'questions'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                📊 Phân tích câu hỏi
              </button>
              <button
                onClick={() => setActiveTab('recommendations')}
                className={`px-6 py-4 border-b-2 font-medium text-sm ${
                  activeTab === 'recommendations'
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                🤖 Đánh giá AI & Đề xuất giảng dạy
              </button>
            </nav>
          </div>
        </div>

        {/* Content */}
        {activeTab === 'questions' && (
          <QuestionAnalysis examId={examId} examTitle={exam.title} />
        )}

        {activeTab === 'recommendations' && (
          <TeachingRecommendations examId={examId} examTitle={exam.title} />
        )}
      </div>
    </div>
  );
}

export default ExamAnalysisPage;
