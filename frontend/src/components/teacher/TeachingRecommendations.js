import React, { useState } from 'react';
import axios from 'axios';
import { API_BASE } from "../../config";

const TeachingRecommendations = ({ examId, examTitle }) => {
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState(null);
  const [error, setError] = useState(null);

  const generateRecommendations = async () => {
    setLoading(true);
    setError(null);
    setRecommendations(null);

    try {
      const response = await axios.post(
        `${API_BASE}/exam-analysis/${examId}/teaching-recommendations`
      );
      setRecommendations(response.data);
    } catch (err) {
      console.error('Error generating recommendations:', err);
      setError(
        err.response?.data?.error ||
        err.response?.data?.message ||
        'Không thể tạo đề xuất giảng dạy'
      );
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">
            Claude AI đang phân tích đề thi và tạo đề xuất giảng dạy...
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Quá trình này có thể mất 10-30 giây
          </p>
        </div>
      </div>
    );
  }

  if (!recommendations) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-2xl font-bold text-gray-800 mb-4">
          Đánh giá chất lượng đề thi & Đề xuất phương pháp giảng dạy
        </h3>
        <p className="text-gray-600 mb-6">
          Sử dụng Claude AI để phân tích chi tiết kết quả bài kiểm tra, đánh giá
          chất lượng đề thi, và đưa ra đề xuất phương pháp giảng dạy phù hợp.
        </p>
        <button
          onClick={generateRecommendations}
          className="px-6 py-3 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
          Tạo đề xuất với Claude AI
        </button>
        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-600">{error}</p>
          </div>
        )}
      </div>
    );
  }

  const { aiAnalysis, statistics, questionData } = recommendations;

  return (
    <div className="space-y-6">
      {/* Statistics Summary */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-2xl font-bold text-gray-800 mb-4">Thống kê tổng quan</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Sinh viên làm bài</p>
            <p className="text-2xl font-bold text-blue-600">{statistics.totalAttempts}</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Điểm trung bình</p>
            <p className="text-2xl font-bold text-green-600">{statistics.averageScore}%</p>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Tỷ lệ đạt</p>
            <p className="text-2xl font-bold text-purple-600">{statistics.passRate}%</p>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Tổng số câu</p>
            <p className="text-2xl font-bold text-orange-600">{statistics.totalQuestions}</p>
          </div>
        </div>
      </div>

      {/* Exam Quality Assessment */}
      {aiAnalysis.examQuality && (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-2xl font-bold text-gray-800">Đánh giá chất lượng đề thi</h3>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Điểm chất lượng:</span>
              <span className={`text-3xl font-bold ${
                aiAnalysis.examQuality.overallScore >= 80 ? 'text-green-600' :
                aiAnalysis.examQuality.overallScore >= 60 ? 'text-yellow-600' :
                'text-red-600'
              }`}>
                {aiAnalysis.examQuality.overallScore}/100
              </span>
            </div>
          </div>

          <p className="text-gray-700 mb-6 leading-relaxed">
            {aiAnalysis.examQuality.assessment}
          </p>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Strengths */}
            <div>
              <h4 className="font-semibold text-green-700 mb-3 flex items-center gap-2">
                {/* <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg> */}
                Điểm mạnh
              </h4>
              <ul className="space-y-2">
                {aiAnalysis.examQuality.strengths.map((strength, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-gray-700">
                    <span className="text-green-600 mt-1">•</span>
                    <span>{strength}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Weaknesses */}
            <div>
              <h4 className="font-semibold text-red-700 mb-3 flex items-center gap-2">
                {/* <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg> */}
                Điểm yếu
              </h4>
              <ul className="space-y-2">
                {aiAnalysis.examQuality.weaknesses.map((weakness, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-gray-700">
                    <span className="text-red-600 mt-1">•</span>
                    <span>{weakness}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h4 className="font-semibold text-blue-900 mb-2">Cân bằng độ khó</h4>
            <p className="text-gray-700">{aiAnalysis.examQuality.difficultyBalance}</p>
          </div>

          {aiAnalysis.examQuality.recommendations && aiAnalysis.examQuality.recommendations.length > 0 && (
            <div className="mt-6">
              <h4 className="font-semibold text-gray-800 mb-3">Đề xuất cải thiện đề thi</h4>
              <ul className="space-y-2">
                {aiAnalysis.examQuality.recommendations.map((rec, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-gray-700">
                    <span className="text-purple-600 mt-1">→</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Teaching Recommendations */}
      {aiAnalysis.teachingRecommendations && (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-2xl font-bold text-gray-800 mb-6">Đề xuất phương pháp giảng dạy</h3>

          {/* Focus Areas */}
          {aiAnalysis.teachingRecommendations.focusAreas && aiAnalysis.teachingRecommendations.focusAreas.length > 0 && (
            <div className="mb-8">
              <h4 className="font-semibold text-lg text-orange-700 mb-4">Chủ đề cần tập trung</h4>
              <div className="space-y-4">
                {aiAnalysis.teachingRecommendations.focusAreas.map((area, idx) => (
                  <div key={idx} className="border-l-4 border-orange-500 pl-4 py-2">
                    <h5 className="font-semibold text-gray-800">{area.topic}</h5>
                    <p className="text-gray-600 mt-1">{area.reason}</p>
                    {area.questionExamples && area.questionExamples.length > 0 && (
                      <div className="mt-2">
                        <p className="text-sm font-medium text-gray-700">Ví dụ câu hỏi:</p>
                        <ul className="mt-1 space-y-1">
                          {area.questionExamples.map((example, i) => (
                            <li key={i} className="text-sm text-gray-600">• {example}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Teaching Methods */}
          {aiAnalysis.teachingRecommendations.teachingMethods && aiAnalysis.teachingRecommendations.teachingMethods.length > 0 && (
            <div className="mb-8">
              <h4 className="font-semibold text-lg text-blue-700 mb-4">Phương pháp giảng dạy đề xuất</h4>
              <div className="space-y-4">
                {aiAnalysis.teachingRecommendations.teachingMethods.map((method, idx) => (
                  <div key={idx} className="bg-blue-50 p-4 rounded-lg">
                    <h5 className="font-semibold text-blue-900">{method.method}</h5>
                    <p className="text-gray-700 mt-2">{method.description}</p>
                    <p className="text-sm text-gray-600 mt-2">
                      <span className="font-medium">Áp dụng cho:</span> {method.targetQuestions}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Next Steps */}
          {aiAnalysis.teachingRecommendations.nextSteps && aiAnalysis.teachingRecommendations.nextSteps.length > 0 && (
            <div>
              <h4 className="font-semibold text-lg text-green-700 mb-4">Các bước tiếp theo</h4>
              <div className="space-y-3">
                {aiAnalysis.teachingRecommendations.nextSteps.map((step, idx) => (
                  <div key={idx} className="flex gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold">
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <h5 className="font-semibold text-gray-800">{step.step}</h5>
                      <p className="text-sm text-gray-600 mt-1">
                        <span className="font-medium">Thời gian:</span> {step.timeline}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        <span className="font-medium">Kết quả mong đợi:</span> {step.expectedOutcome}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Question Insights */}
      {aiAnalysis.questionInsights && (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-2xl font-bold text-gray-800 mb-6">Phân tích chi tiết câu hỏi</h3>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Questions Need Review */}
            {aiAnalysis.questionInsights.needsReview && aiAnalysis.questionInsights.needsReview.length > 0 && (
              <div>
                <h4 className="font-semibold text-lg text-red-700 mb-4">Câu hỏi cần ôn lại</h4>
                <div className="space-y-4">
                  {aiAnalysis.questionInsights.needsReview.map((item, idx) => (
                    <div key={idx} className="border border-red-200 rounded-lg p-3 bg-red-50">
                      <p className="font-medium text-gray-800">{item.question}</p>
                      <p className="text-sm text-red-600 mt-1">Tỷ lệ sai: {item.errorRate}%</p>
                      <p className="text-sm text-gray-700 mt-2">
                        <span className="font-medium">Phân tích:</span> {item.insight}
                      </p>
                      <p className="text-sm text-gray-700 mt-2">
                        <span className="font-medium">Đề xuất:</span> {item.teachingSuggestion}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Well Understood Questions */}
            {aiAnalysis.questionInsights.wellUnderstood && aiAnalysis.questionInsights.wellUnderstood.length > 0 && (
              <div>
                <h4 className="font-semibold text-lg text-green-700 mb-4">Câu hỏi đã nắm vững</h4>
                <div className="space-y-4">
                  {aiAnalysis.questionInsights.wellUnderstood.map((item, idx) => (
                    <div key={idx} className="border border-green-200 rounded-lg p-3 bg-green-50">
                      <p className="font-medium text-gray-800">{item.question}</p>
                      <p className="text-sm text-green-600 mt-1">Tỷ lệ đúng: {item.correctRate}%</p>
                      <p className="text-sm text-gray-700 mt-2">
                        <span className="font-medium">Phân tích:</span> {item.insight}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Regenerate Button */}
      <div className="bg-white p-6 rounded-lg shadow-md text-center">
        <button
          onClick={generateRecommendations}
          disabled={loading}
          className="px-6 py-3 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Tạo lại đề xuất
        </button>
      </div>
    </div>
  );
};

export default TeachingRecommendations;
