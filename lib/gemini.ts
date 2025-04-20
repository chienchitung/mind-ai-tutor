import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize the Generative AI API
const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
const model = process.env.NEXT_PUBLIC_GEMINI_MODEL || 'gemini-2.0-flash';

if (!apiKey) {
  console.error('Missing Gemini API key. Please check your .env.local file.');
}

const genAI = new GoogleGenerativeAI(apiKey as string);

export async function generatePracticeExercise(teachingContent: string, level: string = 'Beginner') {
  try {
    const generativeModel = genAI.getGenerativeModel({ model });
    
    // Detect if the content is Chinese
    const isChineseContent = /[\u4e00-\u9fff]/.test(teachingContent);

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

    const result = await generativeModel.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
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
    const generativeModel = genAI.getGenerativeModel({ model });

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

    const result = await generativeModel.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Error generating learning analysis:', error);
    throw error;
  }
}

export async function generateDetailedLearningAnalysis(studentData: any) {
  try {
    // Use the specific model requested - update to a valid model name
    const specificModel = 'gemini-2.0-flash';
    const generativeModel = genAI.getGenerativeModel({ model: specificModel });

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

    const result = await generativeModel.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Error generating detailed learning analysis:', error);
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
    const generativeModel = genAI.getGenerativeModel({ model });
    
    const isChineseOutput = outputLanguage === '繁體中文';
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
        ? 'For multiple choice questions, provide 4 options (labeled A, B, C, D) with one correct answer.' 
        : questionType === 'true-false' 
          ? 'For true/false questions, provide options A (True) and B (False).' 
          : 'For short answer questions, provide the expected answer.'}

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
            "correctAnswer": "${isChineseOutput ? '正確答案 (a, b, c, 或 d)' : 'Correct answer (a, b, c, or d)'}",
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
      5. For multiple-choice and true/false, the correctAnswer field should be the ID of the correct option (a, b, c, d)
    `;

    const result = await generativeModel.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
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