import { describe, expect, it } from 'vitest';
import { safeRedirectPath } from './safe-redirect';

describe('OAuth callback redirects', () => {
  it.each([
    ['https://attacker.example/phish', '/dashboard'],
    ['//attacker.example/phish', '/dashboard'],
    ['javascript:alert(1)', '/dashboard'],
    ['', '/dashboard'],
    [null, '/dashboard'],
    ['/dashboard?tab=team#members', '/dashboard?tab=team#members'],
    ['/live/ABC123', '/live/ABC123'],
  ])('normalizes %s safely', (input, expected) => {
    expect(safeRedirectPath(input)).toBe(expected);
  });
});
