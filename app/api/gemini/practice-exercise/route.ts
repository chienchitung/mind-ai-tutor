import { NextResponse } from 'next/server';
import { generatePracticeExercise } from '@/lib/gemini';
import { HttpInputError, readJsonWithLimit } from '@/lib/http-security';
import { aiFailure, authorizeTeacherAi, claimTeacherAi } from '../security';

export const runtime = 'nodejs';
// See app/api/gemini/quiz/route.ts - same fix for the same class of failure.
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const access = await authorizeTeacherAi(request);
    if (access.response) return access.response;

    const { content, level } = await readJsonWithLimit(request, 150_000) as Record<string, unknown>;

    if (!content || typeof content !== 'string' || content.length > 100_000 ||
      (level !== undefined && (typeof level !== 'string' || level.length > 200))) {
      return NextResponse.json({ error: 'Missing content' }, { status: 400 });
    }
    const quotaResponse = await claimTeacherAi(access.client!, 'practice');
    if (quotaResponse) return quotaResponse;

    const exercise = await generatePracticeExercise(content, level as string | undefined);

    return NextResponse.json(exercise);
  } catch (error) {
    if (error instanceof HttpInputError) return NextResponse.json({ error: error.message }, { status: error.status });
    return aiFailure(error);
  }
}
