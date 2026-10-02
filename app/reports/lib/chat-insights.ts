import { rangeStart, type DateRange } from './date-range';

export interface ChatMessage {
  id: string;
  learning_record_id: string | null;
  lesson_id: string;
  message_content: string;
  is_user: boolean;
  timestamp: string;
  game_id: string | null;
}

export interface ChatSession {
  id: string;
  lessonId: string;
  lessonTitle: string;
  startedAt: number;
  messages: ChatMessage[];
  questionCount: number;
}

type TitleOf = (lessonId: string) => string;

const time = (message: ChatMessage) => new Date(message.timestamp).getTime();

export function filterChatMessages(
  messages: ChatMessage[],
  range: DateRange,
  matchesGame: (gameId: string | null) => boolean,
  now = Date.now(),
) {
  const since = rangeStart(range, now);
  return messages.filter(message =>
    matchesGame(message.game_id) && (since === null || time(message) >= since));
}

// One session per learning record (one play-through of a lesson), newest
// first, messages in the order they were sent.
export function groupChatSessions(messages: ChatMessage[], titleOf: TitleOf): ChatSession[] {
  const groups = new Map<string, ChatMessage[]>();
  for (const message of messages) {
    // Messages saved without a record id still belong together per lesson.
    const key = message.learning_record_id ?? `lesson:${message.lesson_id}`;
    groups.set(key, [...(groups.get(key) ?? []), message]);
  }
  return Array.from(groups.entries())
    .map(([id, group]) => {
      const sorted = [...group].sort((a, b) => time(a) - time(b));
      return {
        id,
        lessonId: sorted[0].lesson_id,
        lessonTitle: titleOf(sorted[0].lesson_id),
        startedAt: time(sorted[0]),
        messages: sorted,
        questionCount: sorted.filter(message => message.is_user).length,
      };
    })
    .sort((a, b) => b.startedAt - a.startedAt);
}

export interface ChatSummary {
  questions: number;
  replies: number;
  sessions: number;
  lessons: number;
  averageQuestionLength: number;
  topLesson: { title: string; questions: number } | null;
}

export function summarizeChat(sessions: ChatSession[]): ChatSummary {
  const questions = sessions.flatMap(session => session.messages.filter(message => message.is_user));
  const byLesson = new Map<string, { title: string; questions: number }>();
  for (const session of sessions) {
    const entry = byLesson.get(session.lessonId) ?? { title: session.lessonTitle, questions: 0 };
    entry.questions += session.questionCount;
    byLesson.set(session.lessonId, entry);
  }
  const topLesson = Array.from(byLesson.values())
    .filter(entry => entry.questions > 0)
    .sort((a, b) => b.questions - a.questions)[0] ?? null;

  return {
    questions: questions.length,
    replies: sessions.reduce((sum, session) => sum + session.messages.length - session.questionCount, 0),
    sessions: sessions.length,
    lessons: byLesson.size,
    averageQuestionLength: questions.length
      ? Math.round(questions.reduce((sum, message) => sum + Array.from(message.message_content.trim()).length, 0) / questions.length)
      : 0,
    topLesson,
  };
}

export function searchChatSessions(sessions: ChatSession[], query: string) {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return sessions;
  return sessions.filter(session =>
    session.lessonTitle.toLocaleLowerCase().includes(needle)
    || session.messages.some(message => message.message_content.toLocaleLowerCase().includes(needle)));
}

function clip(text: string, max: number) {
  const chars = Array.from(text.replace(/\s+/g, ' ').trim());
  return chars.length > max ? `${chars.slice(0, max).join('')}…` : chars.join('');
}

export interface ConversationDigest {
  total_student_questions: number;
  sessions: number;
  // Most recent questions, oldest first, each with the start of the AI
  // tutor's reply so the model can tell hints from handed-over answers.
  excerpts: { lesson_title: string; asked_at: string; student_question: string; ai_reply_start: string }[];
}

const DIGEST_LIMIT = 40;

// What the AI learning analysis gets to read: bounded in count and length so
// a talkative student can't blow up the request.
export function conversationDigest(sessions: ChatSession[], limit = DIGEST_LIMIT): ConversationDigest | null {
  const pairs = sessions.flatMap(session => session.messages.flatMap((message, index) => {
    if (!message.is_user || !message.message_content.trim()) return [];
    const reply = session.messages.slice(index + 1).find(next => !next.is_user);
    return [{
      at: time(message),
      lesson_title: session.lessonTitle,
      asked_at: message.timestamp,
      student_question: clip(message.message_content, 300),
      ai_reply_start: reply ? clip(reply.message_content, 160) : '',
    }];
  }));
  if (!pairs.length) return null;

  const excerpts = pairs
    .sort((a, b) => b.at - a.at)
    .slice(0, limit)
    .reverse()
    .map(({ at: _at, ...rest }) => rest);

  return { total_student_questions: pairs.length, sessions: sessions.length, excerpts };
}
