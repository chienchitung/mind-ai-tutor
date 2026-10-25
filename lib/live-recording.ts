import { z } from 'zod';

// Shared by the presenter's recorder, the recording API routes and the notes
// view. Audio is cut into fixed segments so every transcription call stays
// far inside the 60s serverless limit and the 20MB Gemini inline-audio cap.
export const RECORDING_BUCKET = 'live-recordings';
export const SEGMENT_SECONDS = 5 * 60;
export const SEGMENT_SAMPLE_RATE = 16_000;
export const MAX_SEGMENTS = 288; // 24h of 5-minute segments, matches the DB check

export type SlideMark = { t: number; page: number };

export type RecordingSegment = {
  idx: number;
  startSeconds: number;
  durationSeconds: number;
  status: 'transcribed' | 'failed';
  transcript: string | null;
  error: string | null;
};

export const lessonNotesSchema = z.object({
  title: z.string().min(1).max(200),
  summary: z.string().min(1).max(4000),
  sections: z.array(z.object({
    heading: z.string().min(1).max(200),
    slidePages: z.array(z.number().int().min(1)).max(50).default([]),
    startSeconds: z.number().min(0).nullable().default(null),
    points: z.array(z.string().min(1).max(1000)).min(1).max(20),
    examples: z.array(z.string().min(1).max(1000)).max(10).default([]),
  })).min(1).max(30),
  keyTerms: z.array(z.object({ term: z.string().min(1).max(120), definition: z.string().min(1).max(600) })).max(30).default([]),
  studentQuestions: z.array(z.object({ question: z.string().min(1).max(600), answer: z.string().max(1500) })).max(30).default([]),
  reviewQuestions: z.array(z.object({ question: z.string().min(1).max(600), answer: z.string().min(1).max(1500) })).max(15).default([]),
});
export type LessonNotes = z.infer<typeof lessonNotesSchema>;

// Gemini's responseJsonSchema (JSON Schema) for the same shape.
export const LESSON_NOTES_JSON_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    summary: { type: 'string' },
    sections: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          heading: { type: 'string' },
          slidePages: { type: 'array', items: { type: 'integer' } },
          startSeconds: { type: ['number', 'null'] },
          points: { type: 'array', items: { type: 'string' } },
          examples: { type: 'array', items: { type: 'string' } },
        },
        required: ['heading', 'slidePages', 'points'],
      },
    },
    keyTerms: {
      type: 'array',
      items: { type: 'object', properties: { term: { type: 'string' }, definition: { type: 'string' } }, required: ['term', 'definition'] },
    },
    studentQuestions: {
      type: 'array',
      items: { type: 'object', properties: { question: { type: 'string' }, answer: { type: 'string' } }, required: ['question', 'answer'] },
    },
    reviewQuestions: {
      type: 'array',
      items: { type: 'object', properties: { question: { type: 'string' }, answer: { type: 'string' } }, required: ['question', 'answer'] },
    },
  },
  required: ['title', 'summary', 'sections', 'keyTerms', 'studentQuestions', 'reviewQuestions'],
} as const;

export const createRecordingSchema = z.object({
  sessionId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
});

export const updateRecordingSchema = z.object({
  status: z.literal('stopped').optional(),
  durationSeconds: z.number().int().min(0).max(86_400).optional(),
  slideMarks: z.array(z.object({ t: z.number().min(0).max(86_400), page: z.number().int().min(1).max(10_000) })).max(5_000).optional(),
}).refine((value) => Object.keys(value).length > 0);

export const segmentSchema = z.object({
  idx: z.number().int().min(0).max(MAX_SEGMENTS - 1),
  startSeconds: z.number().int().min(0).max(86_400),
  durationSeconds: z.number().int().min(1).max(900),
  language: z.enum(['zh-TW', 'en']).default('zh-TW'),
});

export const notesRequestSchema = z.object({
  language: z.enum(['zh-TW', 'en']).default('zh-TW'),
  slides: z.array(z.object({ page: z.number().int().min(1), text: z.string().max(4_000) })).max(300).default([]),
});

export function segmentPath(userId: string, recordingId: string, idx: number): string {
  return `${userId}/${recordingId}/${String(idx).padStart(3, '0')}.wav`;
}

export function formatClock(totalSeconds: number): string {
  const seconds = Number.isFinite(totalSeconds) ? Math.max(0, Math.floor(totalSeconds)) : 0;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const mm = String(m).padStart(h ? 2 : 1, '0');
  return h ? `${h}:${mm}:${String(s).padStart(2, '0')}` : `${mm}:${String(s).padStart(2, '0')}`;
}

/** Collapses consecutive marks on the same page into ranges for the prompt. */
export function slideTimeline(marks: SlideMark[], durationSeconds: number): { page: number; from: number; to: number }[] {
  const ordered = [...marks].sort((a, b) => a.t - b.t);
  const ranges: { page: number; from: number; to: number }[] = [];
  for (const mark of ordered) {
    const last = ranges.at(-1);
    if (last && last.page === mark.page) continue;
    if (last) last.to = mark.t;
    ranges.push({ page: mark.page, from: mark.t, to: durationSeconds });
  }
  return ranges.filter((range) => range.to > range.from);
}

export type TimedParagraph = { seconds: number; text: string };

const STAMP = /^\[(?:(\d+):)?(\d{1,2}):(\d{2})\]\s*/;

/** "M:SS", "MM:SS" or "H:MM:SS" to seconds; null if it isn't a clock. */
export function parseClock(value: string): number | null {
  const match = /^\s*(?:(\d+):)?(\d{1,3}):(\d{2})\s*$/.exec(value);
  if (!match || Number(match[3]) > 59) return null;
  return Number(match[1] ?? 0) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}

// Gemini times each paragraph from the start of its own five-minute
// segment; the stored transcript carries lecture time instead, one
// "[m:ss] text" paragraph per block. Times are clamped into the segment and
// kept in order, since a model's audio timestamps are approximate.
export function timedTranscript(paragraphs: { start: string; text: string }[], segmentStart: number, segmentDuration: number): string {
  let previous = segmentStart;
  const end = segmentStart + segmentDuration;
  return paragraphs
    .map(({ start, text }) => ({ offset: parseClock(start), text: text.replace(/\s*\n+\s*/g, ' ').trim() }))
    .filter(({ text }) => text)
    .map(({ offset, text }) => {
      const seconds = offset === null ? previous : Math.min(end, Math.max(previous, segmentStart + offset));
      previous = seconds;
      return `[${formatClock(seconds)}] ${text}`;
    })
    .join('\n\n');
}

/** A stored segment's paragraphs; older transcripts without per-paragraph times count as one paragraph at the segment start. */
export function transcriptParagraphs(segment: Pick<RecordingSegment, 'startSeconds' | 'transcript'>): TimedParagraph[] {
  const text = segment.transcript?.trim();
  if (!text) return [];
  const blocks = text.split(/\n{2,}/);
  if (!blocks.every((block) => STAMP.test(block))) return [{ seconds: segment.startSeconds, text }];
  return blocks.map((block) => {
    const match = STAMP.exec(block)!;
    return {
      seconds: Number(match[1] ?? 0) * 3600 + Number(match[2]) * 60 + Number(match[3]),
      text: block.slice(match[0].length).trim(),
    };
  });
}

/** The whole lecture as "[m:ss] paragraph" blocks, in order. */
export function joinTranscript(segments: RecordingSegment[]): string {
  return [...segments]
    .sort((a, b) => a.idx - b.idx)
    .filter((segment) => segment.status === 'transcribed')
    .flatMap((segment) => transcriptParagraphs(segment))
    .map(({ seconds, text }) => `[${formatClock(seconds)}] ${text}`)
    .join('\n\n');
}

// Gemini's responseJsonSchema for one segment's transcription.
export const TRANSCRIPT_JSON_SCHEMA = {
  type: 'object',
  properties: {
    paragraphs: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          start: { type: 'string', description: 'M:SS from the start of this audio clip' },
          text: { type: 'string' },
        },
        required: ['start', 'text'],
      },
    },
  },
  required: ['paragraphs'],
} as const;

export function lessonNotesToMarkdown(notes: LessonNotes, zh: boolean): string {
  const lines: string[] = [`# ${notes.title}`, '', notes.summary, ''];
  for (const section of notes.sections) {
    const meta = [
      section.slidePages.length ? `${zh ? '投影片' : 'Slides'} ${section.slidePages.join(', ')}` : '',
      section.startSeconds !== null ? formatClock(section.startSeconds) : '',
    ].filter(Boolean).join(' · ');
    lines.push(`## ${section.heading}`);
    if (meta) lines.push(`_${meta}_`);
    lines.push('');
    for (const point of section.points) lines.push(`- ${point}`);
    for (const example of section.examples) lines.push(`- ${zh ? '例：' : 'Example: '}${example}`);
    lines.push('');
  }
  if (notes.keyTerms.length) {
    lines.push(`## ${zh ? '關鍵詞' : 'Key terms'}`, '');
    for (const { term, definition } of notes.keyTerms) lines.push(`- **${term}**：${definition}`);
    lines.push('');
  }
  if (notes.studentQuestions.length) {
    lines.push(`## ${zh ? '課堂提問' : 'Questions from class'}`, '');
    for (const { question, answer } of notes.studentQuestions) lines.push(`- **Q：${question}**`, `  ${answer}`);
    lines.push('');
  }
  if (notes.reviewQuestions.length) {
    lines.push(`## ${zh ? '課後複習' : 'Review questions'}`, '');
    notes.reviewQuestions.forEach(({ question, answer }, index) => lines.push(`${index + 1}. ${question}`, `   - ${zh ? '參考答案' : 'Answer'}：${answer}`));
    lines.push('');
  }
  return lines.join('\n').trimEnd() + '\n';
}
