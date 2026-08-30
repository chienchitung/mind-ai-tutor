import { describe, it, expect } from 'vitest';
import { quizPayloadSchema, parseSavedQuiz, isCorrectQuizAnswer, isCorrectQuizOption } from './quiz';

const question = { id: 'q1', questionText: 'Pick A', options: [{ id: 'a', text: 'A' }], correctAnswer: 'a', explanation: '' };
const quiz = { id: 'd325432e-0e37-4a6d-a9c8-3fa333b4f077', title: 'Test', questions: [question] };

describe('quiz persistence contract', () => {
  it('marks every correct option in a multi-select teacher export', () => {
    expect(isCorrectQuizOption('a', ['a', 'c'])).toBe(true);
    expect(isCorrectQuizOption('c', ['a', 'c'])).toBe(true);
    expect(isCorrectQuizOption('b', ['a', 'c'])).toBe(false);
    expect(isCorrectQuizOption('a', 'a')).toBe(true);
  });
  it('accepts a valid quiz and strips client ownership flags', () => {
    expect(quizPayloadSchema.parse({ ...quiz, user_id: 'someone-else', persisted: true })).toEqual(quiz);
  });
  it('rejects missing answers and answers not present in options', () => {
    for (const correctAnswer of ['', 'b', []]) {
      expect(quizPayloadSchema.safeParse({ ...quiz, questions: [{ ...question, correctAnswer }] }).success).toBe(false);
    }
  });
  it('rejects duplicate question IDs and invalid UUIDs', () => {
    expect(quizPayloadSchema.safeParse({ ...quiz, questions: [question, question] }).success).toBe(false);
    expect(quizPayloadSchema.safeParse({ ...quiz, id: '0.123' }).success).toBe(false);
  });
  it('supports short answers and multiple answers', () => {
    expect(quizPayloadSchema.safeParse({ ...quiz, questions: [{ ...question, options: [], correctAnswer: '42' }] }).success).toBe(true);
    expect(quizPayloadSchema.safeParse({ ...quiz, questions: [{ ...question, questionType: 'multiple', correctAnswer: ['a'] }] }).success).toBe(true);
  });
  it('restores server dates and only marks server records persisted', () => {
    const saved = parseSavedQuiz({ ...quiz, created_at: '2026-08-30T00:00:00Z', updated_at: '2026-08-30T01:00:00Z' });
    expect(saved.persisted).toBe(true);
    expect(saved.createdAt).toBeInstanceOf(Date);
    expect(saved.questions).toEqual(quiz.questions);
  });
  it('grades multiple answers without relying on array identity/order', () => {
    expect(isCorrectQuizAnswer(['b', 'a'], ['a', 'b'])).toBe(true);
    expect(isCorrectQuizAnswer(['a', 'a'], ['a', 'b'])).toBe(false);
    expect(isCorrectQuizAnswer(undefined, 'a')).toBe(false);
    expect(isCorrectQuizAnswer(' 42 ', '42')).toBe(true);
  });
});
