'use client';

import { useEffect, useState } from 'react';
import { Loader2, UserPlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';

interface Member {
  member_user_id: string;
  email: string;
  role: 'owner' | 'member';
  joined_at: string;
}

// Maps the RPCs' RAISE EXCEPTION messages (scripts/add_team_workspaces.sql)
// to user-facing text. Matched with includes() since PostgREST may wrap the
// raw message rather than passing it through byte-for-byte.
function describeError(message: string, zh: boolean): string {
  const known: Record<string, [string, string]> = {
    ALREADY_IN_A_TEAM: ['這個帳號已經在其他工作區了，一個帳號只能屬於一個工作區。', 'That account already belongs to another workspace - one workspace per account.'],
    USER_NOT_FOUND: ['找不到這個 email 的帳號，請確認對方已經註冊。', "No account found for that email - make sure they've signed up first."],
    CANNOT_INVITE_SELF: ['不能邀請自己。', "You can't invite yourself."],
    FORBIDDEN: ['只有工作區擁有者能做這個操作。', 'Only the workspace owner can do that.'],
    OWNER_CANNOT_LEAVE: ['擁有者無法離開自己建立的工作區。', "The owner can't leave their own workspace."],
    NO_TEAM: ['你目前不屬於任何工作區。', "You don't belong to a workspace yet."],
  };
  for (const [code, [zhMsg, enMsg]] of Object.entries(known)) {
    if (message.includes(code)) return zh ? zhMsg : enMsg;
  }
  // An error outside the RPCs' own known codes (e.g. a genuine SQL bug) is
  // exactly the case that needs the real message visible, not hidden behind
  // a generic "something went wrong" with nothing to go on.
  const fallback = zh ? '發生未預期的錯誤' : 'Unexpected error';
  return message ? `${fallback}: ${message}` : `${fallback}.`;
}

export function TeamWorkspaceSection() {
  const { language } = useLanguage();
  const zh = language === 'zh-TW';
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[] | null>(null);
  const [teamName, setTeamName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const { supabase } = await import('@/lib/supabase');
    const client = supabase();
    const [{ data: { user } }, { data, error }] = await Promise.all([
      client.auth.getUser(),
      client.rpc('list_team_members'),
    ]);
    setUserId(user?.id ?? null);
    if (error) {
      setMembers([]);
    } else {
      setMembers((data as Member[] | null) ?? []);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const myRole = members?.find(m => m.member_user_id === userId)?.role ?? null;

  const createTeam = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const { supabase } = await import('@/lib/supabase');
      const { error } = await supabase().rpc('create_team', { p_name: teamName.trim() || null });
      if (error) throw error;
      setTeamName('');
      toast({ title: zh ? '工作區已建立' : 'Workspace created' });
      await load();
    } catch (error) {
      toast({ title: zh ? '建立失敗' : 'Failed to create', description: describeError(error instanceof Error ? error.message : '', zh), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const inviteMember = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!inviteEmail.trim()) return;
    setBusy(true);
    try {
      const { supabase } = await import('@/lib/supabase');
      const { error } = await supabase().rpc('invite_team_member', { p_email: inviteEmail.trim() });
      if (error) throw error;
      setInviteEmail('');
      toast({ title: zh ? '已加入工作區' : 'Added to the workspace' });
      await load();
    } catch (error) {
      toast({ title: zh ? '邀請失敗' : 'Failed to invite', description: describeError(error instanceof Error ? error.message : '', zh), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const removeMember = async (target: Member) => {
    const isSelf = target.member_user_id === userId;
    const question = isSelf
      ? (zh ? '確定要離開這個工作區嗎？' : 'Leave this workspace?')
      : (zh ? `確定要把 ${target.email} 移出工作區嗎？` : `Remove ${target.email} from the workspace?`);
    if (!window.confirm(question)) return;
    setBusy(true);
    try {
      const { supabase } = await import('@/lib/supabase');
      const { error } = await supabase().rpc('remove_team_member', { p_user_id: target.member_user_id });
      if (error) throw error;
      toast({ title: isSelf ? (zh ? '已離開工作區' : 'Left the workspace') : (zh ? '已移除成員' : 'Member removed') });
      await load();
    } catch (error) {
      toast({ title: zh ? '操作失敗' : 'Failed', description: describeError(error instanceof Error ? error.message : '', zh), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="border-t pt-5"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  const hasTeam = (members?.length ?? 0) > 0;

  return (
    <div className="space-y-4 border-t pt-5">
      <div>
        <h3 className="text-lg font-medium">{zh ? '工作區成員' : 'Workspace members'}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {zh ? '邀請同事加入你的工作區，一起共用同一批課程、活動與資料。' : 'Invite colleagues into your workspace to co-edit the same lessons, events, and data.'}
        </p>
      </div>

      {!hasTeam ? (
        <form onSubmit={createTeam} className="space-y-3" aria-busy={busy}>
          <div className="space-y-2 max-w-sm">
            <Label htmlFor="team-name">{zh ? '工作區名稱（選填）' : 'Workspace name (optional)'}</Label>
            <Input id="team-name" value={teamName} onChange={e => setTeamName(e.target.value)} placeholder={zh ? '我的工作區' : 'My workspace'} disabled={busy} />
          </div>
          <Button type="submit" disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {zh ? '建立工作區' : 'Create workspace'}
          </Button>
        </form>
      ) : (
        <>
          <ul className="divide-y rounded-lg border">
            {members!.map(member => (
              <li key={member.member_user_id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{member.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {member.role === 'owner' ? (zh ? '擁有者' : 'Owner') : (zh ? '成員' : 'Member')}
                  </p>
                </div>
                {(myRole === 'owner' || member.member_user_id === userId) && !(member.role === 'owner' && member.member_user_id === userId) && (
                  <Button type="button" variant="ghost" size="icon" disabled={busy} onClick={() => removeMember(member)} aria-label={member.member_user_id === userId ? (zh ? '離開工作區' : 'Leave workspace') : (zh ? `移除 ${member.email}` : `Remove ${member.email}`)}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </li>
            ))}
          </ul>

          {myRole === 'owner' && (
            <form onSubmit={inviteMember} className="flex flex-wrap items-end gap-2" aria-busy={busy}>
              <div className="space-y-2">
                <Label htmlFor="invite-email">{zh ? '邀請成員（email）' : 'Invite a member (email)'}</Label>
                <Input id="invite-email" type="email" className="w-64" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="teacher@example.com" disabled={busy} required />
              </div>
              <Button type="submit" disabled={busy}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                {zh ? '邀請' : 'Invite'}
              </Button>
            </form>
          )}
        </>
      )}
    </div>
  );
}
