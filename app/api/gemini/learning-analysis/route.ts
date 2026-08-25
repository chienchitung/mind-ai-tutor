import { NextResponse } from 'next/server';
import { generateDetailedLearningAnalysis } from '@/lib/gemini';

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
