import { describe, expect, it } from 'vitest';
import { parseAnalysisReport, structuredReportToMarkdown } from './analysis-sections';

describe('parseAnalysisReport', () => {
  it('splits an inline bold heading from its content and removes markdown markers', () => {
    const report = parseAnalysisReport(
      '**策略轉變能力**：在第 5 單元將嘗試次數降為 1 次，顯示學生會調整策略。',
      'zh-TW',
    );

    expect(report.sections).toEqual([
      expect.objectContaining({
        title: '學習行為觀察',
        content: '在第 5 單元將嘗試次數降為 1 次，顯示學生會調整策略。',
        kind: 'patterns',
      }),
    ]);
    expect(report.sections[0].title).not.toContain('*');
  });

  it('normalizes mixed Chinese and English model headings to the UI language', () => {
    const report = parseAnalysisReport(
      '以下是學習分析。\n\n## Overall Learning Summary（整體學習總結）\n完成 5 個單元。\n\nStrengths: 持續完成任務。\n\n7. Personalized Recommendations\n1. 每 20 分鐘短暫休息。',
      'zh-TW',
    );

    expect(report.preamble).toBe('以下是學習分析。');
    expect(report.sections.map(section => section.title)).toEqual([
      '整體學習摘要',
      '學習優勢',
      '教師下一步建議',
    ]);
    expect(report.sections[2].content).toContain('1. 每 20 分鐘短暫休息。');
  });

  it('keeps numbered recommendations inside a section', () => {
    const report = parseAnalysisReport(
      '## 教師下一步建議\n1. 將長任務拆成兩段。\n2. 下次課前回顧錯題。',
      'zh-TW',
    );

    expect(report.sections).toHaveLength(1);
    expect(report.sections[0].content).toContain('1. 將長任務拆成兩段。');
    expect(report.sections[0].content).toContain('2. 下次課前回顧錯題。');
  });

  it('falls back to a summary when the model omits headings', () => {
    const report = parseAnalysisReport('學生已完成所有任務，建議安排延伸練習。', 'zh-TW');
    expect(report.sections).toEqual([
      expect.objectContaining({ title: '整體學習摘要', kind: 'summary' }),
    ]);
  });
});

describe('conversation headings in free-form reports', () => {
  it('maps "AI 對話洞察" to the conversation section rather than behavior observations', () => {
    const report = parseAnalysisReport('## AI 對話洞察\n常問公式寫法。\n\n## Learning behavior observations\n晚上學習。', 'zh-TW');
    expect(report.sections.map(s => s.kind)).toEqual(['conversation', 'patterns']);
  });
});

describe('structuredReportToMarkdown', () => {
  it('renders sections in canonical order with our own titles, round-tripping through the parser', () => {
    const markdown = structuredReportToMarkdown(JSON.stringify({
      sections: [
        { kind: 'recommendations', content: '1. 下一堂先複習 IF。\n2. 加入計時練習。' },
        { kind: 'summary', content: '完成 5 個單元，完成率 **100%**。' },
      ],
    }), 'zh-TW');

    expect(markdown).toContain('## 整體學習摘要\n完成 5 個單元，完成率 **100%**。\n\n## 教師下一步建議\n1. 下一堂先複習 IF。\n2. 加入計時練習。');
    const report = parseAnalysisReport(markdown, 'zh-TW');
    expect(report.sections.map(s => s.kind)).toEqual(['summary', 'recommendations']);
    expect(report.preamble).toBe('');
  });

  it('places the conversation section between behavior observations and strengths', () => {
    const markdown = structuredReportToMarkdown(JSON.stringify({
      sections: [
        { kind: 'strengths', content: '能主動提問。' },
        { kind: 'conversation', content: '多次詢問 SUM 的範圍寫法，例如「SUM 函數怎麼用？」。' },
        { kind: 'patterns', content: '集中在晚上學習。' },
      ],
    }), 'zh-TW');

    const report = parseAnalysisReport(markdown, 'zh-TW');
    expect(report.sections.map(s => [s.kind, s.title])).toEqual([
      ['patterns', '學習行為觀察'],
      ['conversation', 'AI 對話洞察'],
      ['strengths', '學習優勢'],
    ]);
  });

  it('drops heading lines the model put inside a body so they cannot split sections', () => {
    const markdown = structuredReportToMarkdown(JSON.stringify({
      sections: [{ kind: 'strengths', content: '### Strengths\nFinishes every unit.' }],
    }), 'en');
    expect(parseAnalysisReport(markdown, 'en').sections).toEqual([
      expect.objectContaining({ kind: 'strengths', content: 'Finishes every unit.' }),
    ]);
  });

  it('returns null for unusable payloads so callers can fall back to raw text', () => {
    expect(structuredReportToMarkdown('## not json', 'en')).toBeNull();
    expect(structuredReportToMarkdown('{"sections": "nope"}', 'en')).toBeNull();
    expect(structuredReportToMarkdown('{"sections": [{"kind": "bogus", "content": "x"}]}', 'en')).toBeNull();
  });

  it('keeps "Label：" and bold lines inside a structured section body instead of splitting on them', () => {
    const markdown = structuredReportToMarkdown(JSON.stringify({
      sections: [{ kind: 'patterns', content: '觀察內容：每次約 10 分鐘。\n**優勢**：能持續完成。' }],
    }), 'zh-TW');
    const report = parseAnalysisReport(markdown, 'zh-TW');
    expect(report.sections).toEqual([
      expect.objectContaining({ kind: 'patterns', content: '觀察內容：每次約 10 分鐘。\n**優勢**：能持續完成。' }),
    ]);
    expect(report.preamble).toBe('');
  });

  it('accepts JSON wrapped in a code fence (unconstrained model output)', () => {
    const fenced = '```json\n' + JSON.stringify({ sections: [{ kind: 'summary', content: 'ok' }] }) + '\n```';
    expect(parseAnalysisReport(structuredReportToMarkdown(fenced, 'en'), 'en').sections)
      .toEqual([expect.objectContaining({ kind: 'summary', content: 'ok' })]);
  });
});
