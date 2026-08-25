import { NextResponse } from 'next/server';
import { generateQuiz } from '@/lib/gemini';

export async function POST(request: Request) {
  try {
    const {
      content,
      questionType,
      numQuestions,
      additionalInstructions,
      outputLanguage,
      level,
    } = await request.json();

    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: 'Missing content' }, { status: 400 });
    }

    const quiz = await generateQuiz(
      content,
      questionType,
      numQuestions,
      additionalInstructions,
      outputLanguage,
      level
    );

    return NextResponse.json(quiz);
  } catch (error) {
    console.error('Error in /api/gemini/quiz:', error);
    return NextResponse.json({ error: 'Failed to generate quiz' }, { status: 500 });
  }
}
