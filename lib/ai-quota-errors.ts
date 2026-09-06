import type { Language } from '@/app/contexts/LanguageContext';
import { useTranslation } from '@/utils/translations';

/** Error codes an AI-generation route can return once a request has been
 * authenticated and validated - see app/api/gemini/security.ts and
 * app/api/game-covers/generate/route.ts, both backed by
 * scripts/add_teacher_ai_points.sql. */
const AI_QUOTA_ERROR_CODES = ['INSUFFICIENT_POINTS', 'DAILY_LIMIT', 'COOLDOWN'] as const;
type AiQuotaErrorCode = (typeof AI_QUOTA_ERROR_CODES)[number];

function isAiQuotaErrorCode(value: unknown): value is AiQuotaErrorCode {
  return typeof value === 'string' && (AI_QUOTA_ERROR_CODES as readonly string[]).includes(value);
}

const TRANSLATION_KEY: Record<AiQuotaErrorCode, 'ai_points_insufficient' | 'ai_daily_limit' | 'ai_cooldown'> = {
  INSUFFICIENT_POINTS: 'ai_points_insufficient',
  DAILY_LIMIT: 'ai_daily_limit',
  COOLDOWN: 'ai_cooldown',
};

/** Thrown by a call site below instead of a plain Error so its catch block
 * can show this message verbatim rather than a generic "X failed, try
 * again" - see each call site's `error instanceof AiQuotaError` check. */
export class AiQuotaError extends Error {}

/** Reads `{ error: string }` off a failed AI-generation response and, for the
 * three quota codes teachers can actually act on (as opposed to a generic
 * server failure), returns a specific, friendly message instead of the
 * caller's fallback "generation failed, try again". Returns null for any
 * other/unrecognized code so the caller's own generic message still applies. */
export async function describeAiQuotaError(response: Response, language: Language): Promise<string | null> {
  let code: unknown;
  try {
    code = (await response.clone().json())?.error;
  } catch {
    return null;
  }
  if (!isAiQuotaErrorCode(code)) return null;
  const { t } = useTranslation(language);
  return t(TRANSLATION_KEY[code]);
}

/** Convenience for the common "throw on a non-ok response" call sites: throws
 * AiQuotaError with the friendly message when recognized, otherwise a plain
 * Error with `fallbackMessage` so the caller's existing generic catch-block
 * copy still applies unchanged. */
export async function throwForAiQuotaError(response: Response, language: Language, fallbackMessage: string): Promise<never> {
  const friendly = await describeAiQuotaError(response, language);
  throw friendly ? new AiQuotaError(friendly) : new Error(fallbackMessage);
}
