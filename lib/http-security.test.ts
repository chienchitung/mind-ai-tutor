import { describe, expect, it } from 'vitest';
import { isSameOriginRequest, readJsonWithLimit } from './http-security';

describe('HTTP request security helpers', () => {
  it('requires an exact same origin', () => {
    expect(isSameOriginRequest(new Request('https://app.test/api', { headers: { origin: 'https://app.test' } }))).toBe(true);
    expect(isSameOriginRequest(new Request('https://app.test/api', { headers: { origin: 'https://evil.test' } }))).toBe(false);
    expect(isSameOriginRequest(new Request('https://app.test/api'))).toBe(false);
  });

  it('parses bounded JSON and rejects declared or streamed excess', async () => {
    await expect(readJsonWithLimit(new Request('https://app.test', { method: 'POST', body: '{"ok":true}' }), 20)).resolves.toEqual({ ok: true });
    await expect(readJsonWithLimit(new Request('https://app.test', {
      method: 'POST', headers: { 'content-length': '21' }, body: '{}',
    }), 20)).rejects.toMatchObject({ status: 413 });
    await expect(readJsonWithLimit(new Request('https://app.test', {
      method: 'POST', body: JSON.stringify({ value: 'x'.repeat(30) }),
    }), 20)).rejects.toMatchObject({ status: 413 });
  });
});
