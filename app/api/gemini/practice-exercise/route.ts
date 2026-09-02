import { NextResponse } from 'next/server';
import { generatePracticeExercise } from '@/lib/gemini';
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
