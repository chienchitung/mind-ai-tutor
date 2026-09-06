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
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock('@/lib/supabase', () => ({
  supabase: () => ({ auth: { signOut: mocks.signOut } }),
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
  // navigation-guard's confirmAppNavigation dispatches a real, cancelable
  // window event and returns whether it was cancelled - nothing in this
  // test cancels it, so guarded actions proceed exactly as in the app.
  window.location.href = 'about:blank';
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

  it('opens the dropdown with subscription and log-out entries', async () => {
    renderMenu('row');
    fireEvent.pointerDown(screen.getByRole('button', { name: /王老師/ }));
    expect(await screen.findByText('訂閱')).toBeTruthy();
    expect(screen.getByText('登出')).toBeTruthy();
    expect(screen.getByText('語言')).toBeTruthy();
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

  it('switches language and shows a confirmation toast', async () => {
    renderMenu('row');
    fireEvent.pointerDown(screen.getByRole('button', { name: /王老師/ }));
    fireEvent.click(await screen.findByText('語言'));
    fireEvent.click(await screen.findByText('English'));
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Language changed' }));
  });
});
