// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { LanguageProvider } from '@/app/contexts/LanguageContext';
import { PreparedPolls } from './PreparedPolls';

afterEach(cleanup);

const polls = [
  { id: '11111111-1111-4111-8111-111111111111', question: 'IF 的第一個參數是？', options: ['條件', '結果'], used: true },
  { id: '22222222-2222-4222-8222-222222222222', question: '巢狀 IF 最多幾層？', options: ['7', '64'] },
];

it('lists prepared polls in order, marks launched ones, and launches, edits or deletes each', () => {
  const handlers = { onAdd: vi.fn(), onLaunch: vi.fn(), onEdit: vi.fn(), onDelete: vi.fn() };
  render(<LanguageProvider><PreparedPolls polls={polls} launchingId={null} {...handlers} /></LanguageProvider>);
  expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
    expect.stringContaining('IF 的第一個參數是？'),
    expect.stringContaining('巢狀 IF 最多幾層？'),
  ]);
  expect(screen.getAllByText('已發布')).toHaveLength(1);
  fireEvent.click(screen.getAllByRole('button', { name: '發布' })[1]);
  expect(handlers.onLaunch).toHaveBeenCalledWith(polls[1]);
  fireEvent.click(screen.getByRole('button', { name: '編輯第 1 題預備題目' }));
  expect(handlers.onEdit).toHaveBeenCalledWith(polls[0]);
  fireEvent.click(screen.getByRole('button', { name: '刪除第 2 題預備題目' }));
  expect(handlers.onDelete).toHaveBeenCalledWith(polls[1]);
  fireEvent.click(screen.getByRole('button', { name: '新增預備題目' }));
  expect(handlers.onAdd).toHaveBeenCalled();
});

it('explains the list while it is empty, and holds other launches while one is going out', () => {
  const { rerender } = render(
    <LanguageProvider><PreparedPolls polls={[]} launchingId={null} onAdd={vi.fn()} onLaunch={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} /></LanguageProvider>,
  );
  expect(screen.getByText(/課前先把這堂課要問的投票題目準備好/)).toBeTruthy();
  rerender(
    <LanguageProvider><PreparedPolls polls={polls} launchingId={polls[0].id} onAdd={vi.fn()} onLaunch={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} /></LanguageProvider>,
  );
  expect(screen.getAllByRole('button', { name: '發布' }).every((button) => (button as HTMLButtonElement).disabled)).toBe(true);
});
