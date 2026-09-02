import { NextResponse } from 'next/server';
import { generateDetailedLearningAnalysis } from '@/lib/gemini';
import { getServerClient } from '@/app/lib/supabase';

export const runtime = 'nodejs';
// See app/api/gemini/quiz/route.ts - same fix for the same class of failure.
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    // Without this, anyone with the site URL could call this route and burn
    // the shared Gemini quota/budget without ever logging in.
    const client = await getServerClient();
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
