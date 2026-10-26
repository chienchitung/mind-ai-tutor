'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Copy, Download, Loader2, Play, Presentation, Star, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useCopyFeedback } from '@/hooks/useCopyFeedback';
import { cn } from '@/lib/utils';
import { formatClock, formatPages, joinTranscript, lessonNotesSchema, lessonNotesToMarkdown, transcriptParagraphs, type LessonNotes, type RecordingSegment } from '@/lib/live-recording';
import { DeckViewer } from './DeckViewer';

type Detail = { title: string; notes: LessonNotes | null; durationSeconds: number; segments: RecordingSegment[]; deckUrl?: string | null };

// The slide a part of the notes refers to, shown in place so a student can
// read the two side by side.
function SlidePreview({ url, pages, zh, onClose }: { url: string; pages: number[]; zh: boolean; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const page = pages[Math.min(index, pages.length - 1)];
  const say = (zhText: string, enText: string) => (zh ? zhText : enText);
  return (
    <div className="space-y-2 rounded-xl border bg-muted/30 p-2" role="group" aria-label={say(`投影片第 ${page} 頁`, `Slide ${page}`)}>
      {failed ? (
        <p className="py-6 text-center text-xs text-muted-foreground">{say('無法載入這份簡報。', 'Could not load the slides.')}</p>
      ) : (
        <div className="aspect-video w-full overflow-hidden rounded-lg bg-background">
          <DeckViewer url={url} page={page} onError={() => setFailed(true)} className="h-full w-full" />
        </div>
      )}
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          {pages.length > 1 && (
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" disabled={index === 0} aria-label={say('上一頁', 'Previous slide')} onClick={() => setIndex(index - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
          <span className="tabular-nums">{say(`第 ${page} 頁`, `Slide ${page}`)}</span>
          {pages.length > 1 && (
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" disabled={index >= pages.length - 1} aria-label={say('下一頁', 'Next slide')} onClick={() => setIndex(index + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={onClose}>
          <X className="mr-1 h-3.5 w-3.5" />
          {say('收起', 'Hide')}
        </Button>
      </div>
    </div>
  );
}

export function LectureNotesDialog({ recordingId, initialNotes, onClose }: {
  recordingId: string | null;
  initialNotes: LessonNotes | null;
  onClose: () => void;
}) {
  const { language } = useLanguage();
  const zh = language === 'zh-TW';
  const say = (zhText: string, enText: string) => (zh ? zhText : enText);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [failed, setFailed] = useState(false);
  const [view, setView] = useState<'notes' | 'transcript'>('notes');
  const { copy, reset: resetCopied, isCopied, tick } = useCopyFeedback();
  // Which slide preview is open (a section index, or "uncovered:<page>").
  const [preview, setPreview] = useState<{ key: string; pages: number[] } | null>(null);
  // A time in the notes was clicked: show that moment of the transcript.
  const [jump, setJump] = useState<{ seconds: number; key: string | null } | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!recordingId) return;
    let cancelled = false;
    setDetail(null);
    setFailed(false);
    setPreview(null);
    setJump(null);
    resetCopied();
    fetch(`/api/live-recordings/${recordingId}`, { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((body: Detail) => {
        if (cancelled) return;
        // Notes saved before a field existed get its default (e.g. emphasis).
        const raw = initialNotes ?? body.notes;
        const normalized = raw ? lessonNotesSchema.safeParse(raw) : null;
        const notes = normalized?.success ? normalized.data : raw;
        setDetail({ ...body, notes });
        setView(notes ? 'notes' : 'transcript');
      })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [recordingId, initialNotes, resetCopied]);

  useEffect(() => {
    if (view !== 'transcript' || !jump || jump.key) return;
    const rows = Array.from(transcriptRef.current?.querySelectorAll<HTMLElement>('[data-seconds]') ?? []);
    // The paragraph that was being spoken at that moment.
    const target = rows.filter((row) => Number(row.dataset.seconds) <= jump.seconds + 1).at(-1) ?? rows[0];
    if (!target) return;
    target.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
    setJump({ ...jump, key: target.dataset.key ?? null });
  }, [view, jump]);

  const notes = detail?.notes ?? null;
  const deckUrl = detail?.deckUrl ?? null;
  const togglePreview = (key: string, pages: number[]) =>
    setPreview((current) => (current?.key === key ? null : { key, pages }));
  const showMoment = (seconds: number) => {
    setJump({ seconds, key: null });
    setView('transcript');
  };
  const pageLabel = (pages: number[]) => say(`第 ${formatPages(pages)} 頁`, `Slide${pages.length > 1 ? 's' : ''} ${formatPages(pages)}`);
  const markdown = notes ? lessonNotesToMarkdown(notes, zh) : '';
  const transcriptText = joinTranscript(detail?.segments ?? []);

  const downloadText = (text: string, suffix: string) => {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(notes?.title || detail?.title || 'lesson').replace(/[\\/:*?"<>|]/g, '_')}-${suffix}.md`;
    // Chrome ignores the download name on a link that isn't in the document.
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1_000);
  };

  return (
    <Dialog open={recordingId !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[88dvh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle>{notes?.title ?? detail?.title ?? say('教學筆記', 'Teaching notes')}</DialogTitle>
          <DialogDescription>
            {detail ? say(`錄音長度 ${formatClock(detail.durationSeconds)}`, `Recording length ${formatClock(detail.durationSeconds)}`) : ' '}
          </DialogDescription>
        </DialogHeader>
        {failed ? (
          <p role="alert" className="py-6 text-center text-sm text-destructive">{say('無法載入筆記。', 'Could not load notes.')}</p>
        ) : !detail ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <SegmentedControl
                label={say('筆記檢視', 'Notes view')}
                value={view}
                onChange={(next) => { setJump(null); setView(next); }}
                options={[
                  { value: 'notes' as const, label: say('教學筆記', 'Notes') },
                  { value: 'transcript' as const, label: say('逐字稿', 'Transcript') },
                ]}
              />
              <div className="flex gap-2">
                {(view === 'notes' ? !!notes : !!transcriptText) && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8"
                    onClick={() => {
                      void copy(view === 'notes' ? markdown : transcriptText, view).catch(() => undefined);
                    }}
                  >
                    {isCopied(view)
                      ? <Check key={tick} className="mr-1.5 h-3.5 w-3.5 text-emerald-600 animate-in zoom-in-50 spin-in-12 duration-300 motion-reduce:animate-none" />
                      : <Copy className="mr-1.5 h-3.5 w-3.5" />}
                    <span aria-live="polite">{isCopied(view) ? say('已複製', 'Copied') : say('複製', 'Copy')}</span>
                  </Button>
                )}
                <Button
                  size="sm"
                  className="h-8"
                  disabled={view === 'notes' ? !notes : !transcriptText}
                  onClick={() => (view === 'notes' ? downloadText(markdown, say('教學筆記', 'notes')) : downloadText(transcriptText, say('逐字稿', 'transcript')))}
                >
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  {say('下載 Markdown', 'Download Markdown')}
                </Button>
              </div>
            </div>

            {view === 'notes' ? (
              notes ? (
                <article className="space-y-5 text-sm leading-6">
                  <p className="rounded-xl bg-muted/50 p-4 text-[0.95rem] leading-7">{notes.summary}</p>
                  {notes.sections.map((section, index) => (
                    <section key={index} className="space-y-2">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        {section.slidePages.length > 0 && (deckUrl ? (
                          <button
                            type="button"
                            className={cn('inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium tabular-nums transition-colors hover:bg-muted', preview?.key === `${index}` && 'border-primary bg-primary/10 text-primary')}
                            aria-expanded={preview?.key === `${index}`}
                            aria-label={say(`查看投影片${pageLabel(section.slidePages)}`, `Show ${pageLabel(section.slidePages)}`)}
                            onClick={() => togglePreview(`${index}`, section.slidePages)}
                          >
                            <Presentation className="h-3 w-3" />
                            {pageLabel(section.slidePages)}
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs tabular-nums text-muted-foreground">
                            <Presentation className="h-3 w-3" />
                            {pageLabel(section.slidePages)}
                          </span>
                        ))}
                        <h3 className="text-base font-semibold">{section.heading}</h3>
                        {section.startSeconds !== null && (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-md px-1 text-xs tabular-nums text-muted-foreground hover:bg-muted hover:text-foreground"
                            aria-label={say(`查看 ${formatClock(section.startSeconds)} 的逐字稿`, `Transcript at ${formatClock(section.startSeconds)}`)}
                            onClick={() => showMoment(section.startSeconds!)}
                          >
                            <Play className="h-3 w-3" />
                            {formatClock(section.startSeconds)}
                          </button>
                        )}
                      </div>
                      {preview?.key === `${index}` && deckUrl && (
                        <SlidePreview key={preview.key} url={deckUrl} pages={preview.pages} zh={zh} onClose={() => setPreview(null)} />
                      )}
                      <ul className="list-disc space-y-1 pl-5">
                        {section.points.map((point, pointIndex) => <li key={pointIndex}>{point}</li>)}
                      </ul>
                      {section.emphasis?.length > 0 && (
                        <div className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[0.85rem] text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
                          {section.emphasis.map((stress, stressIndex) => (
                            <p key={stressIndex} className="flex gap-1.5">
                              <Star className="mt-1 h-3 w-3 shrink-0 fill-current text-amber-500" aria-hidden="true" />
                              <span><span className="font-medium">{say('老師強調：', 'Stressed: ')}</span>{stress}</span>
                            </p>
                          ))}
                        </div>
                      )}
                      {section.examples.length > 0 && (
                        <div className="rounded-lg border-l-2 border-primary/40 bg-muted/30 px-3 py-2 text-[0.85rem]">
                          {section.examples.map((example, exampleIndex) => <p key={exampleIndex}>{say('例：', 'Example: ')}{example}</p>)}
                        </div>
                      )}
                    </section>
                  ))}
                  {notes.keyTerms.length > 0 && (
                    <section className="space-y-2">
                      <h3 className="text-base font-semibold">{say('關鍵詞', 'Key terms')}</h3>
                      <dl className="grid gap-2 sm:grid-cols-2">
                        {notes.keyTerms.map(({ term, definition }) => (
                          <div key={term} className="rounded-lg border p-3">
                            <dt className="font-medium">{term}</dt>
                            <dd className="text-[0.85rem] text-muted-foreground">{definition}</dd>
                          </div>
                        ))}
                      </dl>
                    </section>
                  )}
                  {notes.studentQuestions.length > 0 && (
                    <section className="space-y-2">
                      <h3 className="text-base font-semibold">{say('課堂提問', 'Questions from class')}</h3>
                      {notes.studentQuestions.map(({ question, answer }, qIndex) => (
                        <div key={qIndex} className="rounded-lg border p-3">
                          <p className="font-medium">Q：{question}</p>
                          <p className="text-[0.85rem] text-muted-foreground">{answer}</p>
                        </div>
                      ))}
                    </section>
                  )}
                  {notes.reviewQuestions.length > 0 && (
                    <section className="space-y-2">
                      <h3 className="text-base font-semibold">{say('課後複習', 'Review questions')}</h3>
                      <ol className="list-decimal space-y-2 pl-5">
                        {notes.reviewQuestions.map(({ question, answer }, rIndex) => (
                          <li key={rIndex}>
                            {question}
                            <details className="text-[0.85rem] text-muted-foreground">
                              <summary className="cursor-pointer select-none">{say('參考答案', 'Answer')}</summary>
                              {answer}
                            </details>
                          </li>
                        ))}
                      </ol>
                    </section>
                  )}
                  {!!notes.uncoveredSlides?.length && (
                    <section className="space-y-2">
                      <h3 className="text-base font-semibold">{say('這次錄音沒講到的投影片', 'Slides not covered in this recording')}</h3>
                      <p className="text-xs text-muted-foreground">
                        {say('這些頁面錄音時沒有放出來，或放了但沒有講解。可以自行閱讀，或留待下次上課。', 'These were not shown while recording, or shown without being explained. Read them on your own, or they come next time.')}
                      </p>
                      <ul className="divide-y rounded-lg border">
                        {notes.uncoveredSlides.map(({ page, title }) => {
                          const key = `uncovered:${page}`;
                          return (
                            <li key={page} className="space-y-2 px-3 py-2">
                              <div className="flex items-center gap-3">
                                <span className="w-14 shrink-0 text-xs tabular-nums text-muted-foreground">{say(`第 ${page} 頁`, `Slide ${page}`)}</span>
                                <span className="min-w-0 flex-1 truncate">{title || say('（圖片頁）', '(image only)')}</span>
                                {deckUrl && (
                                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" aria-expanded={preview?.key === key} onClick={() => togglePreview(key, [page])}>
                                    {preview?.key === key ? say('收起', 'Hide') : say('查看', 'View')}
                                  </Button>
                                )}
                              </div>
                              {preview?.key === key && deckUrl && (
                                <SlidePreview key={key} url={deckUrl} pages={[page]} zh={zh} onClose={() => setPreview(null)} />
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  )}
                </article>
              ) : (
                <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                  {say('還沒有產生教學筆記。', 'No notes generated yet.')}
                </p>
              )
            ) : (
              <div ref={transcriptRef} className="space-y-3 text-sm leading-7">
                {detail.segments.length === 0 && (
                  <p className="py-6 text-center text-muted-foreground">{say('還沒有逐字稿。', 'No transcript yet.')}</p>
                )}
                {detail.segments.flatMap((segment) => {
                  const row = (key: string, seconds: number, body: React.ReactNode) => (
                    <div
                      key={key}
                      data-seconds={seconds}
                      data-key={key}
                      className={cn('grid grid-cols-[3.5rem_1fr] gap-3 rounded-md transition-colors', jump?.key === key && 'bg-amber-100/70 dark:bg-amber-900/30')}
                    >
                      <span className="pt-0.5 font-mono text-xs tabular-nums text-muted-foreground">{formatClock(seconds)}</span>
                      {body}
                    </div>
                  );
                  if (segment.status !== 'transcribed') {
                    return [row(`${segment.idx}`, segment.startSeconds, (
                      <p className="text-amber-700 dark:text-amber-400">{say('這段轉錄失敗，可在面板中重試。', 'This segment failed. Retry it from the panel.')}</p>
                    ))];
                  }
                  const paragraphs = transcriptParagraphs(segment);
                  if (!paragraphs.length) {
                    return [row(`${segment.idx}`, segment.startSeconds, <p className="text-muted-foreground">{say('（這段沒有語音）', '(no speech)')}</p>)];
                  }
                  return paragraphs.map((paragraph, index) =>
                    row(`${segment.idx}-${index}`, paragraph.seconds, <p className="whitespace-pre-wrap">{paragraph.text}</p>));
                })}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
