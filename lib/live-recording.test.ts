import { describe, expect, it } from 'vitest';
import { formatClock, joinTranscript, lessonNotesSchema, lessonNotesToMarkdown, segmentPath, slideTimeline } from './live-recording';

describe('formatClock', () => {
  it('formats minutes and hours, treating missing values as zero', () => {
    expect(formatClock(Number.NaN)).toBe('0:00');
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(305)).toBe('5:05');
    expect(formatClock(3725)).toBe('1:02:05');
  });
});

describe('segmentPath', () => {
  it("keeps every segment inside the owner's folder, zero-padded for ordering", () => {
    expect(segmentPath('owner', 'rec', 7)).toBe('owner/rec/007.wav');
  });
});

describe('slideTimeline', () => {
  it('turns page-turn marks into ranges, merging repeats and dropping zero-length flips', () => {
    expect(slideTimeline([{ t: 0, page: 1 }, { t: 60, page: 2 }, { t: 60, page: 3 }, { t: 90, page: 3 }, { t: 200, page: 1 }], 300)).toEqual([
      { page: 1, from: 0, to: 60 },
      { page: 3, from: 60, to: 200 },
      { page: 1, from: 200, to: 300 },
    ]);
  });
});

describe('joinTranscript', () => {
  it('orders transcribed segments, stamps their start time and skips failed or empty ones', () => {
    expect(joinTranscript([
      { idx: 1, startSeconds: 300, durationSeconds: 300, status: 'transcribed', transcript: '第二段', error: null },
      { idx: 2, startSeconds: 600, durationSeconds: 300, status: 'failed', transcript: null, error: 'x' },
      { idx: 0, startSeconds: 0, durationSeconds: 300, status: 'transcribed', transcript: ' 第一段 ', error: null },
      { idx: 3, startSeconds: 900, durationSeconds: 10, status: 'transcribed', transcript: '  ', error: null },
    ])).toBe('[0:00] 第一段\n\n[5:00] 第二段');
  });
});

describe('lesson notes', () => {
  const notes = lessonNotesSchema.parse({
    title: 'IF 函數', summary: '介紹 IF 的語法。',
    sections: [{ heading: '語法', slidePages: [2, 3], startSeconds: 65, points: ['IF(條件, 真, 假)'], examples: ['成績及格判斷'] }],
    keyTerms: [{ term: '巢狀 IF', definition: 'IF 裡面再放 IF' }],
    studentQuestions: [{ question: 'IF 可以放幾層？', answer: '最多 64 層' }],
    reviewQuestions: [{ question: 'IF 有幾個參數？', answer: '三個' }],
  });
  it('fills optional arrays when the model omits them', () => {
    const minimal = lessonNotesSchema.parse({ title: 't', summary: 's', sections: [{ heading: 'h', points: ['p'] }] });
    expect(minimal.sections[0]).toMatchObject({ slidePages: [], startSeconds: null, examples: [] });
    expect(minimal.reviewQuestions).toEqual([]);
  });
  it('exports Markdown with slide references and timestamps', () => {
    const markdown = lessonNotesToMarkdown(notes, true);
    expect(markdown).toContain('# IF 函數');
    expect(markdown).toContain('## 語法\n_投影片 2, 3 · 1:05_');
    expect(markdown).toContain('- 例：成績及格判斷');
    expect(markdown).toContain('- **巢狀 IF**：IF 裡面再放 IF');
    expect(markdown).toContain('1. IF 有幾個參數？\n   - 參考答案：三個');
  });
});
