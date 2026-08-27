import 'server-only';
import { GoogleGenAI } from '@google/genai';

// Server-only: this module must never be imported from a 'use client' component,
// since GEMINI_API_KEY would otherwise be bundled into the browser JS.
const apiKey = process.env.GEMINI_API_KEY;
const model = process.env.GEMINI_MODEL || 'gemini-3.7-flash';

if (!apiKey) {
  console.error('Missing Gemini API key. Please check your .env.local file.');
}

const genAI = new GoogleGenAI({ apiKey: apiKey as string });

export async function generatePracticeExercise(teachingContent: string, level: string = 'Beginner') {
  try {
    // Detect if the content is Chinese
    const isChineseContent = /[一-鿿]/.test(teachingContent);

    const prompt = `
      Based on the following teaching content, generate a practice exercise with a question, its answer, and a detailed explanation.
      The difficulty level should be "${level}".
      ${isChineseContent ? '請使用繁體中文回答。' : 'Please respond in English.'}

      Teaching Content:
      ${teachingContent}

      Difficulty Level: ${level}
      ${level === 'Beginner' ? '(Focus on basic concepts and straightforward applications)' :
        level === 'Intermediate' ? '(Include more complex scenarios and multiple steps)' :
        '(Create challenging problems requiring deep understanding and analysis)'}

      Please format your response as a JSON object with three fields:
      {
        "question": "${isChineseContent ? '練習題目' : 'The practice question'}",
        "answer": "${isChineseContent ? '答案（只需寫出答案，不要包含解釋）' : 'The answer (only the result, no explanation)'}",
        "explanation": "${isChineseContent ? '詳細的解題步驟與說明' : 'Detailed solution steps and explanation'}"
      }

      Important:
      1. The response must be a valid JSON object
      2. The answer field should ONLY contain the final answer without any explanation
      3. All explanations and solution steps should be in the explanation field
      4. ${isChineseContent ? '請確保回答使用繁體中文' : 'Ensure the response is in English'}
      5. Ensure the question difficulty matches the specified level: ${level}
    `;

    const result = await genAI.models.generateContent({ model, contents: prompt });
    const text = result.text ?? '';

    try {
      // Try to find JSON-like content in the response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsedJson = JSON.parse(jsonMatch[0]);
        return {
          question: parsedJson.question || '',
          answer: parsedJson.answer || '',
          explanation: parsedJson.explanation || ''
        };
      }

      // If no JSON found, try to split by markers
      const lines = text.split('\n');
      const questionIndex = lines.findIndex(line =>
        line.toLowerCase().includes('question:') || line.toLowerCase().includes('"question"')
      );
      const answerIndex = lines.findIndex(line =>
        line.toLowerCase().includes('answer:') || line.toLowerCase().includes('"answer"')
      );
      const explanationIndex = lines.findIndex(line =>
        line.toLowerCase().includes('explanation:') || line.toLowerCase().includes('"explanation"')
      );

      if (questionIndex !== -1 && answerIndex !== -1) {
        const nextSection = explanationIndex !== -1 ? explanationIndex : lines.length;
        return {
          question: lines.slice(questionIndex + 1, answerIndex).join('\n').trim().replace(/^["']|["']$/g, ''),
          answer: lines.slice(answerIndex + 1, explanationIndex !== -1 ? explanationIndex : undefined)
            .join('\n').trim().replace(/^["']|["']$/g, ''),
          explanation: explanationIndex !== -1
            ? lines.slice(explanationIndex + 1).join('\n').trim().replace(/^["']|["']$/g, '')
            : ''
        };
      }

      // Fallback: return first line as question, second as answer, rest as explanation
      return {
        question: lines[0].trim(),
        answer: lines[1]?.trim() || '',
        explanation: lines.slice(2).join('\n').trim()
      };
    } catch (error) {
      console.error('Error parsing generated content:', error);
      throw new Error('Failed to parse practice exercise content');
    }
  } catch (error) {
    console.error('Error generating practice exercise:', error);
    throw error;
  }
}

export async function generateLearningAnalysis(studentData: any) {
  try {
    const prompt = `
      I'm a teacher looking to understand my student's learning patterns and performance.
      Below is the learning record data for this student:

      ${JSON.stringify(studentData, null, 2)}

      Please provide:
      1. A concise summary of the student's learning activity
      2. Key insights about their learning patterns (e.g., study time distribution, completion rates)
      3. Strengths and areas for improvement based on the data
      4. Personalized recommendations to enhance their learning outcomes

      Please limit your response to 5-7 sentences total and focus on actionable insights.
    `;

    const result = await genAI.models.generateContent({ model, contents: prompt });
    return result.text ?? '';
  } catch (error) {
    console.error('Error generating learning analysis:', error);
    throw error;
  }
}

export async function generateDetailedLearningAnalysis(studentData: any) {
  try {
    // Check the UI language setting passed from the component
    const isChineseContent = studentData.language === 'zh-TW';

    const prompt = `
      I'm an AI tutor assistant analyzing a student's learning data. This is the data for student "${studentData.studentName}":

      ${JSON.stringify(studentData, null, 2)}

      Please provide a comprehensive analysis of this student's learning patterns with the following sections:
      1. Overall Learning Summary: A brief overview of the student's learning activities
      2. Time Management Analysis: How the student distributes their learning time
      3. Subject/Category Focus: Analysis of which areas they spend most time on
      4. Learning Pattern Insights: Notable patterns in how they approach learning
      5. Strengths: What the student is doing well based on the data
      6. Improvement Areas: Specific areas where the student could improve
      7. Personalized Recommendations: 3-4 actionable suggestions for improving learning outcomes

      ${isChineseContent ? '請使用繁體中文回答。' : 'Please respond in English.'}

      Format your response in clear paragraphs with section headings.
    `;

    const result = await genAI.models.generateContent({
      model,
      contents: prompt,
      config: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192,
      },
    });
    return result.text ?? '';
  } catch (error: any) {
    console.error('Error generating detailed learning analysis:', error);
    // Add more specific error handling
    if (error.message?.includes('404')) {
      throw new Error('Model not found or not available. Please check if you have access to this Gemini model.');
    }
    throw error;
  }
}

export async function generateQuiz(
  inputContent: string,
  questionType: string = 'multiple-choice',
  numQuestions: string = '10',
  additionalInstructions: string = '',
  outputLanguage: string = 'English',
  level: string = 'intermediate'
) {
  try {
    const isChineseOutput = outputLanguage === '繁體中文';
    const allowMultiple = /複選|多個正確答案|multiple answers|multiple correct/i.test(additionalInstructions);
    const prompt = `
      Generate a quiz on the following topic or content:
      ${inputContent}

      Quiz settings:
      - Question type: ${questionType}
      - Number of questions: ${numQuestions}
      ${additionalInstructions ? `- Additional instructions: ${additionalInstructions}` : ''}
      - Output language: ${outputLanguage}
      - Difficulty level: ${level}

      ${isChineseOutput ? '請使用繁體中文回答。' : 'Please respond in English.'}

      Create a quiz with exactly ${numQuestions} ${questionType} questions.

      ${questionType === 'multiple-choice'
        ? (allowMultiple
            ? (isChineseOutput
                ? '部分題目請設計為複選題（多個正確答案），其 correctAnswer 欄位請用陣列表示，並加上 questionType 欄位（single 或 multiple）。其餘為單選題（correctAnswer 為字串，questionType 為 single）。每題選項 4 個（A, B, C, D）。'
                : 'For some questions, design as multiple-answer (multiple correct options, correctAnswer as an array, questionType as "multiple"). Others are single-answer (correctAnswer as string, questionType as "single"). Each question has 4 options (A, B, C, D).')
            : (isChineseOutput
                ? '每題僅有一個正確答案（correctAnswer 為字串，questionType 為 single），選項 4 個（A, B, C, D）。'
                : 'Each question has only one correct answer (correctAnswer as string, questionType as "single"), 4 options (A, B, C, D).'))
        : questionType === 'true-false'
          ? (isChineseOutput
              ? '是非題僅有 A（正確）與 B（錯誤）兩個選項。'
              : 'For true/false questions, provide options A (True) and B (False).')
          : (isChineseOutput
              ? '簡答題 options 可為空陣列。'
              : 'For short answer questions, the options array can be empty.')}

      For each question, include a brief explanation of the correct answer.

      Format your response as a valid JSON object with the following structure:
      {
        "title": "${isChineseOutput ? '測驗標題' : 'Quiz title based on the topic'}",
        "questions": [
          {
            "id": "1",
            "questionText": "${isChineseOutput ? '問題文字' : 'Question text'}",
            "options": [
              {"id": "a", "text": "${isChineseOutput ? '選項A' : 'Option A'}"},
              {"id": "b", "text": "${isChineseOutput ? '選項B' : 'Option B'}"},
              {"id": "c", "text": "${isChineseOutput ? '選項C' : 'Option C'}"},
              {"id": "d", "text": "${isChineseOutput ? '選項D' : 'Option D'}"}
            ],
            "questionType": "single 或 multiple", // 題型
            "correctAnswer": "正確答案 id 或 id 陣列", // 單選為字串，複選為陣列
            "explanation": "${isChineseOutput ? '答案解釋' : 'Explanation of answer'}"
          }
          // ... more questions
        ]
      }

      Important:
      1. The response must be a valid JSON object
      2. For true/false questions, only include options A and B
      3. For short answer questions, the options array can be empty
      4. All questions must have an explanation field
      5. For multiple-choice, correctAnswer can be a string (single) or array (multiple), and must include questionType field for each question
    `;

    const result = await genAI.models.generateContent({ model, contents: prompt });
    const text = result.text ?? '';

    try {
      // Try to parse the entire response as JSON
      try {
        const parsedJson = JSON.parse(text);
        return parsedJson;
      } catch (e) {
        // If that fails, try to find JSON-like content in the response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsedJson = JSON.parse(jsonMatch[0]);
          return parsedJson;
        }
      }

      // If all JSON parsing attempts fail, return an error object
      throw new Error('Failed to parse quiz content as JSON');
    } catch (error) {
      console.error('Error parsing generated quiz content:', error);
      throw new Error('Failed to generate quiz. Please try again.');
    }
  } catch (error) {
    console.error('Error generating quiz:', error);
    throw error;
  }
}
