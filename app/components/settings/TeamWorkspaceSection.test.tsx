// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TeamWorkspaceSection } from './TeamWorkspaceSection';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  rpc: vi.fn(),
  toast: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: () => ({
    auth: { getUser: mocks.getUser },
    rpc: mocks.rpc,
  }),
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/app/contexts/LanguageContext', () => ({ useLanguage: () => ({ language: 'zh-TW' }) }));

const OWNER_ID = 'owner-1';
const MEMBER_ID = 'member-1';

function membersRow(overrides: Partial<{ member_user_id: string; email: string; role: 'owner' | 'member' }>[] = []) {
  return overrides;
}

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: async () => body } as Response;
}

beforeEach(() => {
  vi.clearAllMocks();
  window.confirm = vi.fn(() => true);
  vi.stubGlobal('fetch', mocks.fetch);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('TeamWorkspaceSection', () => {
  it('shows a create-workspace form when the user has no team yet', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: OWNER_ID } } });
    mocks.rpc.mockResolvedValue({ data: [], error: null });

    render(<TeamWorkspaceSection />);

    expect(await screen.findByRole('button', { name: '建立工作區' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '邀請' })).toBeNull();
  });

  it('lets the owner see every member, invite, and remove others but not themself', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: OWNER_ID } } });
    mocks.rpc.mockResolvedValue({
      data: membersRow([
        { member_user_id: OWNER_ID, email: 'owner@example.com', role: 'owner' },
        { member_user_id: MEMBER_ID, email: 'member@example.com', role: 'member' },
      ]),
      error: null,
    });

    render(<TeamWorkspaceSection />);

    expect(await screen.findByText('owner@example.com')).toBeTruthy();
    expect(screen.getByText('member@example.com')).toBeTruthy();
    expect(screen.getByRole('button', { name: '邀請' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '移除 member@example.com' })).toBeTruthy();
    // The owner's own row has no remove/leave control - they can't leave their own workspace.
    expect(screen.queryByRole('button', { name: '離開工作區' })).toBeNull();
  });

  it('lets a non-owner member leave but not invite or remove others', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: MEMBER_ID } } });
    mocks.rpc.mockResolvedValue({
      data: membersRow([
        { member_user_id: OWNER_ID, email: 'owner@example.com', role: 'owner' },
        { member_user_id: MEMBER_ID, email: 'member@example.com', role: 'member' },
      ]),
      error: null,
    });

    render(<TeamWorkspaceSection />);

    expect(await screen.findByText('owner@example.com')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '邀請' })).toBeNull();
    expect(screen.getByRole('button', { name: '離開工作區' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '移除 owner@example.com' })).toBeNull();
  });

  it('creates a workspace and reloads the member list', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: OWNER_ID } } });
    mocks.rpc
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: membersRow([{ member_user_id: OWNER_ID, email: 'owner@example.com', role: 'owner' }]), error: null });

    render(<TeamWorkspaceSection />);
    fireEvent.click(await screen.findByRole('button', { name: '建立工作區' }));

    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith('create_team', { p_name: null }));
    expect(await screen.findByText('owner@example.com')).toBeTruthy();
  });

  it('invites an existing account by email', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: OWNER_ID } } });
    mocks.rpc
      .mockResolvedValueOnce({ data: membersRow([{ member_user_id: OWNER_ID, email: 'owner@example.com', role: 'owner' }]), error: null })
      .mockResolvedValueOnce({
        data: membersRow([
          { member_user_id: OWNER_ID, email: 'owner@example.com', role: 'owner' },
          { member_user_id: MEMBER_ID, email: 'new@example.com', role: 'member' },
        ]),
        error: null,
      });
    mocks.fetch.mockResolvedValue(jsonResponse({ status: 'added' }));

    render(<TeamWorkspaceSection />);
    const emailInput = await screen.findByLabelText('邀請成員（email）');
    fireEvent.change(emailInput, { target: { value: 'new@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: '邀請' }));

    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledWith('/api/team/invite', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ email: 'new@example.com' }),
    })));
    expect(await screen.findByText('new@example.com')).toBeTruthy();
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: '已加入工作區' }));
  });

  it('sends an invite email for an unregistered address and reports it distinctly', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: OWNER_ID } } });
    mocks.rpc.mockResolvedValue({ data: membersRow([{ member_user_id: OWNER_ID, email: 'owner@example.com', role: 'owner' }]), error: null });
    mocks.fetch.mockResolvedValue(jsonResponse({ status: 'invited' }));

    render(<TeamWorkspaceSection />);
    const emailInput = await screen.findByLabelText('邀請成員（email）');
    fireEvent.change(emailInput, { target: { value: 'newcomer@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: '邀請' }));

    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({
      title: '邀請信已寄出',
      description: '對方收到信、完成註冊後就會自動加入。',
    })));
  });

  it('surfaces a known error as a friendly message', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: OWNER_ID } } });
    mocks.rpc.mockResolvedValue({ data: membersRow([{ member_user_id: OWNER_ID, email: 'owner@example.com', role: 'owner' }]), error: null });
    mocks.fetch.mockResolvedValue(jsonResponse({ error: 'ALREADY_IN_A_TEAM' }, false));

    render(<TeamWorkspaceSection />);
    const emailInput = await screen.findByLabelText('邀請成員（email）');
    fireEvent.change(emailInput, { target: { value: 'taken@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: '邀請' }));

    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({
      description: '這個帳號已經在其他工作區了，一個帳號只能屬於一個工作區。',
    })));
  });

  it('surfaces an unrecognized error message instead of hiding it behind a generic one', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: OWNER_ID } } });
    mocks.rpc.mockResolvedValue({ data: membersRow([{ member_user_id: OWNER_ID, email: 'owner@example.com', role: 'owner' }]), error: null });
    mocks.fetch.mockResolvedValue(jsonResponse({ error: 'column reference "user_id" is ambiguous' }, false));

    render(<TeamWorkspaceSection />);
    const emailInput = await screen.findByLabelText('邀請成員（email）');
    fireEvent.change(emailInput, { target: { value: 'someone@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: '邀請' }));

    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({
      description: '發生未預期的錯誤: column reference "user_id" is ambiguous',
    })));
  });

  it('shares existing data across all resource types and reports a combined breakdown', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: MEMBER_ID } } });
    mocks.rpc.mockImplementation((name: string) => {
      if (name === 'list_team_members') {
        return Promise.resolve({
          data: membersRow([
            { member_user_id: OWNER_ID, email: 'owner@example.com', role: 'owner' },
            { member_user_id: MEMBER_ID, email: 'member@example.com', role: 'member' },
          ]),
          error: null,
        });
      }
      const counts: Record<string, number> = {
        share_my_events_with_team: 12,
        share_my_lessons_with_team: 3,
        share_my_feedback_with_team: 0,
        share_my_digital_games_with_team: 1,
      };
      return Promise.resolve({ data: counts[name] ?? 0, error: null });
    });

    render(<TeamWorkspaceSection />);
    fireEvent.click(await screen.findByRole('button', { name: '分享我的舊資料' }));

    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith('share_my_digital_games_with_team'));
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({
      title: '已分享',
      description: '已把12 筆活動、3 筆課程、1 筆數位遊戲加入工作區，其他成員現在看得到。',
    }));
  });

  it('reports when there was nothing left to share', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: OWNER_ID } } });
    mocks.rpc.mockImplementation((name: string) => {
      if (name === 'list_team_members') {
        return Promise.resolve({ data: membersRow([{ member_user_id: OWNER_ID, email: 'owner@example.com', role: 'owner' }]), error: null });
      }
      return Promise.resolve({ data: 0, error: null });
    });

    render(<TeamWorkspaceSection />);
    fireEvent.click(await screen.findByRole('button', { name: '分享我的舊資料' }));

    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({
      title: '已分享',
      description: '沒有可以分享的資料——你的資料應該都已經在工作區裡了。',
    })));
  });

  it('surfaces a failure to share as an error toast when every resource fails', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: OWNER_ID } } });
    mocks.rpc.mockImplementation((name: string) => {
      if (name === 'list_team_members') {
        return Promise.resolve({ data: membersRow([{ member_user_id: OWNER_ID, email: 'owner@example.com', role: 'owner' }]), error: null });
      }
      return Promise.resolve({ data: null, error: new Error('NO_TEAM') });
    });

    render(<TeamWorkspaceSection />);
    fireEvent.click(await screen.findByRole('button', { name: '分享我的舊資料' }));

    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({
      title: '分享失敗',
      description: '你目前不屬於任何工作區。',
    })));
  });
});
