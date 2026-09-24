// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LanguageProvider } from '@/app/contexts/LanguageContext';
import { AIAnalysisReport } from './AIAnalysisReport';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
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
});
