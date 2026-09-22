import { describe, expect, it } from 'vitest';
import { parseAnalysisReport } from './analysis-sections';

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
