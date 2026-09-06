// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { User } from '@supabase/supabase-js';
import { LanguageProvider } from '@/app/contexts/LanguageContext';
import { AccountMenu } from './AccountMenu';

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  signOut: vi.fn().mockResolvedValue({ error: null }),
  toast: vi.fn(),
  rpc: vi.fn().mockResolvedValue({ data: { balance: 730, monthly_grant: 1000 }, error: null }),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock('@/lib/supabase', () => ({
  supabase: () => ({ auth: { signOut: mocks.signOut }, rpc: mocks.rpc }),
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));

const user = {
  id: 'user-1',
  email: 'teacher@example.com',
  user_metadata: { full_name: '王老師' },
} as unknown as User;

function renderMenu(variant: 'row' | 'icon', who: User | null = user) {
  return render(
    <LanguageProvider>
      <AccountMenu user={who} variant={variant} />
    </LanguageProvider>,
  );
}

beforeEach(() => {
  mocks.push.mockClear();
  mocks.signOut.mockClear();
  mocks.toast.mockClear();
  mocks.rpc.mockClear();
  mocks.rpc.mockResolvedValue({ data: { balance: 730, monthly_grant: 1000 }, error: null });
  // navigation-guard's confirmAppNavigation dispatches a real, cancelable
  // window event and returns whether it was cancelled - nothing in this
  // test cancels it, so guarded actions proceed exactly as in the app.
  window.location.href = 'about:blank';
  // LanguageProvider persists the chosen language to real localStorage,
  // which jsdom keeps across tests in this file - without clearing it, the
  // "switches language" test below leaks English into whichever test runs
  // after it.
  localStorage.clear();
});
afterEach(() => cleanup());

describe('AccountMenu', () => {
  it('shows name and email inline for the "row" variant (desktop sidebar)', () => {
    renderMenu('row');
    expect(screen.getByText('王老師')).toBeTruthy();
    expect(screen.getByText('teacher@example.com')).toBeTruthy();
  });

  it('shows only the avatar for the "icon" variant (mobile topbar / collapsed sidebar)', () => {
    renderMenu('icon');
    expect(screen.queryByText('王老師')).toBeNull();
    expect(screen.getByRole('button', { name: '帳號選單' })).toBeTruthy();
  });

  it('falls back to the email prefix, then a generic label, when no name is set', () => {
    cleanup();
    renderMenu('row', { id: 'u2', email: 'noname@example.com', user_metadata: {} } as unknown as User);
    expect(screen.getByText('noname')).toBeTruthy();
    cleanup();
    renderMenu('row', null);
    expect(screen.getByText('使用者')).toBeTruthy();
  });

  it('opens the dropdown with settings, subscription and log-out entries', async () => {
    renderMenu('row');
    fireEvent.pointerDown(screen.getByRole('button', { name: /王老師/ }));
    expect(await screen.findByText('訂閱')).toBeTruthy();
    expect(screen.getByText('設定')).toBeTruthy();
    expect(screen.getByText('登出')).toBeTruthy();
    expect(screen.getByText('語言')).toBeTruthy();
  });

  it('shows settings for the "icon" variant too (mobile topbar) - it no longer has its own separate icon there', async () => {
    renderMenu('icon');
    fireEvent.pointerDown(screen.getByRole('button', { name: '帳號選單' }));
    expect(await screen.findByText('設定')).toBeTruthy();
  });

  it('offers both languages directly, without a nested submenu', async () => {
    renderMenu('row');
    fireEvent.pointerDown(screen.getByRole('button', { name: /王老師/ }));
    expect(await screen.findByRole('menuitemradio', { name: 'English' })).toBeTruthy();
    expect(screen.getByRole('menuitemradio', { name: '繁體中文' })).toBeTruthy();
  });

  it('navigates to /subscription when that item is clicked', async () => {
    renderMenu('row');
    fireEvent.pointerDown(screen.getByRole('button', { name: /王老師/ }));
    fireEvent.click(await screen.findByText('訂閱'));
    expect(mocks.push).toHaveBeenCalledWith('/subscription');
  });

  it('signs out and shows a confirmation toast', async () => {
    renderMenu('row');
    fireEvent.pointerDown(screen.getByRole('button', { name: /王老師/ }));
    fireEvent.click(await screen.findByText('登出'));
    await waitFor(() => expect(mocks.signOut).toHaveBeenCalled());
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: '成功登出' }));
  });

  it('switches language directly (one click, no submenu to open first) and shows a confirmation toast', async () => {
    renderMenu('row');
    fireEvent.pointerDown(screen.getByRole('button', { name: /王老師/ }));
    fireEvent.click(await screen.findByText('English'));
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Language changed' }));
  });

  it('loads and shows the monthly AI point balance only once the menu is opened', async () => {
    renderMenu('row');
    expect(mocks.rpc).not.toHaveBeenCalled();
    fireEvent.pointerDown(screen.getByRole('button', { name: /王老師/ }));
    expect(await screen.findByText('730/1000')).toBeTruthy();
    expect(mocks.rpc).toHaveBeenCalledWith('get_ai_points_balance');
  });

  it('does not re-fetch the balance on a second open', async () => {
    renderMenu('row');
    const trigger = screen.getByRole('button', { name: /王老師/ });
    fireEvent.pointerDown(trigger);
    await screen.findByText('730/1000');
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    fireEvent.pointerDown(trigger);
    await screen.findByText('730/1000');
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });

  it('does not show a balance section when the RPC has no data yet (e.g. not authenticated)', async () => {
    renderMenu('row', null);
    fireEvent.pointerDown(screen.getByRole('button', { name: /使用者/ }));
    await screen.findByText('訂閱');
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(screen.queryByText(/\/1000/)).toBeNull();
  });
});
