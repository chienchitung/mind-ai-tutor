import { describe, expect, it } from 'vitest';
import {
  conversationDigest, filterChatMessages, groupChatSessions, searchChatSessions, summarizeChat, type ChatMessage,
} from './chat-insights';

const titleOf = (id: string) => ({ l1: '函數入門', l2: '條件判斷' }[id] ?? id);

const msg = (id: string, record: string, lesson: string, isUser: boolean, timestamp: string, content: string, game: string | null = 'g1'): ChatMessage => ({
  id, learning_record_id: record, lesson_id: lesson, is_user: isUser, timestamp, message_content: content, game_id: game,
});

const messages = [
  msg('1', 'r1', 'l1', true, '2026-09-01T10:00:00Z', 'SUM 函數怎麼用？'),
  msg('2', 'r1', 'l1', false, '2026-09-01T10:00:05Z', '**SUM** 可以把範圍內的數字加總，例如 `=SUM(A1:A3)`。'),
  msg('3', 'r1', 'l1', true, '2026-09-01T10:01:00Z', '可以直接給我答案嗎'),
  msg('4', 'r1', 'l1', false, '2026-09-01T10:01:05Z', '先想想看要加總哪些儲存格？'),
  msg('5', 'r2', 'l2', true, '2026-09-20T09:00:00Z', 'IF 的條件寫錯了嗎', 'g2'),
  msg('6', 'r2', 'l2', false, '2026-09-20T09:00:04Z', '請檢查比較運算子。', 'g2'),
];

describe('filterChatMessages', () => {
  it('scopes by date range and game', () => {
    const now = new Date('2026-09-25T00:00:00Z').getTime();
    expect(filterChatMessages(messages, '7d', () => true, now).map(m => m.id)).toEqual(['5', '6']);
    expect(filterChatMessages(messages, 'all', gameId => gameId === 'g1', now)).toHaveLength(4);
  });
});

describe('groupChatSessions / summarizeChat', () => {
  it('groups per learning record, newest session first, messages in order', () => {
    const sessions = groupChatSessions([...messages].reverse(), titleOf);
    expect(sessions.map(s => [s.id, s.lessonTitle, s.questionCount])).toEqual([
      ['r2', '條件判斷', 1],
      ['r1', '函數入門', 2],
    ]);
    expect(sessions[1].messages.map(m => m.id)).toEqual(['1', '2', '3', '4']);
  });

  it('summarizes question volume and the busiest lesson', () => {
    expect(summarizeChat(groupChatSessions(messages, titleOf))).toEqual({
      questions: 3,
      replies: 3,
      sessions: 2,
      lessons: 2,
      averageQuestionLength: 10,
      topLesson: { title: '函數入門', questions: 2 },
    });
  });
});

describe('searchChatSessions', () => {
  it('matches message text or lesson title, case-insensitively', () => {
    const sessions = groupChatSessions(messages, titleOf);
    expect(searchChatSessions(sessions, 'sum').map(s => s.id)).toEqual(['r1']);
    expect(searchChatSessions(sessions, '條件').map(s => s.id)).toEqual(['r2']);
    expect(searchChatSessions(sessions, '  ')).toHaveLength(2);
  });
});

describe('conversationDigest', () => {
  it('pairs each question with the start of the next AI reply, oldest first', () => {
    const digest = conversationDigest(groupChatSessions(messages, titleOf));
    expect(digest?.total_student_questions).toBe(3);
    expect(digest?.excerpts.map(e => [e.student_question, e.ai_reply_start])).toEqual([
      ['SUM 函數怎麼用？', '**SUM** 可以把範圍內的數字加總，例如 `=SUM(A1:A3)`。'],
      ['可以直接給我答案嗎', '先想想看要加總哪些儲存格？'],
      ['IF 的條件寫錯了嗎', '請檢查比較運算子。'],
    ]);
  });

  it('keeps only the most recent questions and clips long text', () => {
    const long = msg('9', 'r3', 'l1', true, '2026-09-30T00:00:00Z', '問'.repeat(500));
    const digest = conversationDigest(groupChatSessions([...messages, long], titleOf), 2);
    expect(digest?.excerpts.map(e => e.asked_at)).toEqual(['2026-09-20T09:00:00Z', '2026-09-30T00:00:00Z']);
    expect(Array.from(digest!.excerpts[1].student_question)).toHaveLength(301);
  });

  it('returns null without student questions', () => {
    expect(conversationDigest([])).toBeNull();
  });
});
