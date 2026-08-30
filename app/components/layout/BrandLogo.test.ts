import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('preserves every original brand path from pre-redesign commit 9dbc292', () => {
  const source = readFileSync(new URL('./BrandLogo.tsx', import.meta.url), 'utf8');
  const paths = Array.from(source.matchAll(/<path d="([^"]*)"/g)).map(match => match[1]);
  expect(paths).toHaveLength(17);
  expect(createHash('sha256').update(JSON.stringify(paths)).digest('hex'))
    .toBe('01a3a279ee73d6f2274943719f6430bf7003236697bb33018ed548f028228e3e');
  expect(source).toContain('aria-label="MindAiTutor"');
});
