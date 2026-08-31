import { NextResponse } from 'next/server';
import { generateDetailedLearningAnalysis } from '@/lib/gemini';

export const runtime = 'nodejs';
// See app/api/gemini/quiz/route.ts - same fix for the same class of failure.
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const studentData = await request.json();

    if (!studentData || typeof studentData !== 'object') {
      return NextResponse.json({ error: 'Missing studentData' }, { status: 400 });
    }

    const analysis = await generateDetailedLearningAnalysis(studentData);

    return NextResponse.json({ analysis });
  } catch (error) {
    console.error('Error in /api/gemini/learning-analysis:', error);
    return NextResponse.json(
      { error: 'Failed to generate learning analysis' },
      { status: 500 }
    );
  }
}
