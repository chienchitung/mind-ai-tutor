import { NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL } from '@/app/lib/supabase';

export const runtime = 'nodejs';

const EVENT_TYPES = [
  'enrolled_in_course',
  'lecture_completed',
  'module_completed',
  'course_completed',
] as const;
type EventType = (typeof EVENT_TYPES)[number];

const MAX_BODY_BYTES = 262_144; // 256KB - systeme.io payloads are small JSON, this is a generous cap

// SUPABASE_SERVICE_ROLE_KEY bypasses RLS - required here because a single
// delivery must be looked up by webhook_token across every teacher's
// integration row, which an RLS-scoped (per-user) client can never do.
// Never expose this key to the client.
function getAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return null;
  return createClient(SUPABASE_URL, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

// systeme.io signs deliveries with `x-systeme-signature: sha256=<hex hmac>`
// (some senders omit the "sha256=" prefix) computed over the exact raw
// request body - so the body must be verified as raw bytes before any
// JSON.parse/re-stringify, which could produce a different byte sequence
// than what was actually signed.
function verifySignature(rawBody: string, secret: string, header: string | null): boolean {
  if (!header) return false;
  const provided = header.trim().replace(/^sha256=/i, '');
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(provided, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function pickString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function extractEmail(payload: any): string | null {
  const email = pickString(
    payload?.email,
    payload?.contact?.email,
    payload?.data?.email,
    payload?.data?.contact?.email,
    payload?.customer?.email
  );
  return email ? email.toLowerCase() : null;
}

function extractCourse(payload: any): { id: string | null; name: string | null } {
  const course = payload?.course ?? payload?.data?.course ?? {};
  return {
    id: pickString(course?.id, payload?.course_id, payload?.data?.course_id),
    name: pickString(course?.name, course?.title, payload?.course_name, payload?.data?.course_name),
  };
}

function toTimestamp(value: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  // The event type comes from the URL's `event` query param (one systeme.io
  // Workflow per trigger, each configured with its own `?event=...` URL)
  // instead of being parsed out of the payload body. systeme.io's public
  // docs for the exact Workflow "Send Webhook" JSON shape weren't reachable
  // while building this, so this sidesteps guessing at a field name -
  // the full raw_payload is still stored for every event either way.
  const eventType = new URL(request.url).searchParams.get('event');
  if (!eventType || !(EVENT_TYPES as readonly string[]).includes(eventType)) {
    return NextResponse.json({ error: 'UNKNOWN_EVENT_TYPE' }, { status: 400 });
  }

  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: 'SERVICE_ROLE_NOT_CONFIGURED' }, { status: 500 });
  }

  const { data: integration } = await admin
    .from('systeme_integrations')
    .select('user_id, webhook_secret')
    .eq('webhook_token', token)
    .maybeSingle();

  if (!integration) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (declaredLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'PAYLOAD_TOO_LARGE' }, { status: 413 });
  }

  const rawBody = await request.text();
  if (rawBody.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'PAYLOAD_TOO_LARGE' }, { status: 413 });
  }

  const signature = request.headers.get('x-systeme-signature');
  if (!verifySignature(rawBody, integration.webhook_secret, signature)) {
    return NextResponse.json({ error: 'INVALID_SIGNATURE' }, { status: 401 });
  }

  let payload: any;
  try {
    payload = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
  }

  const contactEmail = extractEmail(payload);
  const course = extractCourse(payload);
  const occurredAt = toTimestamp(
    pickString(payload?.occurred_at, payload?.created_at, payload?.data?.occurred_at)
  );

  let studentId: string | null = null;
  if (contactEmail) {
    const { data: student } = await admin
      .from('students')
      .select('id')
      .eq('user_id', integration.user_id)
      .ilike('email', contactEmail)
      .maybeSingle();
    studentId = student?.id ?? null;
  }

  const { error: insertError } = await admin.from('systeme_course_events').insert({
    user_id: integration.user_id,
    student_id: studentId,
    contact_email: contactEmail,
    course_id: course.id,
    course_name: course.name,
    event_type: eventType,
    event_occurred_at: occurredAt,
    raw_payload: payload,
  });

  if (insertError) {
    console.error('Failed to store systeme.io webhook event:', insertError);
    return NextResponse.json({ error: 'STORAGE_FAILED' }, { status: 500 });
  }

  return NextResponse.json({ status: 'ok' });
}
