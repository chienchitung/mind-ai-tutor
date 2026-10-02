// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LanguageProvider } from '@/app/contexts/LanguageContext';
import { AIAnalysisReport } from './AIAnalysisReport';
import { loadAnalysisHistory, saveAnalysisReport } from '../lib/analysis-history';

vi.mock('../lib/analysis-history', () => ({
  loadAnalysisHistory: vi.fn(),
  saveAnalysisReport: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.mocked(loadAnalysisHistory).mockReset();
  vi.mocked(saveAnalysisReport).mockReset();
});

const savedReport = (id: string, analysis: string, created_at: string) => ({
  id, analysis, language: 'zh-TW' as const, scope_label: '所有遊戲 · 全部期間', record_count: 3, created_at,
});

describe('AIAnalysisReport', () => {
  it('renders malformed bold headings without visible markdown markers and prioritizes teacher actions', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      analysis: [
        '## Overall Learning Summary',
        '完成率為 100%。',
        '',
        '**策略轉變能力**：學生在最後一個單元調整了解題方式。',
        '',
        '## Personalized Recommendations',
        '1. 下一堂課先請學生口述解題步驟。',
      ].join('\n'),
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })));

    render(
      <LanguageProvider>
        <AIAnalysisReport
          learningRecords={[{ lesson_title: '樞紐分析表' }]}
          learningStats={{ completionRate: 100 }}
          selectedStudentName="測試學生"
          studentId={null}
          scopeLabel=""
        />
      </LanguageProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: '生成分析' }));

    await screen.findByText('教師重點摘要');
    expect(screen.queryByText(/\*\*/)).toBeNull();
    expect(screen.getByText('學習行為觀察')).toBeTruthy();
    expect(screen.getByText('教師下一步建議')).toBeTruthy();
    expect(screen.getByRole('button', { name: '查看 1 項分析依據' })).toBeTruthy();

    const buttonLabels = screen.getAllByRole('button').map(button => button.textContent ?? '');
    expect(buttonLabels.findIndex(label => label.includes('教師下一步建議')))
      .toBeLessThan(buttonLabels.findIndex(label => label.includes('學習行為觀察')));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /教師下一步建議/ }).getAttribute('aria-expanded')).toBe('true');
      expect(screen.getByRole('button', { name: /學習行為觀察/ }).getAttribute('aria-expanded')).toBe('false');
    });
  });

  it('opens the latest saved report without calling the AI, and switches between history entries', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.mocked(loadAnalysisHistory).mockResolvedValue({
      status: 'ok',
      reports: [
        savedReport('new', '## Strengths\n最新報告內容。', '2026-10-02T03:00:00Z'),
        savedReport('old', '## Strengths\n較早報告內容。', '2026-09-20T03:00:00Z'),
      ],
    });

    render(
      <LanguageProvider>
        <AIAnalysisReport learningRecords={[{}]} learningStats={{}} selectedStudentName="測試學生" studentId="s1" scopeLabel="" />
      </LanguageProvider>,
    );

    await screen.findByText(/產生於/);
    fireEvent.click(screen.getByRole('button', { name: /學習優勢/ }));
    expect(await screen.findByText('最新報告內容。')).toBeTruthy();
    expect(screen.queryByText(/較早的報告/)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole('combobox', { name: '歷史報告' })).toBeTruthy();
  });

  it('saves a newly generated report into history', async () => {
    vi.mocked(loadAnalysisHistory).mockResolvedValue({ status: 'ok', reports: [] });
    vi.mocked(saveAnalysisReport).mockImplementation(async (report) =>
      savedReport('saved', report.analysis, '2026-10-02T04:00:00Z'));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      analysis: '## Overall Learning Summary\n完成率 100%。',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })));

    render(
      <LanguageProvider>
        <AIAnalysisReport learningRecords={[{}, {}]} learningStats={{}} selectedStudentName="測試學生" studentId="s1" scopeLabel="Excel · 最近 7 天" />
      </LanguageProvider>,
    );

    await waitFor(() => expect(loadAnalysisHistory).toHaveBeenCalledWith('s1'));
    fireEvent.click(screen.getByRole('button', { name: '生成分析' }));
    await screen.findByText(/產生於/);
    expect(saveAnalysisReport).toHaveBeenCalledWith(expect.objectContaining({
      studentId: 's1', scopeLabel: 'Excel · 最近 7 天', recordCount: 2,
    }));
  });

  it('still generates analysis when report history is unavailable (migration not applied)', async () => {
    vi.mocked(loadAnalysisHistory).mockResolvedValue({ status: 'unavailable' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      analysis: '## Overall Learning Summary\n完成率 100%。',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })));

    render(
      <LanguageProvider>
        <AIAnalysisReport learningRecords={[{}]} learningStats={{}} selectedStudentName="測試學生" studentId="s1" scopeLabel="" />
      </LanguageProvider>,
    );

    await waitFor(() => expect(loadAnalysisHistory).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: '生成分析' }));
    await screen.findByText('教師重點摘要');
    expect(saveAnalysisReport).not.toHaveBeenCalled();
  });

  it('renders every section expanded only while printing', async () => {
    vi.mocked(loadAnalysisHistory).mockResolvedValue({
      status: 'ok',
      reports: [savedReport('r1', '## Strengths\n優勢內容。\n\n## Learning behavior observations\n行為內容。', '2026-10-02T03:00:00Z')],
    });

    render(
      <LanguageProvider>
        <AIAnalysisReport learningRecords={[{}]} learningStats={{}} selectedStudentName="測試學生" studentId="s1" scopeLabel="" />
      </LanguageProvider>,
    );

    await screen.findByText(/產生於/);
    // Evidence sections start collapsed on screen (only a one-line preview
    // span, no rendered body paragraph).
    const body = (text: string) => screen.queryByText(text, { selector: 'p' });
    expect(body('行為內容。')).toBeNull();

    fireEvent(window, new Event('beforeprint'));
    expect(body('行為內容。')).toBeTruthy();
    expect(body('優勢內容。')).toBeTruthy();

    fireEvent(window, new Event('afterprint'));
    await waitFor(() => expect(body('行為內容。')).toBeNull());
  });
});
