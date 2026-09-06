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
  it('shows custom pricing (not a fixed figure) for Enterprise', () => {
    renderPage();
    expect(screen.getByText('客製化報價')).toBeTruthy();
    expect(screen.queryByText('NT$99')).toBeNull();
  });

  it('lets Enterprise contact sales directly, unlike Free/Pro which stay disabled', async () => {
    renderPage();
    const contactButton = screen.getByRole('button', { name: '聯繫銷售' });
    expect((contactButton as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(contactButton);
    expect(window.open).toHaveBeenCalledWith('mailto:contact@mindaitutor.com');

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

  it('shows a flat monthly TWD price for Free and Pro by default', () => {
    renderPage();
    expect(screen.getByText('NT$0')).toBeTruthy();
    expect(screen.getByText('NT$899')).toBeTruthy();
  });

  it('switches to annual pricing (with a savings note on Pro only) when that toggle is picked', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: '年繳（送2個月）' }));

    expect(screen.getByText('NT$0')).toBeTruthy();
    expect(screen.getByText('NT$8,990')).toBeTruthy();
    expect(screen.queryByText('NT$899')).toBeNull();
    expect(screen.getByText('相當於買10個月，送2個月')).toBeTruthy();
    // Enterprise keeps showing custom pricing regardless of the toggle.
    expect(screen.getByText('客製化報價')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '月繳' }));
    expect(screen.getByText('NT$899')).toBeTruthy();
    expect(screen.queryByText('NT$8,990')).toBeNull();
    expect(screen.queryByText('相當於買10個月，送2個月')).toBeNull();
  });

  it('shows each plan\'s monthly AI point allowance instead of a plain "AI tools" checkmark', () => {
    renderPage();
    expect(screen.getByText('每月 1,000 AI 點數')).toBeTruthy();
    expect(screen.getByText('每月 5,000 AI 點數')).toBeTruthy();
    expect(screen.getByText('無限 AI 點數')).toBeTruthy();
  });

  it('does not show the old redundant "need a custom plan" callout below the pricing grid', () => {
    renderPage();
    expect(screen.queryByText('需要客製化方案？')).toBeNull();
    // Only the Enterprise card's own button should offer to contact sales.
    expect(screen.getAllByRole('button', { name: '聯繫銷售' })).toHaveLength(1);
  });
});
