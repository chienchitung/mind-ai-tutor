import { describe, expect, it } from 'vitest';
import { usesAppShell } from './app-shell';

describe('usesAppShell', () => {
  it.each([
    '/dashboard',
    '/students',
    '/students/student-id',
    '/lessons/lesson-id/edit',
    '/live/new',
    '/live/sessions',
  ])('keeps the admin shell for %s', (pathname) => {
    expect(usesAppShell(pathname)).toBe(true);
  });

  it.each([
    '/',
    '/login',
    '/signup',
    '/live',
    '/live/123456',
    '/live/session-id/present',
    '/live/session-id/present/display',
    '/quiz/quiz-id',
  ])('leaves public and presentation routes unwrapped for %s', (pathname) => {
    expect(usesAppShell(pathname)).toBe(false);
  });
});
