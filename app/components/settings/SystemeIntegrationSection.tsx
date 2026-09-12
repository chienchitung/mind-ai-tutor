'use client';

import { useEffect, useState } from 'react';
import { Check, Copy, Eye, EyeOff, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';

interface Integration {
  webhook_token: string;
  webhook_secret: string;
  created_at: string;
}

// One systeme.io Workflow per row: trigger name is exactly what systeme.io
// shows in its Workflow trigger picker (see help.systeme.io's workflow
// feature article), each wired to a "Send Webhook" action posting to this
// URL. The event type rides in the URL's `event` query param rather than
// the payload body - see app/api/webhooks/systeme/[token]/route.ts.
const EVENT_ROWS: { type: string; trigger: string; labelZh: string; labelEn: string }[] = [
  { type: 'enrolled_in_course', trigger: 'Enrolled in course', labelZh: '學生註冊課程', labelEn: 'Student enrolls in a course' },
  { type: 'lecture_completed', trigger: 'Lecture completed', labelZh: '完成一堂課', labelEn: 'Student completes a lecture' },
  { type: 'module_completed', trigger: 'Module completed', labelZh: '完成一個模組', labelEn: 'Student completes a module' },
  { type: 'course_completed', trigger: 'Course completed', labelZh: '完成整門課程', labelEn: 'Student completes the course' },
];

function CopyField({ value, mono = true }: { value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API can be unavailable (non-secure context, permissions) -
      // the value is still selectable text, so this is a non-fatal no-op.
    }
  };
  return (
    <div className="flex items-center gap-2">
      <code className={`flex-1 min-w-0 truncate rounded border bg-muted/40 px-2 py-1.5 text-xs ${mono ? 'font-mono' : ''}`}>
        {value}
      </code>
      <Button type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={copy}>
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}

export function SystemeIntegrationSection() {
  const { language } = useLanguage();
  const zh = language === 'zh-TW';
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [integration, setIntegration] = useState<Integration | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/integrations/systeme');
      if (!response.ok) throw new Error();
      setIntegration(await response.json());
    } catch {
      setIntegration(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const rotate = async () => {
    const confirmed = window.confirm(
      zh
        ? '重新產生後，舊的 Webhook 網址與金鑰會立刻失效，Systeme.io 那邊也要跟著更新，確定要繼續嗎？'
        : 'Regenerating immediately invalidates the old webhook URLs and secret - you will need to update them in systeme.io too. Continue?'
    );
    if (!confirmed) return;
    setBusy(true);
    try {
      const response = await fetch('/api/integrations/systeme', { method: 'POST' });
      if (!response.ok) throw new Error();
      setIntegration(await response.json());
      setShowSecret(false);
      toast({ title: zh ? '已重新產生' : 'Regenerated' });
    } catch {
      toast({ title: zh ? '重新產生失敗' : 'Failed to regenerate', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="border-t pt-5"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  if (!integration) {
    return (
      <div className="border-t pt-5">
        <p className="text-sm text-muted-foreground">
          {zh ? '載入串接設定失敗，請重新整理頁面再試一次。' : 'Failed to load integration settings - please refresh and try again.'}
        </p>
      </div>
    );
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const baseUrl = `${origin}/api/webhooks/systeme/${integration.webhook_token}`;

  return (
    <div className="space-y-5 border-t pt-5">
      <div>
        <h3 className="text-lg font-medium">{zh ? 'Systeme.io 課程串接' : 'Systeme.io course integration'}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {zh
            ? '在 Systeme.io 後台的 Automations → Workflows 建立下面 4 個觸發條件，動作都選「Send Webhook」，把對應的網址貼進去，並在 Secret key 欄位貼上下方的簽章金鑰。學生的完課紀錄就會依 email 對上你在「學生」頁面建立的名單。'
            : 'In systeme.io, go to Automations → Workflows and create one workflow per trigger below, each with a "Send Webhook" action pointing at the matching URL. Paste the signing secret below into that action\'s secret key field. Events are matched to your roster in the Students page by contact email.'}
        </p>
      </div>

      <div className="space-y-2">
        <Label>{zh ? '簽章金鑰（Secret key）' : 'Signing secret'}</Label>
        <div className="flex items-center gap-2">
          <CopyField value={showSecret ? integration.webhook_secret : '•'.repeat(24)} />
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setShowSecret(s => !s)} aria-label={zh ? '顯示/隱藏金鑰' : 'Show/hide secret'}>
            {showSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {EVENT_ROWS.map(row => (
          <div key={row.type} className="space-y-1.5 rounded-lg border p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <span className="text-sm font-medium">{zh ? row.labelZh : row.labelEn}</span>
              <span className="text-xs text-muted-foreground">
                {zh ? 'Systeme.io 觸發條件：' : 'systeme.io trigger: '}<code className="font-mono">{row.trigger}</code>
              </span>
            </div>
            <CopyField value={`${baseUrl}?event=${row.type}`} />
          </div>
        ))}
      </div>

      <Button type="button" variant="outline" size="sm" disabled={busy} onClick={rotate}>
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
        {zh ? '重新產生網址與金鑰' : 'Regenerate URLs & secret'}
      </Button>
    </div>
  );
}
