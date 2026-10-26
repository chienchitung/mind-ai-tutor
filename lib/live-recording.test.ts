import { describe, expect, it } from 'vitest';
import { findRecordingMatch, formatClock, formatPages, joinTranscript, lessonNotesSchema, lessonNotesToMarkdown, parseClock, segmentPath, slideTimeline, timedTranscript, transcriptParagraphs, uncoveredSlides } from './live-recording';

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
    sections: [{ heading: '語法', slidePages: [2, 3], startSeconds: 65, points: ['IF(條件, 真, 假)'], examples: ['成績及格判斷'], emphasis: ['逗號要用半形'] }],
    keyTerms: [{ term: '巢狀 IF', definition: 'IF 裡面再放 IF' }],
    studentQuestions: [{ question: 'IF 可以放幾層？', answer: '最多 64 層' }],
    reviewQuestions: [{ question: 'IF 有幾個參數？', answer: '三個' }],
    uncoveredSlides: [{ page: 4, title: '巢狀 IF' }, { page: 5, title: '' }],
  });
  it('fills optional arrays when the model omits them', () => {
    const minimal = lessonNotesSchema.parse({ title: 't', summary: 's', sections: [{ heading: 'h', points: ['p'] }] });
    expect(minimal.sections[0]).toMatchObject({ slidePages: [], startSeconds: null, examples: [], emphasis: [] });
    // Notes made before the list existed: unknown, not "everything covered".
    expect(minimal.uncoveredSlides).toBeUndefined();
    expect(minimal.reviewQuestions).toEqual([]);
  });
  it('exports Markdown with slide references and timestamps', () => {
    const markdown = lessonNotesToMarkdown(notes, true);
    expect(markdown).toContain('# IF 函數');
    expect(markdown).toContain('## 語法\n_投影片第 2–3 頁 · 1:05_');
    expect(markdown).toContain('- 例：成績及格判斷');
    expect(markdown).toContain('- **老師強調**：逗號要用半形');
    expect(markdown).toContain('## 這次錄音沒講到的投影片\n\n- 第 4 頁：巢狀 IF\n- 第 5 頁');
    expect(markdown).toContain('- **巢狀 IF**：IF 裡面再放 IF');
    expect(markdown).toContain('1. IF 有幾個參數？\n   - 參考答案：三個');
  });
});

describe('slides and the notes', () => {
  it('writes page lists as ranges', () => {
    expect(formatPages([7, 3, 4, 5, 4])).toBe('3–5, 7');
    expect(formatPages([2])).toBe('2');
  });
  it('lists the deck pages no section covers, titled by their text', () => {
    const deck = [
      { page: 1, text: '  IF   函數 ' }, { page: 2, text: 'x'.repeat(60) }, { page: 3, text: '' }, { page: 4, text: '巢狀' },
    ];
    expect(uncoveredSlides(deck, [{ slidePages: [1] }, { slidePages: [4] }])).toEqual([
      { page: 2, title: `${'x'.repeat(40)}…` }, { page: 3, title: '' },
    ]);
    expect(uncoveredSlides([], [{ slidePages: [1] }])).toEqual([]);
  });
});

describe('per-paragraph timestamps', () => {
  it('parses clocks and rejects anything else', () => {
    expect(parseClock('2:13')).toBe(133);
    expect(parseClock('02:05')).toBe(125);
    expect(parseClock('1:02:05')).toBe(3725);
    expect(parseClock('1:75')).toBeNull();
    expect(parseClock('soon')).toBeNull();
  });
  it('moves clip-relative times onto the lecture clock, keeping them ordered and inside the segment', () => {
    expect(timedTranscript([
      { start: '0:00', text: '同學好，' },
      { start: '1:30', text: '今天看 IF。\n第二行' },
      { start: '1:10', text: '時間倒退的段落' },
      { start: 'later', text: '沒有時間的段落' },
      { start: '9:59', text: '超出這段' },
      { start: '2:00', text: '  ' },
    ], 300, 300)).toBe([
      '[5:00] 同學好，',
      '[6:30] 今天看 IF。 第二行',
      '[6:30] 時間倒退的段落',
      '[6:30] 沒有時間的段落',
      '[10:00] 超出這段',
    ].join('\n\n'));
  });
  it('reads timed paragraphs back, and treats an older untimed transcript as one paragraph at the segment start', () => {
    expect(transcriptParagraphs({ startSeconds: 300, transcript: '[5:00] 甲\n\n[6:30] 乙' })).toEqual([
      { seconds: 300, text: '甲' },
      { seconds: 390, text: '乙' },
    ]);
    expect(transcriptParagraphs({ startSeconds: 300, transcript: '舊的逐字稿\n\n第二段' })).toEqual([
      { seconds: 300, text: '舊的逐字稿\n\n第二段' },
    ]);
    expect(transcriptParagraphs({ startSeconds: 0, transcript: '  ' })).toEqual([]);
  });
  it('joins old and new segments into one lecture transcript', () => {
    expect(joinTranscript([
      { idx: 1, startSeconds: 300, durationSeconds: 300, status: 'transcribed', transcript: '[5:00] 新甲\n\n[6:12] 新乙', error: null },
      { idx: 0, startSeconds: 0, durationSeconds: 300, status: 'transcribed', transcript: '舊段落', error: null },
    ])).toBe('[0:00] 舊段落\n\n[5:00] 新甲\n\n[6:12] 新乙');
  });
});

describe('isRecordingActive', () => {
  it('counts a recording as live only while it is recording and was saved recently', async () => {
    const { isRecordingActive } = await import('./live-recording');
    const now = Date.parse('2026-10-25T10:00:00Z');
    expect(isRecordingActive('recording', '2026-10-25T09:58:00Z', now)).toBe(true);
    expect(isRecordingActive('recording', '2026-10-25T09:50:00Z', now)).toBe(false);
    expect(isRecordingActive('stopped', '2026-10-25T09:59:00Z', now)).toBe(false);
    expect(isRecordingActive('recording', null, now)).toBe(false);
  });
});

describe('findRecordingMatch', () => {
  const transcript = '[0:00] 今天介紹 IF 函數。\n\n[2:15] 接著用 VLOOKUP 查表，記得第四個參數要填 FALSE。';
  it('finds a transcript hit case-insensitively with its paragraph time and an excerpt', () => {
    expect(findRecordingMatch(transcript, 'vlookup', 'transcript')).toEqual({
      where: 'transcript',
      at: '2:15',
      snippet: '今天介紹 IF 函數。 接著用 VLOOKUP 查表，記得第四個參數要填 FALSE。',
    });
  });
  it('has no time for notes, and nothing when the text is absent', () => {
    expect(findRecordingMatch('重點：IF 巢狀', 'IF', 'notes')).toEqual({ where: 'notes', at: null, snippet: '重點：IF 巢狀' });
    expect(findRecordingMatch(transcript, 'SUMIF', 'transcript')).toBeNull();
  });
});
