// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LanguageProvider } from '@/app/contexts/LanguageContext';
import AdminPage from './page';

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  toast: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({ supabase: () => ({ rpc: mocks.rpc }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/lib/admin-overview', () => ({
  loadAdminOverview: vi.fn().mockResolvedValue({
    profiles: [],
    profilesError: null,
    counts: {
      students: { count: 0, error: null },
      events: { count: 0, error: null },
      lessons: { count: 0, error: null },
      feedback: { count: 0, error: null },
    },
  }),
}));

function renderPage() {
  return render(
    <LanguageProvider>
      <AdminPage />
    </LanguageProvider>,
  );
}

beforeEach(() => {
  mocks.rpc.mockReset();
  mocks.toast.mockReset();
  mocks.rpc.mockImplementation((fn: string) => {
    if (fn === 'get_game_chat_daily_limit') return Promise.resolve({ data: 30, error: null });
    return Promise.resolve({ data: null, error: null });
  });
});
afterEach(() => cleanup());

describe('AdminPage AI tutor usage setting', () => {
  it('loads and shows the current daily device limit', async () => {
    renderPage();
    expect(await screen.findByDisplayValue('30')).toBeTruthy();
    expect(mocks.rpc).toHaveBeenCalledWith('get_game_chat_daily_limit');
  });

  it('saves a valid new limit and shows a confirmation toast', async () => {
    renderPage();
    const input = await screen.findByDisplayValue('30');
    fireEvent.change(input, { target: { value: '50' } });
    fireEvent.click(screen.getByRole('button', { name: '儲存' }));

    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith('set_game_chat_daily_limit', { p_limit: 50 }));
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: '已更新每日詢問次數上限' }));
  });

  it('rejects a non-positive value without calling the server', async () => {
    renderPage();
    const input = await screen.findByDisplayValue('30');
    fireEvent.change(input, { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: '儲存' }));

    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' })));
    expect(mocks.rpc).not.toHaveBeenCalledWith('set_game_chat_daily_limit', expect.anything());
  });

  it('shows an error toast when the save RPC fails', async () => {
    renderPage();
    const input = await screen.findByDisplayValue('30');
    fireEvent.change(input, { target: { value: '10' } });
    mocks.rpc.mockImplementation((fn: string) => {
      if (fn === 'get_game_chat_daily_limit') return Promise.resolve({ data: 30, error: null });
      return Promise.resolve({ data: null, error: { message: 'FORBIDDEN' } });
    });
    fireEvent.click(screen.getByRole('button', { name: '儲存' }));

    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive', title: '更新失敗，請稍後再試' })));
  });
});
