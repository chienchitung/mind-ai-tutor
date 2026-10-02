'use client';

import { useMemo, useState, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import { Bot, ChevronDown, MessageSquareText, Search, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { searchChatSessions, summarizeChat, type ChatSession } from '../lib/chat-insights';

const PAGE_SIZE = 8;
const LONG_REPLY = 420;

function StatTile({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-xl font-semibold text-foreground" title={typeof value === 'string' ? value : undefined}>{value}</p>
      {hint && <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Highlight({ text, query }: { text: string; query: string }) {
  const needle = query.trim();
  if (!needle) return <>{text}</>;
  const parts = text.split(new RegExp(`(${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return (
    <>
      {parts.map((part, index) => (index % 2 === 1
        ? <mark key={index} className="rounded-sm bg-amber-200 px-0.5 text-foreground">{part}</mark>
        : part))}
    </>
  );
}

// AI tutor replies are Markdown. Rendered small and without raw HTML - the
// text comes from the game's chat log, so it's treated as untrusted.
function CompactMarkdown({ content }: { content: string }) {
  return (
    <div className="space-y-2 break-words text-sm leading-6 [&_code]:rounded [&_code]:bg-background/70 [&_code]:px-1 [&_code]:font-mono [&_code]:text-[0.85em] [&_li]:ml-4 [&_ol]:list-decimal [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-background/70 [&_pre]:p-2 [&_strong]:font-semibold [&_ul]:list-disc [&_h1]:font-semibold [&_h2]:font-semibold [&_h3]:font-semibold">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>{content}</ReactMarkdown>
    </div>
  );
}

function AiReply({ content, chinese }: { content: string; chinese: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const long = content.length > LONG_REPLY;
  return (
    <div>
      <div className={long && !expanded ? 'relative max-h-40 overflow-hidden' : undefined}>
        <CompactMarkdown content={content} />
        {long && !expanded && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-muted to-transparent" />
        )}
      </div>
      {long && (
        <button
          type="button"
          onClick={() => setExpanded(value => !value)}
          className="mt-1 text-xs font-medium text-foreground/70 underline-offset-2 hover:underline"
        >
          {expanded ? (chinese ? '收合回覆' : 'Show less') : (chinese ? '展開完整回覆' : 'Show full reply')}
        </button>
      )}
    </div>
  );
}

function SessionCard({
  session,
  chinese,
  query,
  defaultOpen,
  formatTime,
}: {
  session: ChatSession;
  chinese: boolean;
  query: string;
  defaultOpen: boolean;
  formatTime: (time: number) => string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = `chat-session-${session.id}`;

  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{session.lessonTitle}</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {formatTime(session.startedAt)} · {chinese ? `${session.questionCount} 則提問` : `${session.questionCount} questions`}
          </span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {open && (
        <ol id={panelId} className="space-y-3 border-t bg-background/60 px-4 py-4">
          {session.messages.map(message => (message.is_user ? (
            <li key={message.id} className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-sm leading-6 text-primary-foreground">
                <span className="sr-only">{chinese ? '學生：' : 'Student: '}</span>
                <p className="whitespace-pre-wrap break-words"><Highlight text={message.message_content} query={query} /></p>
              </div>
            </li>
          ) : (
            <li key={message.id} className="flex items-start gap-2">
              <span className="mt-1 rounded-full border bg-background p-1 text-muted-foreground" aria-hidden="true">
                <Bot className="h-3.5 w-3.5" />
              </span>
              <div className="max-w-[85%] rounded-2xl rounded-tl-md bg-muted px-3.5 py-2 text-foreground/90">
                <span className="sr-only">{chinese ? 'AI 助教：' : 'AI tutor: '}</span>
                <AiReply content={message.message_content} chinese={chinese} />
              </div>
            </li>
          )))}
        </ol>
      )}
    </section>
  );
}

export function ChatInsights({
  sessions,
  chinese,
  loadFailed,
  onRetry,
}: {
  sessions: ChatSession[];
  chinese: boolean;
  loadFailed: boolean;
  onRetry: () => void;
}) {
  const [query, setQuery] = useState('');
  const [visible, setVisible] = useState(PAGE_SIZE);
  const summary = useMemo(() => summarizeChat(sessions), [sessions]);
  const matches = useMemo(() => searchChatSessions(sessions, query), [sessions, query]);

  const formatTime = (time: number) => new Date(time).toLocaleString(chinese ? 'zh-TW' : 'en-US', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });

  if (loadFailed) {
    return (
      <div role="alert" className="flex flex-col items-center gap-3 py-10 text-center text-sm text-muted-foreground">
        <p>{chinese ? 'AI 對話紀錄載入失敗，其他報表資料不受影響。' : "Couldn't load AI tutor conversations. The rest of the report is unaffected."}</p>
        <Button variant="outline" size="sm" onClick={onRetry}>{chinese ? '重新載入' : 'Retry'}</Button>
      </div>
    );
  }

  if (!sessions.length) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center">
        <MessageSquareText className="h-8 w-8 text-muted-foreground/60" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">
          {chinese ? '這段期間沒有與 AI 助教的對話紀錄。' : 'No AI tutor conversations in this period.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label={chinese ? '學生提問' : 'Student questions'}
          value={chinese ? `${summary.questions} 則` : summary.questions}
          hint={chinese ? `AI 回覆 ${summary.replies} 則` : `${summary.replies} AI replies`}
        />
        <StatTile
          label={chinese ? '對話次數' : 'Conversations'}
          value={chinese ? `${summary.sessions} 段` : summary.sessions}
          hint={chinese ? `涵蓋 ${summary.lessons} 個課程` : `across ${summary.lessons} lessons`}
        />
        <StatTile
          label={chinese ? '平均提問長度' : 'Avg. question length'}
          value={chinese ? `${summary.averageQuestionLength} 字` : `${summary.averageQuestionLength} chars`}
          hint={chinese ? '越長通常代表描述越完整' : 'Longer usually means more context'}
        />
        <StatTile
          label={chinese ? '提問最多的課程' : 'Most questions in'}
          value={summary.topLesson?.title ?? '-'}
          hint={summary.topLesson ? (chinese ? `${summary.topLesson.questions} 則提問` : `${summary.topLesson.questions} questions`) : undefined}
        />
      </div>

      <p className="flex items-start gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs leading-5 text-muted-foreground">
        <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {chinese
          ? '產生「AI 學習分析」時會一併分析這些提問內容（提問主題、卡關的觀念、求助方式），結果在「AI 對話洞察」段落。'
          : 'The AI learning analysis also reads these questions (topics, sticking points, help-seeking style) and reports on them under "AI tutor conversation insights".'}
      </p>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          value={query}
          onChange={event => { setQuery(event.target.value); setVisible(PAGE_SIZE); }}
          placeholder={chinese ? '搜尋對話內容或課程名稱' : 'Search conversations or lessons'}
          aria-label={chinese ? '搜尋對話內容' : 'Search conversations'}
          className="pl-9"
        />
      </div>

      {matches.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {chinese ? `找不到包含「${query.trim()}」的對話。` : `No conversations mention "${query.trim()}".`}
        </p>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {chinese
              ? `共 ${matches.length} 段對話，由新到舊`
              : `${matches.length} conversations, newest first`}
          </p>
          {matches.slice(0, visible).map((session, index) => (
            <SessionCard
              // Re-mount when a search starts or clears so matching
              // conversations open and the default view collapses again.
              key={`${session.id}:${query.trim() ? 'search' : 'browse'}`}
              session={session}
              chinese={chinese}
              query={query}
              defaultOpen={index === 0 || Boolean(query.trim())}
              formatTime={formatTime}
            />
          ))}
          {matches.length > visible && (
            <Button variant="outline" size="sm" className="w-full" onClick={() => setVisible(count => count + PAGE_SIZE)}>
              {chinese ? `顯示更多（還有 ${matches.length - visible} 段）` : `Show more (${matches.length - visible} left)`}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
