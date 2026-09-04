// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { LanguageProvider } from "@/app/contexts/LanguageContext";
import { SpotlightOverlay, type Spotlight } from "./SpotlightOverlay";

afterEach(() => cleanup());

function renderSpotlight(spotlight: Spotlight) {
  return render(
    <LanguageProvider>
      <SpotlightOverlay spotlight={spotlight} />
    </LanguageProvider>,
  );
}

describe("SpotlightOverlay", () => {
  it("shows poll results with live percentages", () => {
    renderSpotlight({
      type: "poll",
      poll: {
        pollId: "poll-1",
        question: "哪一種資料視覺化最清楚？",
        options: ["長條圖", "折線圖"],
        voteCounts: [3, 1],
        voteTotal: 4,
      },
    });
    expect(screen.getByText("哪一種資料視覺化最清楚？")).toBeTruthy();
    expect(screen.getByText("75% (3)")).toBeTruthy();
    expect(screen.getByText("4 人已答")).toBeTruthy();
  });

  it("shows featured questions with upvote counts", () => {
    renderSpotlight({
      type: "questions",
      questions: [
        { id: "q1", text: "IF 函數可以巢狀使用嗎？", upvotes: 5 },
        { id: "q2", text: "VLOOKUP 跟 XLOOKUP 差在哪？", upvotes: 2 },
      ],
    });
    expect(screen.getByText("IF 函數可以巢狀使用嗎？")).toBeTruthy();
    expect(screen.getByText("▲ 5")).toBeTruthy();
    expect(screen.getByText("VLOOKUP 跟 XLOOKUP 差在哪？")).toBeTruthy();
  });

  it("shows an empty state when no questions have been featured yet", () => {
    renderSpotlight({ type: "questions", questions: [] });
    expect(screen.getByText("目前還沒有任何提問。")).toBeTruthy();
  });
});
