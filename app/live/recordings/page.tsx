'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, Mic, Search } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { RecordingList } from '@/components/live/RecordingList';
import { useLanguage } from '@/app/contexts/LanguageContext';
import type { RecordingMatch, RecordingSummary } from '@/lib/live-recording';

type Filter = 'all' | 'notes' | 'todo';

// Every lecture recording the teacher has made, across sessions - including
// ones whose session was deleted - so notes can be found without opening
// each session's workspace.
export default function LiveRecordingsPage() {
  const { language } = useLanguage();
  const zh = language === 'zh-TW';
  const say = (zhText: string, enText: string) => (zh ? zhText : enText);
  const [recordings, setRecordings] = useState<RecordingSummary[] | null>(null);
  const [error, setError] = useState<'not-ready' | 'failed' | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  // Recordings whose transcript or notes mention the query (searched on the
  // server), with where it was said.
  const [matches, setMatches] = useState<Record<string, RecordingMatch>>({});
  const [searching, setSearching] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/live-recordings', { cache: 'no-store' });
      const body = await response.json().catch(() => null);
      if (!response.ok || !Array.isArray(body)) {
        setError(body?.error === 'RECORDINGS_NOT_READY' ? 'not-ready' : 'failed');
        return;
      }
      setError(null);
      setRecordings(body);
    } catch {
      setError('failed');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const needle = query.trim();
  useEffect(() => {
    if (needle.length < 2) { setMatches({}); setSearching(false); return; }
    const controller = new AbortController();
    setSearching(true);
    const timer = setTimeout(() => {
      fetch(`/api/live-recordings/search?q=${encodeURIComponent(needle)}`, { cache: 'no-store', signal: controller.signal })
        .then((response) => (response.ok ? response.json() : {}))
        .then((body: Record<string, RecordingMatch> | null) => { setMatches(body && typeof body === 'object' ? body : {}); setSearching(false); })
        .catch(() => { if (!controller.signal.aborted) { setMatches({}); setSearching(false); } });
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [needle]);

  const visible = useMemo(() => {
    const lowered = needle.toLocaleLowerCase();
    return (recordings ?? []).filter((item) => {
      if (filter === 'notes' && !item.hasNotes) return false;
      if (filter === 'todo' && item.hasNotes) return false;
      if (!lowered) return true;
      return `${item.sessionTitle ?? ''} ${item.title}`.toLocaleLowerCase().includes(lowered) || !!matches[item.id];
    });
  }, [recordings, needle, filter, matches]);

  const withNotes = recordings?.filter((item) => item.hasNotes).length ?? 0;
  const total = recordings?.length ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        heading={say('錄音與教學筆記', 'Recordings & notes')}
        text={say('所有課堂錄音、逐字稿和教學筆記都在這裡，包含已刪除課程的錄音。', 'Every lecture recording, transcript and set of notes, including those from deleted sessions.')}
        actions={
          <Button asChild variant="outline" className="min-h-11">
            <Link href="/live/sessions">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {say('即時課程', 'Live sessions')}
            </Link>
          </Button>
        }
      />
      {error === 'not-ready' ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground md:pt-8">
            {say('錄音功能尚未啟用：請先在 Supabase 執行錄音功能的 migration。', 'Recording is not set up yet: run the lecture-recording migration in Supabase.')}
          </CardContent>
        </Card>
      ) : error === 'failed' ? (
        <Card>
          <CardContent className="space-y-4 p-8 text-center md:pt-8">
            <p role="alert" className="text-sm text-muted-foreground">{say('無法載入錄音紀錄。', 'Could not load recordings.')}</p>
            <Button variant="outline" onClick={() => void load()}>{say('重試', 'Try again')}</Button>
          </CardContent>
        </Card>
      ) : recordings === null ? (
        <div role="status" className="flex items-center justify-center gap-3 py-16 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          {say('載入中…', 'Loading…')}
        </div>
      ) : total === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center p-8 py-16 text-center md:pt-8">
            <Mic className="mb-5 h-8 w-8 text-muted-foreground" />
            <h2 className="text-lg font-semibold">{say('還沒有課堂錄音', 'No recordings yet')}</h2>
            <p className="mb-6 mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              {say('在即時課程的投影工作區按「開始錄音」，下課後就能在這裡整理成教學筆記。', 'Press “Start recording” in a live session workspace, then turn it into teaching notes here after class.')}
            </p>
            <Button asChild className="min-h-11">
              <Link href="/live/sessions">{say('前往即時課程', 'Go to live sessions')}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={say('搜尋課程名稱、逐字稿或筆記', 'Search sessions, transcripts or notes')}
                aria-label={say('搜尋課程名稱、逐字稿或筆記', 'Search sessions, transcripts or notes')}
                className="h-11 pl-9 pr-9"
              />
              {searching && <Loader2 aria-hidden="true" className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
            </div>
            <SegmentedControl
              label={say('篩選錄音', 'Filter recordings')}
              value={filter}
              onChange={setFilter}
              size="md"
              options={[
                { value: 'all' as const, label: say(`全部 ${total}`, `All ${total}`) },
                { value: 'notes' as const, label: say(`有筆記 ${withNotes}`, `With notes ${withNotes}`) },
                { value: 'todo' as const, label: say(`待整理 ${total - withNotes}`, `To do ${total - withNotes}`) },
              ]}
            />
          </div>
          {visible.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {searching ? say('搜尋中…', 'Searching…') : say('沒有符合的錄音。', 'No matching recordings.')}
            </p>
          ) : (
            <RecordingList
              recordings={visible}
              showSession
              matches={needle.length >= 2 ? matches : undefined}
              highlight={needle}
              onReload={() => void load()}
              onRemoved={(id) => setRecordings((previous) => previous?.filter((item) => item.id !== id) ?? previous)}
            />
          )}
        </>
      )}
    </div>
  );
}
