'use client';

import { useEffect, useState } from 'react';
import { Copy, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { formatClock, joinTranscript, lessonNotesToMarkdown, transcriptParagraphs, type LessonNotes, type RecordingSegment } from '@/lib/live-recording';

type Detail = { title: string; notes: LessonNotes | null; durationSeconds: number; segments: RecordingSegment[] };

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
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!recordingId) return;
    let cancelled = false;
    setDetail(null);
    setFailed(false);
    setCopied(false);
    fetch(`/api/live-recordings/${recordingId}`, { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((body: Detail) => {
        if (cancelled) return;
        const notes = initialNotes ?? body.notes;
        setDetail({ ...body, notes });
        setView(notes ? 'notes' : 'transcript');
      })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [recordingId, initialNotes]);

  const notes = detail?.notes ?? null;
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
                onChange={setView}
                options={[
                  { value: 'notes' as const, label: say('教學筆記', 'Notes') },
                  { value: 'transcript' as const, label: say('逐字稿', 'Transcript') },
                ]}
              />
              <div className="flex gap-2">
                {view === 'notes' && notes && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8"
                    onClick={() => {
                      void navigator.clipboard.writeText(markdown).then(() => setCopied(true), () => undefined);
                    }}
                  >
                    <Copy className="mr-1.5 h-3.5 w-3.5" />
                    {copied ? say('已複製', 'Copied') : say('複製', 'Copy')}
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
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <h3 className="text-base font-semibold">{section.heading}</h3>
                        <span className="text-xs text-muted-foreground">
                          {[
                            section.slidePages.length ? say(`投影片 ${section.slidePages.join(', ')}`, `Slides ${section.slidePages.join(', ')}`) : '',
                            section.startSeconds !== null ? formatClock(section.startSeconds) : '',
                          ].filter(Boolean).join(' · ')}
                        </span>
                      </div>
                      <ul className="list-disc space-y-1 pl-5">
                        {section.points.map((point, pointIndex) => <li key={pointIndex}>{point}</li>)}
                      </ul>
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
                </article>
              ) : (
                <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                  {say('還沒有產生教學筆記。', 'No notes generated yet.')}
                </p>
              )
            ) : (
              <div className="space-y-3 text-sm leading-7">
                {detail.segments.length === 0 && (
                  <p className="py-6 text-center text-muted-foreground">{say('還沒有逐字稿。', 'No transcript yet.')}</p>
                )}
                {detail.segments.flatMap((segment) => {
                  const row = (key: string, seconds: number, body: React.ReactNode) => (
                    <div key={key} className="grid grid-cols-[3.5rem_1fr] gap-3">
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
