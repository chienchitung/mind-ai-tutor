// @vitest-environment jsdom
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, it, expect } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { LanguageProvider } from "@/app/contexts/LanguageContext";
import { PresentationContent } from "./PresentationContent";
import type { PresentationSnapshot } from "@/lib/live-presentation";
afterEach(cleanup);
const base: PresentationSnapshot = {
  sessionId: "test",
  title: "Test",
  status: "open",
  deckUrl: null,
  deckPage: 1,
  mode: "poll",
  questions: [],
  answeredIds: [],
  poll: {
    pollId: "p",
    question: "當 AI 給出一個看似合理的答案，你會先做什麼？",
    options: ["直接採用，AI 的答案通常正確", "交叉查證來源，再判斷是否採用"],
    phase: "open",
    voteCounts: [8, 2],
    voteTotal: 10,
  },
};
const view = (snapshot: PresentationSnapshot) =>
  render(
    <LanguageProvider>
      <PresentationContent snapshot={snapshot} />
    </LanguageProvider>,
  );
describe("projection disclosure and end states", () => {
  it("shows response total but no option percentages until explicitly revealed", () => {
    view(base);
    expect(screen.getByText("已收到 10 份回答")).toBeTruthy();
    expect(screen.queryByText("80% (8)")).toBeNull();
  });
  it("reveals percentages only in results phase", () => {
    view({ ...base, poll: { ...base.poll!, phase: "results" } });
    expect(screen.getByText("80% (8)")).toBeTruthy();
    const dir = process.env.LIVE_PREVIEW_DIR;
    if (dir) {
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        join(dir, "poll.html"),
        `<!doctype html><html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="style.css"><body style="height:100vh;background:#020617">${document.body.innerHTML}</body></html>`,
      );
    }
  });
  it("blanking removes question text and results", () => {
    view({ ...base, mode: "blank" });
    expect(
      screen.queryByText("當 AI 給出一個看似合理的答案，你會先做什麼？"),
    ).toBeNull();
  });
  it("ending replaces all content with an end screen", () => {
    view({ ...base, status: "closed" });
    expect(
      screen.queryByText("當 AI 給出一個看似合理的答案，你會先做什麼？"),
    ).toBeNull();
    expect(screen.getByText("本場次已結束，謝謝參與")).toBeTruthy();
  });
  it("shows only the explicitly pinned question", () => {
    view({
      ...base,
      mode: "question",
      questions: [
        { id: "q", text: "Chosen question", upvotes: 2, answered: false },
      ],
    });
    expect(screen.getByText("Chosen question")).toBeTruthy();
    expect(
      screen.queryByText("當 AI 給出一個看似合理的答案，你會先做什麼？"),
    ).toBeNull();
  });
});
