import type { LivePollState, LiveQuestion, PreparedPoll } from '@/lib/live-session';
import type { Quiz } from '@/lib/quiz';

// The Q&A and poll panel on the projector window (dual-screen). The
// presenter page holds the class data and does the work: it sends what the
// panel shows over the session's `live-ink:<id>` BroadcastChannel, and the
// projector window sends back what the teacher clicked there. Both windows
// are the same teacher's, in the same browser.

export interface LivePanelData {
  poll: LivePollState | null;
  questions: LiveQuestion[];
  moderatingId: string | null;
  preparedPolls: PreparedPoll[] | null;
  quizzes: Quiz[] | null;
  quizzesLoading: boolean;
  quizPickerError: string;
}

export type LivePanelAction =
  | { action: 'moderate'; questionId: string }
  | { action: 'launch-prepared'; pollId: string }
  | { action: 'load-quizzes' }
  | { action: 'pick-quiz-question'; quizIndex: number; questionIndex: number };

/** Reads a panel action sent by the projector window; anything else is null. */
export function readPanelAction(message: unknown): LivePanelAction | null {
  if (!message || typeof message !== 'object') return null;
  const value = message as Record<string, unknown>;
  if (value.type !== 'panel-action') return null;
  switch (value.action) {
    case 'moderate':
      return typeof value.questionId === 'string' ? { action: 'moderate', questionId: value.questionId } : null;
    case 'launch-prepared':
      return typeof value.pollId === 'string' ? { action: 'launch-prepared', pollId: value.pollId } : null;
    case 'load-quizzes':
      return { action: 'load-quizzes' };
    case 'pick-quiz-question':
      return Number.isInteger(value.quizIndex) && Number.isInteger(value.questionIndex)
        ? { action: 'pick-quiz-question', quizIndex: value.quizIndex as number, questionIndex: value.questionIndex as number }
        : null;
    default:
      return null;
  }
}
