// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { LanguageProvider } from "@/app/contexts/LanguageContext";
import LessonsPage from "./page";
const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  toast: vi.fn(),
}));
vi.mock("@/lib/supabase", () => ({
  supabase: () => ({
    from: () => ({ select: mocks.select, update: mocks.update }),
  }),
}));
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));
vi.mock("@/app/components/ui/MarkdownEditor", () => ({
  default: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (s: string) => void;
  }) => (
    <textarea
      aria-label="教材 Markdown"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));
const lesson = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  title: "IF 條件函數",
  description: "學會使用 IF 做判斷",
  duration: 30,
  level: "Beginner",
  topics: ["Excel"],
  markdown_content: "# IF 函數",
  genially_link: "",
  teaching_content: "IF 條件判斷",
  practice_exercises: [
    { question: "問題一", answer: "答案一", explanation: "說明一" },
    { question: "問題二", answer: "答案二", explanation: "說明二" },
  ],
  created_at: "2026-08-31",
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.select.mockResolvedValue({
    data: [structuredClone(lesson)],
    error: null,
  });
  mocks.update.mockReturnValue({ eq: mocks.eq });
  mocks.eq.mockResolvedValue({ error: null });
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {} });
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue({
        ok: true,
        json: async () => ({
          question: "AI 新題",
          answer: "AI 答案",
          explanation: "AI 說明",
        }),
      }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
async function edit() {
  render(
    <LanguageProvider>
      <LessonsPage />
    </LanguageProvider>,
  );
  fireEvent.click(
    await screen.findByRole("button", { name: "編輯" }, { timeout: 5000 }),
  );
  await screen.findByDisplayValue("問題二");
}
describe("lesson editor experience", () => {
  it("loads and saves all exercises without truncation", async () => {
    await edit();
    fireEvent.change(screen.getByLabelText("標題"), {
      target: { value: "IF 條件函數更新" },
    });
    const preview = screen.getByText("學生看到的課程卡片 · 即時預覽");
    expect(preview.parentElement?.textContent).toContain("IF 條件函數更新");
    if (process.env.LIVE_PREVIEW_DIR) {
      mkdirSync(process.env.LIVE_PREVIEW_DIR, { recursive: true });
      writeFileSync(
        join(process.env.LIVE_PREVIEW_DIR, "lesson-editor.html"),
        `<!doctype html><html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="style.css"><body><main style="max-width:1200px;margin:auto;padding:24px">${document.body.innerHTML}</main></body></html>`,
      );
    }
    fireEvent.click(screen.getAllByRole("button", { name: "儲存變更" })[0]);
    await waitFor(() => expect(mocks.update).toHaveBeenCalled());
    expect(mocks.update.mock.calls[0][0].practice_exercises).toEqual(
      lesson.practice_exercises,
    );
  });
  it("adds and removes exercises while keeping form values in sync", async () => {
    await edit();
    fireEvent.click(screen.getByRole("button", { name: "新增題目" }));
    expect(screen.getByRole("heading", { name: "練習 3" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "刪除練習 3" }));
    fireEvent.click(screen.getByRole("button", { name: "刪除練習 1" }));
    expect(screen.getByDisplayValue("問題二")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "儲存變更" })[0]);
    await waitFor(() => expect(mocks.update).toHaveBeenCalled());
    expect(mocks.update.mock.calls[0][0].practice_exercises).toEqual([
      lesson.practice_exercises[1],
    ]);
  });
  it("appends an AI exercise instead of overwriting existing work", async () => {
    await edit();
    fireEvent.click(screen.getByRole("button", { name: /生成練習/ }));
    await screen.findByDisplayValue("AI 新題");
    expect(screen.getByDisplayValue("問題一")).toBeTruthy();
    expect(screen.getByDisplayValue("問題二")).toBeTruthy();
  });
  it("shows a clickable error summary that focuses the first invalid field", async () => {
    await edit();
    fireEvent.change(screen.getByLabelText("標題"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: "儲存變更" })[0]);
    const summaryLink = await screen.findByRole("link", { name: "基本資料" });
    fireEvent.click(summaryLink);
    expect(document.activeElement).toBe(screen.getByLabelText("標題"));
  });
  it("flags when a question and its explanation reference different model numbers", async () => {
    await edit();
    fireEvent.change(screen.getAllByLabelText("問題")[0], {
      target: { value: "請問 iPhone 16 的螢幕尺寸是多少？" },
    });
    fireEvent.change(screen.getAllByLabelText("解釋")[0], {
      target: { value: "iPhone 14 的螢幕尺寸是 6.1 吋。" },
    });
    await screen.findByText("「iPhone 14」跟題目對不上，請確認內容前後一致。");
  });
  it("saves manually-written exercises even when the AI prompt field is left blank", async () => {
    await edit();
    fireEvent.change(screen.getByLabelText("創建練習"), { target: { value: "" } });
    fireEvent.click(screen.getAllByRole("button", { name: "儲存變更" })[0]);
    await waitFor(() => expect(mocks.update).toHaveBeenCalled());
    expect(mocks.toast).not.toHaveBeenCalledWith(
      expect.objectContaining({ variant: "destructive" }),
    );
  });
  it("keeps the editor and draft on a rejected save without a partial retry", async () => {
    await edit();
    mocks.eq.mockResolvedValue({ error: { message: "column does not exist" } });
    fireEvent.click(screen.getAllByRole("button", { name: "儲存變更" })[0]);
    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "destructive" }),
      ),
    );
    expect(mocks.update).toHaveBeenCalledOnce();
    expect(screen.getByDisplayValue("問題二")).toBeTruthy();
  });
});
