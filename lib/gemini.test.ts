import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateDetailedLearningAnalysis, transcribeLectureAudio } from './gemini';

const { generateContent } = vi.hoisted(() => ({ generateContent: vi.fn() }));

vi.mock('server-only', () => ({}));
vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = { generateContent };
  },
}));

const baseData = {
  studentName: '王小明',
  language: 'zh-TW',
  stats: { totalRecords: 2 },
  recentLearning: [],
};

const conversation = {
  total_student_questions: 1,
  sessions: 1,
  excerpts: [{ lesson_title: '函數入門', asked_at: '2026-09-01T10:00:00Z', student_question: 'SUM 怎麼用？', ai_reply_start: '先想想範圍。' }],
};

describe('generateDetailedLearningAnalysis', () => {
  beforeEach(() => {
    generateContent.mockReset();
    generateContent.mockResolvedValue({
      text: JSON.stringify({ sections: [
        { kind: 'summary', content: '完成兩個單元。' },
        { kind: 'conversation', content: '集中詢問 SUM。' },
      ] }),
    });
  });

  it('asks for a conversation section when chat excerpts are supplied', async () => {
    const analysis = await generateDetailedLearningAnalysis({ ...baseData, conversation });

    const prompt = generateContent.mock.calls[0][0].contents as string;
    expect(prompt).toContain('CONVERSATION ANALYSIS');
    expect(prompt).toContain('summary, time, focus, patterns, conversation, strengths');
    expect(prompt).toContain('## AI 對話洞察');
    expect(prompt).toContain('SUM 怎麼用？');
    expect(analysis).toContain('## AI 對話洞察\n集中詢問 SUM。');
  });

  it('leaves the conversation section out without chat data', async () => {
    await generateDetailedLearningAnalysis(baseData);

    const prompt = generateContent.mock.calls[0][0].contents as string;
    expect(prompt).not.toContain('CONVERSATION ANALYSIS');
    expect(prompt).toContain('summary, time, focus, patterns, strengths');
    expect(prompt).not.toContain('AI 對話洞察');
  });
});

describe('transcribeLectureAudio', () => {
  beforeEach(() => generateContent.mockReset());
  it('asks for timed paragraphs as JSON and returns them', async () => {
    generateContent.mockResolvedValue({ text: JSON.stringify({ paragraphs: [{ start: '0:04', text: '同學好' }, { start: '1:10', text: '今天看 IF' }] }) });
    expect(await transcribeLectureAudio('AAAA', { language: 'zh-TW' })).toEqual([
      { start: '0:04', text: '同學好' },
      { start: '1:10', text: '今天看 IF' },
    ]);
    const request = generateContent.mock.calls[0][0];
    expect(request.config.responseMimeType).toBe('application/json');
    expect(request.contents[0].parts[0].inlineData).toEqual({ mimeType: 'audio/wav', data: 'AAAA' });
  });
  it('keeps plain text as one paragraph when the model ignores the schema, and returns nothing for silence', async () => {
    generateContent.mockResolvedValue({ text: '只有一段文字' });
    expect(await transcribeLectureAudio('AAAA', { language: 'zh-TW' })).toEqual([{ start: '0:00', text: '只有一段文字' }]);
    generateContent.mockResolvedValue({ text: JSON.stringify({ paragraphs: [] }) });
    expect(await transcribeLectureAudio('AAAA', { language: 'zh-TW' })).toEqual([]);
  });
});
