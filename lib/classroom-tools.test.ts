// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { clampGroupCount, formatClock, loadSettings, resizeGroups, saveSettings, shuffle } from './classroom-tools';

afterEach(() => window.localStorage.clear());

describe('classroom tools', () => {
  it('shuffles without losing or repeating anyone', () => {
    const groups = ['A', 'B', 'C', 'D', 'E'];
    const order = shuffle(groups);
    expect([...order].sort()).toEqual(groups);
    // Deterministic with an injected source: always swapping with index 0.
    expect(shuffle(['A', 'B', 'C'], () => 0)).toEqual(['B', 'C', 'A']);
    expect(groups).toEqual(['A', 'B', 'C', 'D', 'E']);
  });

  it('keeps typed group names when the count changes, within 2 to 20 groups', () => {
    expect(resizeGroups(['紅隊', '藍隊'], 4, true)).toEqual(['紅隊', '藍隊', '第 3 組', '第 4 組']);
    expect(resizeGroups(['紅隊', '藍隊', '第 3 組'], 2, true)).toEqual(['紅隊', '藍隊']);
    expect(clampGroupCount(1)).toBe(2);
    expect(clampGroupCount(99)).toBe(20);
    expect(clampGroupCount(Number.NaN)).toBe(2);
  });

  it('formats the countdown, rounding a partial second up', () => {
    expect(formatClock(300)).toBe('05:00');
    expect(formatClock(59.2)).toBe('01:00');
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(3725)).toBe('1:02:05');
  });

  it('remembers the course name, duration, groups and sound in this browser', () => {
    saveSettings({ courseName: '第三課：IF 函數', durationSeconds: 600, groupNames: ['甲', '乙', '丙'], muted: true, tab: 'groups' });
    expect(loadSettings(true)).toEqual({ courseName: '第三課：IF 函數', durationSeconds: 600, groupNames: ['甲', '乙', '丙'], muted: true, tab: 'groups' });
    window.localStorage.setItem('classroom-tools:v1', '{not json');
    expect(loadSettings(true).groupNames).toEqual(['第 1 組', '第 2 組', '第 3 組', '第 4 組']);
  });
});
