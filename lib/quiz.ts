import { z } from 'zod';

export const quizQuestionSchema = z.object({
  id: z.string().min(1).max(100),
  questionText: z.string().trim().min(1).max(10000),
  options: z.array(z.object({ id: z.string().min(1).max(100), text: z.string().trim().min(1).max(5000) })).max(20),
  questionType: z.enum(['single', 'multiple']).optional(),
  correctAnswer: z.union([z.string().trim().min(1).max(10000), z.array(z.string().min(1).max(100)).min(1).max(20)]),
  explanation: z.string().max(20000),
}).superRefine((question, ctx) => {
  const ids = question.options.map(option => option.id);
  const answers = Array.isArray(question.correctAnswer) ? question.correctAnswer : [question.correctAnswer];
  if (new Set(ids).size !== ids.length || new Set(answers).size !== answers.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Duplicate option or answer IDs' });
  }
  if (ids.length && answers.some(answer => !ids.includes(answer))) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Correct answers must refer to an option' });
  }
});

export const quizPayloadSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  questions: z.array(quizQuestionSchema).min(1).max(100),
}).superRefine((quiz, ctx) => {
  if (new Set(quiz.questions.map(question => question.id)).size !== quiz.questions.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Duplicate question IDs' });
  }
});

export type QuizQuestion = z.infer<typeof quizQuestionSchema>;
export interface Quiz extends z.infer<typeof quizPayloadSchema> {
  createdAt?: Date;
  updatedAt?: Date;
  persisted?: boolean;
}

export function parseSavedQuiz(row: { id: string; title: string; questions: unknown; created_at: string; updated_at: string }): Quiz {
  return { ...quizPayloadSchema.parse(row), createdAt: new Date(row.created_at), updatedAt: new Date(row.updated_at), persisted: true };
}

export function isCorrectQuizAnswer(answer: string | string[] | undefined, correct: string | string[]): boolean {
  if (answer === undefined) return false;
  if (!Array.isArray(correct)) return typeof answer === 'string' && answer.trim() === correct.trim();
  return Array.isArray(answer) && answer.length === correct.length && new Set(answer).size === answer.length && correct.every(id => answer.includes(id));
}

/** Shared by teacher exports and the on-screen answer key. */
export function isCorrectQuizOption(optionId: string, correct: string | string[]): boolean {
  return Array.isArray(correct) ? correct.includes(optionId) : optionId === correct;
}
