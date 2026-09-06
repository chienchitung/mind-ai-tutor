import { describe, expect, it } from 'vitest';
import { AiQuotaError, describeAiQuotaError, throwForAiQuotaError } from './ai-quota-errors';

function response(body: unknown) {
  return new Response(JSON.stringify(body), { status: 402 });
}

describe('describeAiQuotaError', () => {
  it('returns a friendly zh message for a recognized quota code', async () => {
    const message = await describeAiQuotaError(response({ error: 'INSUFFICIENT_POINTS' }), 'zh-TW');
    expect(message).toContain('點數');
  });

  it('returns a friendly en message for a recognized quota code', async () => {
    const message = await describeAiQuotaError(response({ error: 'DAILY_LIMIT' }), 'en');
    expect(message).toContain('limit');
  });

  it('returns null for an unrecognized code, so callers keep their own generic message', async () => {
    expect(await describeAiQuotaError(response({ error: 'AI_FAILED' }), 'zh-TW')).toBeNull();
  });

  it('returns null when the body is not JSON, rather than throwing', async () => {
    expect(await describeAiQuotaError(new Response('not json'), 'zh-TW')).toBeNull();
  });
});

describe('throwForAiQuotaError', () => {
  it('throws AiQuotaError with the friendly message for a recognized code', async () => {
    await expect(throwForAiQuotaError(response({ error: 'COOLDOWN' }), 'zh-TW', 'fallback'))
      .rejects.toBeInstanceOf(AiQuotaError);
  });

  it('throws a plain Error with the fallback message for an unrecognized code', async () => {
    try {
      await throwForAiQuotaError(response({ error: 'AI_FAILED' }), 'zh-TW', 'fallback message');
      expect.unreachable();
    } catch (error) {
      expect(error).not.toBeInstanceOf(AiQuotaError);
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe('fallback message');
    }
  });
});
