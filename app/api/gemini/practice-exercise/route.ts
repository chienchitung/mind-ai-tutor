import { NextResponse } from 'next/server';
import { generatePracticeExercise } from '@/lib/gemini';

export const runtime = 'nodejs';
// See app/api/gemini/quiz/route.ts - same fix for the same class of failure.
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const { content, level } = await request.json();

    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: 'Missing content' }, { status: 400 });
    }

    const exercise = await generatePracticeExercise(content, level);

    return NextResponse.json(exercise);
  } catch (error) {
    console.error('Error in /api/gemini/practice-exercise:', error);
    return NextResponse.json(
      { error: 'Failed to generate practice exercise' },
      { status: 500 }
    );
  }
}
