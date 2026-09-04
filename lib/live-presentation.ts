import { z } from "zod";
import type { LivePollState, LiveSessionStatus } from "./live-session";
export type PollPhase = "draft" | "open" | "closed" | "results";
export type DisplayMode = "deck" | "blank" | "poll" | "questions" | "question";
export interface PresentationSnapshot {
  sessionId: string;
  status: LiveSessionStatus;
  title: string;
  deckUrl: string | null;
  deckPage: number;
  mode: DisplayMode;
  poll: (LivePollState & { phase: PollPhase }) | null;
  questions: { id: string; text: string; upvotes: number; answered: boolean }[];
  answeredIds: string[];
}
export const presentationCommandSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("show"),
      mode: z.enum(["deck", "blank", "poll", "questions"]),
      offset: z.number().int().min(0).max(10000).optional(),
    })
    .strict(),
  // z.discriminatedUnion needs unique discriminants; single-question is normalized by the route.
  z
    .object({ action: z.literal("question"), questionId: z.string().uuid() })
    .strict(),
  z
    .object({
      action: z.literal("phase"),
      pollId: z.string().uuid(),
      phase: z.enum(["open", "closed", "results"]),
    })
    .strict(),
  z
    .object({
      action: z.literal("answer"),
      questionId: z.string().uuid(),
      answered: z.boolean(),
    })
    .strict(),
]);
export type PresentationCommand = z.infer<typeof presentationCommandSchema>;
export function displayLabel(mode: DisplayMode, zh: boolean) {
  return {
    deck: zh ? "簡報" : "Slides",
    blank: zh ? "暫時遮幕" : "Blank screen",
    poll: zh ? "投票" : "Poll",
    questions: zh ? "問題總覽" : "Questions",
    question: zh ? "指定問題" : "Featured question",
  }[mode];
}
export function phaseLabel(phase: PollPhase, zh: boolean) {
  return {
    draft: zh ? "等待開放作答" : "Ready to open",
    open: zh ? "開放作答中" : "Voting open",
    closed: zh ? "已停止收票，等待公布" : "Voting closed",
    results: zh ? "結果已公布" : "Results revealed",
  }[phase];
}
