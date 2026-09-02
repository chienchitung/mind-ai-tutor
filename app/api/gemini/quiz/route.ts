import { NextResponse } from 'next/server';
import { generateQuiz } from '@/lib/gemini';
import { HttpInputError, readJsonWithLimit } from '@/lib/http-security';
import { aiFailure, authorizeTeacherAi, claimTeacherAi } from '../security';

export const runtime = 'nodejs';
// Without this, Vercel applies its own default ceiling (10s on Hobby) well
// below what quiz generation actually takes, killing the request with an
// opaque 504 instead of letting our own error handling respond.
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const access = await authorizeTeacherAi(request);
    if (access.response) return access.response;

    const {
      content,
      questionType,
      numQuestions,
      additionalInstructions,
      outputLanguage,
      level,
    } = await readJsonWithLimit(request, 200_000) as Record<string, unknown>;

    const normalizedCount = typeof numQuestions === 'string' || typeof numQuestions === 'number'
      ? Number(numQuestions)
      : Number.NaN;
    if (!content || typeof content !== 'string' || content.length > 100_000 ||
      !Number.isInteger(normalizedCount) || normalizedCount < 1 || normalizedCount > 50 ||
      [questionType, additionalInstructions, outputLanguage, level].some(value =>
        value !== undefined && (typeof value !== 'string' || value.length > 5_000))) {
      return NextResponse.json({ error: 'Missing content' }, { status: 400 });
    }
    const quotaResponse = await claimTeacherAi(access.client!, 'quiz');
    if (quotaResponse) return quotaResponse;

    const quiz = await generateQuiz(
      content,
      questionType as string | undefined,
      String(normalizedCount),
      additionalInstructions as string | undefined,
      outputLanguage as string | undefined,
      level as string | undefined
    );

    return NextResponse.json(quiz);
  } catch (error) {
    if (error instanceof HttpInputError) return NextResponse.json({ error: error.message }, { status: error.status });
    return aiFailure(error);
  }
}
