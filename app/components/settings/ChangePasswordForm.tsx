'use client';

import { useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { validatePasswordChange } from '@/lib/password-validation';

export function ChangePasswordForm() {
  const { language } = useLanguage();
  const zh = language === 'zh-TW';
  const { toast } = useToast();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [nonce, setNonce] = useState('');
  const [needsVerification, setNeedsVerification] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  const sendVerification = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const { supabase } = await import('@/lib/supabase');
      const { error } = await supabase().auth.reauthenticate();
      if (error) throw error;
      setNotice(zh ? '驗證碼已寄送至帳號的驗證信箱／電話，請填入後再次送出。' : 'A verification code was sent to your verified email or phone. Enter it and submit again.');
    } catch (error) {
      setError(error instanceof Error ? error.message : (zh ? '無法寄送驗證碼，請稍後重試。' : 'Unable to send a verification code. Please retry.'));
    } finally { inFlight.current = false; setBusy(false); }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (inFlight.current) return;
    setError(null);
    const invalid = validatePasswordChange(password, confirmation);
    if (invalid) {
      setError(invalid === 'mismatch'
        ? (zh ? '兩次密碼不一致。' : 'Passwords do not match.')
        : (zh ? '密碼需為 8–72 個字元。' : 'Use a password between 8 and 72 characters.'));
      return;
    }
    inFlight.current = true;
    setBusy(true);
    try {
      const { supabase } = await import('@/lib/supabase');
      const client = supabase();
      const { data: { user }, error: authError } = await client.auth.getUser();
      if (authError || !user) throw new Error(zh ? '登入已失效，請重新登入。' : 'Your session expired. Please sign in again.');
      const { error } = await client.auth.updateUser({ password, ...(needsVerification ? { nonce: nonce.trim() } : {}) });
      if (error?.code === 'reauthentication_needed') {
        setNeedsVerification(true);
        setError(zh ? '需要重新驗證身分。請寄送並輸入驗證碼，再次更新密碼。' : 'Reauthentication is required. Send and enter a verification code, then update again.');
        return;
      }
      if (error) throw error;
      setPassword(''); setConfirmation(''); setNonce(''); setNotice(null); setNeedsVerification(false);
      toast({ title: zh ? '密碼已更新' : 'Password updated', description: zh ? '下次以密碼登入時請使用新密碼。' : 'Use your new password the next time you sign in with a password.' });
    } catch (error) {
      setError(error instanceof Error ? error.message : (zh ? '無法更新密碼，請稍後重試。' : 'Unable to update your password. Please retry.'));
    } finally { inFlight.current = false; setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="space-y-4 border-t pt-5" aria-busy={busy}>
      <div>
        <h3 className="text-lg font-medium">{zh ? '變更密碼' : 'Change password'}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{zh ? '設定此平台的登入密碼，不會更改 Google 等第三方帳號的密碼。' : 'This changes your password for this platform, not for Google or other external accounts.'}</p>
      </div>
      <fieldset disabled={busy} className="min-w-0 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="settings-new-password">{zh ? '新密碼' : 'New password'}</Label>
            <Input id="settings-new-password" type="password" autoComplete="new-password" minLength={8} maxLength={72} required value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="settings-confirm-password">{zh ? '確認新密碼' : 'Confirm new password'}</Label>
            <Input id="settings-confirm-password" type="password" autoComplete="new-password" minLength={8} maxLength={72} required value={confirmation} onChange={e => setConfirmation(e.target.value)} />
          </div>
        </div>
        {needsVerification && <div className="space-y-2">
          <Label htmlFor="settings-password-nonce">{zh ? '驗證碼' : 'Verification code'}</Label>
          <div className="flex flex-wrap gap-2">
            <Input id="settings-password-nonce" className="w-48" autoComplete="one-time-code" inputMode="numeric" required value={nonce} onChange={e => setNonce(e.target.value)} />
            <Button type="button" variant="outline" onClick={() => void sendVerification()}>{zh ? '寄送驗證碼' : 'Send code'}</Button>
          </div>
        </div>}
        <Button type="submit">{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{zh ? (busy ? '處理中…' : '更新密碼') : (busy ? 'Processing…' : 'Update password')}</Button>
      </fieldset>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}
    </form>
  );
}
