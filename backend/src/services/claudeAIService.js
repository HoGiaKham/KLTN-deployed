const Anthropic = require('@anthropic-ai/sdk');

// Debug: Check if API key is loaded
const apiKey = process.env.ANTHROPIC_API_KEY;
console.log('🔑 ANTHROPIC_API_KEY loaded:', apiKey ? `${apiKey.substring(0, 15)}...` : 'NOT FOUND');

if (!apiKey) {
  console.error('❌ ANTHROPIC_API_KEY is not set in environment variables!');
  console.error('   Please check your .env file');
}

const anthropic = new Anthropic({
  apiKey: apiKey,
});

/**
 * Service tạo câu hỏi mới dựa trên câu hỏi mẫu sử dụng Claude AI
 */
class ClaudeAIService {
  /**
   * Tạo câu hỏi mới dựa trên câu hỏi mẫu với độ khó tương tự
   * @param {Array} sampleQuestions - Mảng câu hỏi mẫu
   * @param {Object} options - Tùy chọn tạo câu hỏi
   * @returns {Promise<Array>} - Mảng câu hỏi mới được tạo
   */
  async generateQuestions(sampleQuestions, options = {}) {
    try {
      const {
        numberOfQuestions = sampleQuestions.length,
        subject = 'Chưa xác định',
        categories = [],
      } = options;

      // Tạo prompt cho Claude AI
      const prompt = this.buildPrompt(sampleQuestions, numberOfQuestions, subject, categories);

      // Gọi Claude API
      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 8000,
        temperature: 1,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      // Parse response
      const responseText = message.content[0].text;
      const generatedQuestions = this.parseResponse(responseText, sampleQuestions);

      return generatedQuestions;
    } catch (error) {
      console.error('Error generating questions with Claude AI:', error);
      throw new Error(`Không thể tạo câu hỏi: ${error.message}`);
    }
  }

  /**
   * Xây dựng prompt cho Claude AI
   */
  buildPrompt(sampleQuestions, numberOfQuestions, subject, categories) {
    const categoryNames = categories.map(cat => cat.name).join(', ');

    // Phân tích phân bố độ khó
    const difficultyDistribution = this.analyzeDifficultyDistribution(sampleQuestions);

    const prompt = `Bạn là một chuyên gia giáo dục trong môn ${subject}. Nhiệm vụ của bạn là tạo ${numberOfQuestions} câu hỏi trắc nghiệm MỚI với độ khó tương tự như các câu hỏi mẫu dưới đây.

**YÊU CẦU QUAN TRỌNG:**
1. Tạo câu hỏi HOÀN TOÀN MỚI, KHÔNG được trùng hoặc giống với câu hỏi mẫu
2. Giữ nguyên độ khó và phong cách của câu hỏi mẫu
3. Phân bố độ khó tương tự: ${this.formatDifficultyDistribution(difficultyDistribution)}
4. Mỗi câu hỏi phải có 4 đáp án (A, B, C, D)
5. Chỉ có 1 đáp án đúng duy nhất
6. Câu hỏi phải liên quan đến các chương: ${categoryNames}

**CÁC CÂU HỎI MẪU:**
${this.formatSampleQuestions(sampleQuestions)}

**ĐỊNH DẠNG TRẢ LỜI:**
Trả lời CHÍNH XÁC theo format JSON sau (không thêm text giải thích):

\`\`\`json
[
  {
    "title": "Nội dung câu hỏi",
    "options": ["Đáp án A", "Đáp án B", "Đáp án C", "Đáp án D"],
    "correctAnswer": 0,
    "difficulty": "Dễ",
    "categoryIndex": 0
  }
]
\`\`\`

**LƯU Ý:**
- correctAnswer: là index của đáp án đúng (0 = A, 1 = B, 2 = C, 3 = D)
- difficulty: phải là một trong ["Dễ", "Trung bình", "Khó", "Rất khó"]
- categoryIndex: index của chương trong danh sách [${categoryNames}]
- Trả về ĐÚNG ${numberOfQuestions} câu hỏi

Hãy tạo ${numberOfQuestions} câu hỏi mới ngay bây giờ:`;

    return prompt;
  }

  /**
   * Phân tích phân bố độ khó
   */
  analyzeDifficultyDistribution(questions) {
    const distribution = {
      'Dễ': 0,
      'Trung bình': 0,
      'Khó': 0,
      'Rất khó': 0,
    };

    questions.forEach(q => {
      const difficulty = q.difficulty || 'Trung bình';
      distribution[difficulty] = (distribution[difficulty] || 0) + 1;
    });

    return distribution;
  }

  /**
   * Format phân bố độ khó
   */
  formatDifficultyDistribution(distribution) {
    return Object.entries(distribution)
      .filter(([_, count]) => count > 0)
      .map(([level, count]) => `${level}: ${count} câu`)
      .join(', ');
  }

  /**
   * Format câu hỏi mẫu
   */
  formatSampleQuestions(questions) {
    return questions.map((q, index) => {
      const cleanTitle = this.stripHtml(q.title);
      return `
${index + 1}. **${cleanTitle}** (Độ khó: ${q.difficulty || 'Trung bình'})
   A. ${q.options[0]}
   B. ${q.options[1]}
   C. ${q.options[2]}
   D. ${q.options[3]}
   Đáp án đúng: ${String.fromCharCode(65 + q.correctAnswer)} (${q.options[q.correctAnswer]})
`;
    }).join('\n');
  }

  /**
   * Loại bỏ HTML tags
   */
  stripHtml(html) {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, '').trim();
  }

  /**
   * Parse response từ Claude AI
   */
  parseResponse(responseText, sampleQuestions) {
    try {
      // Tìm JSON trong response
      const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) ||
                       responseText.match(/\[\s*\{[\s\S]*?\}\s*\]/);

      if (!jsonMatch) {
        throw new Error('Không tìm thấy JSON trong response');
      }

      const jsonText = jsonMatch[1] || jsonMatch[0];
      const questions = JSON.parse(jsonText);

      // Validate và chuẩn hóa
      return questions.map(q => {
        if (!q.title || !q.options || q.options.length !== 4) {
          throw new Error('Câu hỏi không hợp lệ: thiếu title hoặc options');
        }

        if (q.correctAnswer < 0 || q.correctAnswer > 3) {
          throw new Error('correctAnswer phải từ 0 đến 3');
        }

        const validDifficulties = ['Dễ', 'Trung bình', 'Khó', 'Rất khó'];
        if (!validDifficulties.includes(q.difficulty)) {
          q.difficulty = 'Trung bình';
        }

        return {
          title: q.title,
          options: q.options,
          correctAnswer: q.correctAnswer,
          difficulty: q.difficulty,
          categoryIndex: q.categoryIndex || 0,
        };
      });
    } catch (error) {
      console.error('Error parsing Claude response:', error);
      console.log('Response text:', responseText);
      throw new Error(`Không thể parse response: ${error.message}`);
    }
  }

  /**
   * Phân tích chất lượng đề thi và đề xuất phương pháp giảng dạy
   * @param {String} prompt - Prompt phân tích
   * @returns {Promise<Object>} - Kết quả phân tích từ Claude AI
   */
  async analyzeExamQuality(prompt) {
    try {
      console.log('   📤 Sending request to Claude AI...');

      // Gọi Claude API
      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 8000,
        temperature: 0.7,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      // Parse response
      const responseText = message.content[0].text;
      console.log('   📥 Received response from Claude AI');

      // Tìm JSON trong response (có thể có hoặc không có markdown code block)
      let jsonText = responseText.trim();

      // Loại bỏ markdown code block nếu có
      const jsonMatch = jsonText.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonText = jsonMatch[1];
      } else {
        // Tìm object JSON thuần
        const objectMatch = jsonText.match(/\{[\s\S]*\}/);
        if (objectMatch) {
          jsonText = objectMatch[0];
        }
      }

      const analysis = JSON.parse(jsonText);

      return analysis;
    } catch (error) {
      console.error('❌ Error analyzing exam quality with Claude AI:', error);
      console.error('   Error details:', error.message);
      throw new Error(`Không thể phân tích chất lượng đề thi: ${error.message}`);
    }
  }
}

module.exports = new ClaudeAIService();
