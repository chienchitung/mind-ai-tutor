// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TeamWorkspaceSection } from './TeamWorkspaceSection';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  rpc: vi.fn(),
  toast: vi.fn(),
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

beforeEach(() => {
  vi.clearAllMocks();
  window.confirm = vi.fn(() => true);
});

afterEach(() => {
  cleanup();
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

  it('invites a member by email', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: OWNER_ID } } });
    mocks.rpc
      .mockResolvedValueOnce({ data: membersRow([{ member_user_id: OWNER_ID, email: 'owner@example.com', role: 'owner' }]), error: null })
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({
        data: membersRow([
          { member_user_id: OWNER_ID, email: 'owner@example.com', role: 'owner' },
          { member_user_id: MEMBER_ID, email: 'new@example.com', role: 'member' },
        ]),
        error: null,
      });

    render(<TeamWorkspaceSection />);
    const emailInput = await screen.findByLabelText('邀請成員（email）');
    fireEvent.change(emailInput, { target: { value: 'new@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: '邀請' }));

    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith('invite_team_member', { p_email: 'new@example.com' }));
    expect(await screen.findByText('new@example.com')).toBeTruthy();
  });

  it('surfaces a known RPC error as a friendly message', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: OWNER_ID } } });
    mocks.rpc
      .mockResolvedValueOnce({ data: membersRow([{ member_user_id: OWNER_ID, email: 'owner@example.com', role: 'owner' }]), error: null })
      .mockResolvedValueOnce({ data: null, error: new Error('ALREADY_IN_A_TEAM') });

    render(<TeamWorkspaceSection />);
    const emailInput = await screen.findByLabelText('邀請成員（email）');
    fireEvent.change(emailInput, { target: { value: 'taken@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: '邀請' }));

    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({
      description: '這個帳號已經在其他工作區了，一個帳號只能屬於一個工作區。',
    })));
  });

  it('surfaces an unrecognized RPC error message instead of hiding it behind a generic one', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: OWNER_ID } } });
    mocks.rpc
      .mockResolvedValueOnce({ data: membersRow([{ member_user_id: OWNER_ID, email: 'owner@example.com', role: 'owner' }]), error: null })
      .mockResolvedValueOnce({ data: null, error: new Error('column reference "user_id" is ambiguous') });

    render(<TeamWorkspaceSection />);
    const emailInput = await screen.findByLabelText('邀請成員（email）');
    fireEvent.change(emailInput, { target: { value: 'someone@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: '邀請' }));

    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({
      description: '發生未預期的錯誤: column reference "user_id" is ambiguous',
    })));
  });
});
