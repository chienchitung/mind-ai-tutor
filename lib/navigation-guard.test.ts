import { expect, it } from 'vitest';
import { isLeavingDocument } from './navigation-guard';

it('does not warn for editor section links but detects route/query changes', () => {
  const current = new URL('https://test.local/lessons');
  expect(isLeavingDocument(current, new URL('https://test.local/lessons#lesson-content'))).toBe(false);
  expect(isLeavingDocument(current, new URL('https://test.local/lessons?page=2'))).toBe(true);
  expect(isLeavingDocument(current, new URL('https://test.local/dashboard'))).toBe(true);
  expect(isLeavingDocument(current, new URL('https://other.local/lessons'))).toBe(true);
});
