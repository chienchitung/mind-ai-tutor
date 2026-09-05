import { describe, it, expect } from 'vitest';
import { normalizeMission, missionObjective, canEnterLesson, gameThemeStyle, gameBrandKind, gameVisualTemplate } from '../game-engine/src/lib/mission';
import { normalizeLessonOverrides, serializeLessonOverrides } from './game-lesson-settings';
import type { Lesson } from '../game-engine/src/types/lesson';

const lessons: Lesson[] = [
  { lesson_id: 'intro', number: 0, title: '前導課程', description: '原始摘要', content: '原始教材', role: 'intro' },
  { lesson_id: 'sum', number: 1, title: '基礎函數入門', description: '函數摘要', content: 'SUM 教材', role: 'standard' },
  { lesson_id: 'final', number: 2, title: '綜合挑戰', description: '', content: '原始題目', role: 'final' },
];

describe('optional mission presentation', () => {
  it.each([undefined, null, '', [], 123, { scenario: '  ', objective: false }])('treats absent or malformed mission %j as quick mode', value => {
    expect(normalizeMission(value)).toBeUndefined();
  });
  it('trims and bounds public text, only accepts display fields', () => {
    expect(normalizeMission({ scenario: '  任務\n情境  ', objective: 'a'.repeat(230), mentorMessage: 123, role: 'final', completionMessage: ' 完成 ' })).toEqual({ scenario: '任務\n情境', objective: 'a'.repeat(200), completionMessage: '完成' });
  });
  it('falls back to the real summary without inventing a story', () => {
    expect(missionObjective(lessons[0])).toBe('原始摘要');
    expect(missionObjective(lessons[2])).toContain('綜合挑戰');
    expect(missionObjective({ ...lessons[0], mission: { objective: '核對總額' } })).toBe('核對總額');
  });
  it('keeps all nodes locked until signed in', () => {
    lessons.forEach((_, index) => expect(canEnterLesson(lessons, index, ['intro', 'sum'], false)).toBe(false));
  });
  it('preserves sequential and intro unlocking', () => {
    expect(canEnterLesson(lessons, 0, [], true)).toBe(true);
    expect(canEnterLesson(lessons, 1, [], true)).toBe(false);
    expect(canEnterLesson(lessons, 1, ['intro'], true)).toBe(true);
    expect(canEnterLesson(lessons, 2, ['intro'], true)).toBe(false);
    expect(canEnterLesson(lessons, 2, ['intro', 'sum'], true)).toBe(true);
    expect(canEnterLesson(lessons, 90, [], true)).toBe(false);
  });
  it('does not unlock a lesson because it has a story or a reward message', () => {
    const configured = lessons.map(lesson => ({ ...lesson, mission: { completionMessage: '恭喜', objective: '測試' } }));
    expect(canEnterLesson(configured, 2, [], true)).toBe(false);
  });
  it('uses Excel artwork only for Excel identity, not every game', () => {
    expect(gameBrandKind('Excel Master', false)).toBe('excel');
    expect(gameBrandKind('excel master', false)).toBe('excel');
    expect(gameBrandKind('研究探險', false)).toBe('generic');
    expect(gameBrandKind('', true)).toBe('excel');
  });
  it('allows known visual templates and safely falls back for old or invalid settings', () => {
    expect(gameVisualTemplate()).toBe('discovery');
    expect(gameVisualTemplate({ template: 'neo-brutal' })).toBe('neo-brutal');
    expect(gameVisualTemplate({ template: 'arcade' })).toBe('arcade');
    expect(gameVisualTemplate({ template: 'unknown' as never })).toBe('discovery');
  });
  it('accepts hex accents and rejects arbitrary CSS', () => {
    expect(gameThemeStyle({ primaryColor: '#ab1234', accentColor: 'url(https://example.org)' })).toEqual({ '--quest-primary': '#ab1234', '--quest-accent': '#0f8a91' });
  });
});

describe('teacher game-specific mission settings', () => {
  const rows = lessons.map(lesson => ({ id: lesson.lesson_id, description: lesson.description }));
  it('preserves lesson identity and mission by ID when reordering', () => {
    const original = { intro: { role: 'intro' as const }, sum: { mission: { scenario: '活動預算' } } };
    const result = normalizeLessonOverrides(['intro', 'final', 'sum'], original, rows);
    expect(Object.keys(result)).toEqual(['intro', 'final', 'sum']);
    expect(result.sum).toMatchObject({ number: 2, mission: { scenario: '活動預算' }, cardDescription: '函數摘要' });
    expect(original.sum).toEqual({ mission: { scenario: '活動預算' } });
    expect(lessons[1].content).toBe('SUM 教材');
  });
  it('removes deselected settings, preserves intentional blank summary', () => {
    const result = normalizeLessonOverrides(['sum'], { sum: { cardDescription: '' }, intro: { mission: { scenario: '舊任務' } } }, rows);
    expect(result).toEqual({ sum: { number: 1, role: 'standard', cardDescription: '' } });
  });
  it('round trips a saved mission without overwriting existing role or summary', () => {
    const draft = { sum: { number: 1, role: 'standard' as const, cardDescription: '原摘要', mission: { objective: ' 核對總額 ', scenario: '  ' } } };
    const saved = JSON.parse(JSON.stringify(serializeLessonOverrides(draft)));
    expect(saved.sum).toEqual({ number: 1, role: 'standard', cardDescription: '原摘要', mission: { objective: '核對總額' } });
    expect(draft.sum.mission.objective).toBe(' 核對總額 ');
  });
  it('clears a mission without adding empty configuration', () => {
    expect(JSON.parse(JSON.stringify(serializeLessonOverrides({ sum: { mission: { objective: '' } } })))).toEqual({ sum: {} });
  });
});
