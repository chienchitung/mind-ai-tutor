// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { mkdirSync, writeFileSync } from "node:fs";
import { PresentationControls } from "./PresentationControls";
import { LanguageProvider } from "@/app/contexts/LanguageContext";
const mocks = vi.hoisted(() => ({
  command: vi.fn().mockResolvedValue(true),
  state: null as any,
}));
vi.mock("./usePresentationSnapshot", () => ({
  usePresentationSnapshot: () => ({
    snapshot: mocks.state,
    command: mocks.command,
    pending: false,
    retry: vi.fn(),
  }),
}));
vi.mock("./DeckViewer", () => ({ DeckViewer: () => null }));
const questions = Array.from({ length: 8 }, (_, i) => ({
  id: `q${i}`,
  text: `${i + 1}. 如何判斷 AI 提供的答案是否可靠？請說明你的思考過程與查證方法。`,
  upvotes: i,
  answered: false,
  visibility: "public" as const,
  lens: "clarify" as const,
  createdAt: new Date(i * 1000).toISOString(),
}));
beforeEach(() => {
  mocks.command.mockClear();
  mocks.state = {
    sessionId: "test",
    title: "測試",
    status: "open",
    mode: "questions",
    poll: null,
    deckUrl: null,
    deckPage: 1,
    questions: questions.slice(0, 4),
    answeredIds: [],
    overview: {
      pageSize: 4,
      sort: "popular",
      offset: 0,
      total: 8,
      newCount: 2,
    },
  };
});
afterEach(cleanup);
const view = () =>
  render(
    <LanguageProvider>
      <PresentationControls
        sessionId="test"
        questions={questions}
        connected
        onOpen={() => {}}
      />
    </LanguageProvider>,
  );
it("sends page size and sort changes, but waits for confirmed state before changing the page indicator", () => {
  view();
  fireEvent.change(screen.getByLabelText("每頁題數"), {
    target: { value: "6" },
  });
  expect(mocks.command).toHaveBeenLastCalledWith({
    action: "show",
    mode: "questions",
    offset: 0,
    pageSize: 6,
    sort: "popular",
  });
  fireEvent.change(screen.getByLabelText("投影排序"), {
    target: { value: "newest" },
  });
  expect(mocks.command).toHaveBeenLastCalledWith({
    action: "show",
    mode: "questions",
    offset: 0,
    pageSize: 4,
    sort: "newest",
  });
  fireEvent.click(screen.getByText("下一組"));
  expect(mocks.command).toHaveBeenLastCalledWith({
    action: "show",
    mode: "questions",
    offset: 4,
    pageSize: 4,
    sort: "popular",
  });
  expect(screen.getByText(/本組 1–4/)).toBeTruthy();
});
it("offers explicit refresh for new arrivals and hides irrelevant scroll buttons", () => {
  view();
  fireEvent.click(screen.getByText("2 個新問題・更新總覽"));
  expect(mocks.command).toHaveBeenCalledWith({
    action: "show",
    mode: "questions",
    offset: 0,
    pageSize: 4,
    sort: "popular",
  });
  expect(screen.queryByText("捲動投影畫面")).toBeNull();
});
it("answers the featured question and advances in a single command", () => {
  mocks.state.mode = "question";
  mocks.state.questions = [questions[0]];
  view();
  fireEvent.click(screen.getByText("已回答並顯示下一題"));
  expect(mocks.command).toHaveBeenCalledWith({
    action: "answer",
    questionId: "q0",
    answered: true,
    advance: true,
  });
});
it("shows a poll's state instantly via an optimistic patch, without waiting for the write to resolve", () => {
  mocks.state.poll = {
    pollId: "p1",
    question: "哪一種比較清楚？",
    options: ["A", "B"],
    voteCounts: [0, 0],
    voteTotal: 0,
    phase: "draft",
  };
  view();
  fireEvent.click(screen.getByText("展示投票"));
  const [command, patch] = mocks.command.mock.calls.at(-1)!;
  expect(command).toEqual({ action: "show", mode: "poll" });
  // The patch is what the panel shows immediately, before any round trip -
  // applying it to the current snapshot must already reflect the click.
  expect(patch(mocks.state).mode).toBe("poll");
});

it("flips the poll phase instantly, mirroring control_live_presentation's own mode-to-poll side effect", () => {
  mocks.state.poll = {
    pollId: "p1",
    question: "哪一種比較清楚？",
    options: ["A", "B"],
    voteCounts: [0, 0],
    voteTotal: 0,
    phase: "draft",
  };
  view();
  fireEvent.click(screen.getByText("開放作答"));
  const [command, patch] = mocks.command.mock.calls.at(-1)!;
  expect(command).toEqual({ action: "phase", pollId: "p1", phase: "open" });
  const patched = patch(mocks.state);
  expect(patched.poll.phase).toBe("open");
  expect(patched.mode).toBe("poll");
});

it("features a question instantly from data already on the page, without waiting for the write", () => {
  view();
  fireEvent.click(screen.getAllByText("放大這題")[0]);
  const [command, patch] = mocks.command.mock.calls.at(-1)!;
  expect(command).toEqual({ action: "question", questionId: "q0" });
  const patched = patch(mocks.state);
  expect(patched.mode).toBe("question");
  expect(patched.questions).toEqual([
    { id: "q0", text: questions[0].text, upvotes: 0, answered: false },
  ]);
});

it("marks a question answered instantly by updating answeredIds locally", () => {
  view();
  fireEvent.click(screen.getAllByText("標記已回答")[0]);
  const [command, patch] = mocks.command.mock.calls.at(-1)!;
  expect(command).toEqual({ action: "answer", questionId: "q0", answered: true });
  expect(patch(mocks.state).answeredIds).toEqual(["q0"]);
});

it("renders six questions in a complete proportional preview", () => {
  mocks.state.questions = questions.slice(0, 6);
  mocks.state.overview.pageSize = 6;
  view();
  const dir = process.env.LIVE_PREVIEW_DIR;
  if (dir) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      `${dir}/qa.html`,
      `<!doctype html><html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="style.css"><body style="padding:24px">${document.body.innerHTML}</body></html>`,
    );
  }
  expect(screen.getByText(/本組 1–6/)).toBeTruthy();
});
