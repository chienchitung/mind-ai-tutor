// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { LanguageProvider } from "@/app/contexts/LanguageContext";
import MarkdownEditorInner from "./MarkdownEditorInner";

vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

afterEach(() => cleanup());

describe("MarkdownEditorInner", () => {
  it("mounts the WYSIWYG surface with a formatting toolbar, not raw markdown syntax", async () => {
    render(
      <LanguageProvider>
        <MarkdownEditorInner value={"# 標題\n\n學會使用 **IF** 函數。"} onChange={() => {}} />
      </LanguageProvider>,
    );

    await waitFor(() => expect(screen.getByRole("button", { name: "粗體" })).toBeTruthy());
    expect(screen.getByRole("button", { name: "標題 1" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "插入表格" })).toBeTruthy();

    // The heading and bold mark should render as actual formatted elements,
    // not the literal "#" / "**" syntax a raw-markdown editor would show.
    await waitFor(() => expect(screen.getByRole("heading", { level: 1, name: "標題" })).toBeTruthy());
    expect(screen.getByText("IF").tagName).toBe("STRONG");
    expect(screen.queryByText(/\*\*IF\*\*/)).toBeNull();
  });
});
