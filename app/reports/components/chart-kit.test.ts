import { describe, expect, it } from 'vitest';
import { truncateLabel } from './chart-kit';

describe('truncateLabel', () => {
  it('keeps short labels and trims long ones by rendered width', () => {
    expect(truncateLabel('第四課：樞紐分析表', 10)).toBe('第四課：樞紐分析表');
    expect(truncateLabel('第三課：IF 條件判斷與巢狀函數應用', 10)).toBe('第三課：IF 條件判斷…');
    // Latin glyphs are narrower, so more of them fit.
    expect(truncateLabel('Lesson 3: nested IF functions', 10)).toBe('Lesson 3: nested I…');
  });
});
