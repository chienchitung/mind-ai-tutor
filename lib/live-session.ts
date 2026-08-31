import { z } from 'zod';

export type LiveSessionStatus = 'open' | 'paused' | 'closed';

export interface LivePollState {
  pollId: string;
  question: string;
  options: string[];
  voteCounts: number[];
  voteTotal: number;
}

export interface LivePulseState {
  pulseCounts: number[]; // index 0 = value 1 ("too easy") ... index 4 = value 5 ("too hard")
  pulseTotal: number;
  pulseAverage: number | null;
}

export interface LiveSessionPublicState {
  sessionId: string;
  title: string;
  status: LiveSessionStatus;
  poll: LivePollState | null;
  pulse: LivePulseState;
  deckUrl: string | null;
  deckPage: number;
}

/** Adds the join code, only ever returned to the verified session owner. */
export interface LiveSessionOwnerState extends LiveSessionPublicState {
  joinCode: string;
}

export type QuestionLens = 'clarify' | 'chorus' | 'bridge' | 'keeper';
export const QUESTION_LENSES: QuestionLens[] = ['clarify', 'chorus', 'bridge', 'keeper'];

export interface LiveQuestion {
  id: string;
  text: string;
  lens: QuestionLens;
  visibility: 'public' | 'author_only';
  upvotes: number;
  createdAt: string;
  isMine?: boolean;
}

export const pollDraftSchema = z.object({
  question: z.string().trim().min(1).max(500),
  options: z.array(z.string().trim().min(1).max(120)).min(2).max(6),
});

export const createSessionSchema = z.object({
  title: z.string().trim().min(1).max(200),
}).merge(pollDraftSchema);

export const statusSchema = z.object({ status: z.enum(['open', 'paused', 'closed']) });

export const sessionPatchSchema = z.object({
  status: z.enum(['open', 'paused', 'closed']).optional(),
  deckUrl: z.string().trim().url().max(2048).nullable().optional(),
  deckPage: z.number().int().min(1).optional(),
}).refine((value) => Object.keys(value).length > 0, 'At least one field is required');

export const voteSchema = z.object({
  participantId: z.string().uuid(),
  optionIndex: z.number().int().min(0).max(5),
});

export const pulseSchema = z.object({
  participantId: z.string().uuid(),
  value: z.number().int().min(1).max(5),
});

export const questionSubmitSchema = z.object({
  participantId: z.string().uuid(),
  text: z.string().trim().min(1).max(500),
  lens: z.enum(['clarify', 'chorus', 'bridge', 'keeper']),
});

export const questionUpvoteSchema = z.object({ participantId: z.string().uuid() });

export const questionModerateSchema = z.object({ visibility: z.enum(['public', 'author_only']) });

export const reactionSchema = z.object({ kind: z.enum(['applause', 'insight', 'resonate', 'pause']) });

type QuestionRow = { id: string; text: string; lens: string; visibility: string; upvotes: number; created_at: string; is_mine?: boolean };

export function mapQuestionRow(row: QuestionRow): LiveQuestion {
  return {
    id: row.id, text: row.text, lens: row.lens as QuestionLens, visibility: row.visibility as LiveQuestion['visibility'],
    upvotes: row.upvotes, createdAt: row.created_at, isMine: row.is_mine,
  };
}

export function generateJoinCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

type SessionByCodeRow = {
  session_id: string;
  title: string;
  status: string;
  active_poll_id: string | null;
  poll_question: string | null;
  poll_options: string[] | null;
  vote_counts: number[];
  vote_total: number;
  pulse_counts: number[];
  pulse_total: number;
  pulse_average: string | number | null;
  deck_url: string | null;
  deck_page: number;
};

export function mapSessionByCodeRow(row: SessionByCodeRow): LiveSessionPublicState {
  return {
    sessionId: row.session_id,
    title: row.title,
    status: row.status as LiveSessionStatus,
    poll: row.active_poll_id && row.poll_question
      ? {
        pollId: row.active_poll_id,
        question: row.poll_question,
        options: row.poll_options ?? [],
        voteCounts: row.vote_counts ?? [],
        voteTotal: row.vote_total ?? 0,
      }
      : null,
    pulse: {
      pulseCounts: row.pulse_counts ?? [0, 0, 0, 0, 0],
      pulseTotal: row.pulse_total ?? 0,
      pulseAverage: row.pulse_average === null || row.pulse_average === undefined ? null : Number(row.pulse_average),
    },
    deckUrl: row.deck_url ?? null,
    deckPage: row.deck_page ?? 1,
  };
}

/**
 * sessionStorage key for the anonymous participant id, scoped per session.
 * Tab-scoped like call-in's own audience identity: survives a reload of the
 * same tab (so "already voted" state isn't lost) but not a closed tab or a
 * different session.
 */
export const participantStorageKey = (sessionId: string) => `live_participant:${sessionId}`;
