import { NextResponse } from 'next/server';
import { getServerClient } from '@/app/lib/supabase';
import { isSameOriginRequest } from '@/lib/http-security';

const fail = (error: string, status: number) => NextResponse.json(
  { error },
  { status, headers: { 'Cache-Control': 'private, no-store' } },
);

export async function authorizeTeacherAi(request: Request) {
  if (!isSameOriginRequest(request)) return { response: fail('FORBIDDEN', 403) };
  const client = await getServerClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return { response: fail('UNAUTHORIZED', 401) };
  const profile = await client.from('profiles').select('role').eq('user_id', user.id).maybeSingle();
  if (profile.error) return { response: fail('ACCESS_NOT_READY', 503) };
  if (!['teacher', 'admin'].includes(profile.data?.role || '')) return { response: fail('FORBIDDEN', 403) };
  return { client };
}

export async function claimTeacherAi(
  client: Awaited<ReturnType<typeof getServerClient>>,
  kind: 'quiz' | 'practice' | 'learning_analysis',
) {
  const quota = await client.rpc('claim_teacher_ai_generation', { p_kind: kind });
  if (quota.error || quota.data !== 'OK') {
    const limited = quota.data === 'COOLDOWN' || quota.data === 'DAILY_LIMIT';
    return fail(limited ? quota.data : 'QUOTA_NOT_CONFIGURED', limited ? 429 : 503);
  }
  return null;
}

export function aiFailure(error: unknown) {
  console.error('AI generation failed:', error);
  return fail('AI_FAILED', 502);
}
