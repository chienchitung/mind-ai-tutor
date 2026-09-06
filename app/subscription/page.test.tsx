// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { LanguageProvider } from '@/app/contexts/LanguageContext';
import SubscriptionPage from './page';

vi.mock('@/lib/supabase', () => ({
  supabase: () => ({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
  }),
}));

beforeEach(() => {
  vi.spyOn(window, 'open').mockImplementation(() => null);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderPage() {
  return render(
    <LanguageProvider>
      <SubscriptionPage />
    </LanguageProvider>,
  );
}

describe('SubscriptionPage', () => {
  it('shows custom pricing (not a dollar figure) for Enterprise', () => {
    renderPage();
    expect(screen.getByText('客製化報價')).toBeTruthy();
    expect(screen.queryByText('$99')).toBeNull();
  });

  it('lets Enterprise contact sales directly, unlike Free/Pro which stay disabled', async () => {
    renderPage();
    // Two "Contact sales" buttons exist: the Enterprise plan card's own
    // button, and the unrelated custom-plan callout below the pricing grid.
    const contactButtons = screen.getAllByRole('button', { name: '聯繫銷售' });
    expect(contactButtons).toHaveLength(2);
    contactButtons.forEach((button) => expect((button as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(contactButtons[0]);
    expect(window.open).toHaveBeenCalledWith('mailto:sales@mindaitutor.com');

    // Free/Pro buttons show "processing" until the (mocked) user fetch
    // resolves. With no logged-in user, currentPlan defaults to "Free
    // plan", so Free shows "current plan" and only Pro shows "not
    // available yet" - both stay disabled either way.
    const notYetButtons = await screen.findAllByRole('button', { name: '尚未開放' });
    expect(notYetButtons).toHaveLength(1);
    notYetButtons.forEach((button) => expect((button as HTMLButtonElement).disabled).toBe(true));
    const currentPlanButton = screen.getByRole('button', { name: '目前方案' });
    expect((currentPlanButton as HTMLButtonElement).disabled).toBe(true);
  });

  it('still shows a flat monthly price for Free and Pro', () => {
    renderPage();
    expect(screen.getByText('$0')).toBeTruthy();
    expect(screen.getByText('$29')).toBeTruthy();
  });
});
