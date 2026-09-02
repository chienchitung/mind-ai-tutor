import { NextResponse } from 'next/server';
import { generateQuiz } from '@/lib/gemini';
import { getServerClient } from '@/app/lib/supabase';

export const runtime = 'nodejs';
// Without this, Vercel applies its own default ceiling (10s on Hobby) well
// below what quiz generation actually takes, killing the request with an
// opaque 504 instead of letting our own error handling respond.
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    // Without this, anyone with the site URL could call this route and burn
    // the shared Gemini quota/budget without ever logging in.
    const client = await getServerClient();
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
