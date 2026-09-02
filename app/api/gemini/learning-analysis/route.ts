import { NextResponse } from 'next/server';
import { generateDetailedLearningAnalysis } from '@/lib/gemini';
import { HttpInputError, readJsonWithLimit } from '@/lib/http-security';
import { aiFailure, authorizeTeacherAi, claimTeacherAi } from '../security';

export const runtime = 'nodejs';
// See app/api/gemini/quiz/route.ts - same fix for the same class of failure.
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const access = await authorizeTeacherAi(request);
    if (access.response) return access.response;

    const studentData = await readJsonWithLimit(request, 250_000);

    if (!studentData || typeof studentData !== 'object' || Array.isArray(studentData)) {
      return NextResponse.json({ error: 'Missing studentData' }, { status: 400 });
    }
    const quotaResponse = await claimTeacherAi(access.client!, 'learning_analysis');
    if (quotaResponse) return quotaResponse;

    const analysis = await generateDetailedLearningAnalysis(studentData);

    return NextResponse.json({ analysis });
  } catch (error) {
    if (error instanceof HttpInputError) return NextResponse.json({ error: error.message }, { status: error.status });
    return aiFailure(error);
  }
}
