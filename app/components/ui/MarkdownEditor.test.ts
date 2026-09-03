// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import { markdownEditorExtensions } from "./markdown-editor-extensions";
import type { MarkdownStorage } from "tiptap-markdown";

function roundTrip(markdown: string): string {
  const editor = new Editor({ extensions: markdownEditorExtensions(), content: markdown });
  const out = (editor.storage as unknown as { markdown: MarkdownStorage }).markdown.getMarkdown();
  editor.destroy();
  return out;
}

describe("MarkdownEditor round trip", () => {
  it("preserves headings, bold and lists", () => {
    const out = roundTrip("# 標題\n\n學會使用 **IF** 函數。\n\n- 項目一\n- 項目二\n");
    expect(out).toContain("# 標題");
    expect(out).toContain("**IF**");
    expect(out).toContain("- 項目一");
    expect(out).toContain("- 項目二");
  });

  it("preserves a blockquote callout", () => {
    const out = roundTrip("> ⚠️ **Warning:** 別忘了加上引號。\n");
    expect(out).toContain("> ⚠️ **Warning:**");
  });

  it("preserves a GFM table", () => {
    const out = roundTrip("| 欄位 | 說明 |\n| --- | --- |\n| A1 | 分數 |\n");
    expect(out).toContain("欄位");
    expect(out).toContain("A1");
    expect(out).toContain("|");
  });

  it("preserves a fenced code block", () => {
    const out = roundTrip('```\n=IF(A1>60,"及格","不及格")\n```\n');
    expect(out).toContain("=IF(A1>60");
  });

  it("keeps a standalone image and a following link on separate lines", () => {
    // Regression test: @tiptap/extension-image v3 defaults to a block-level
    // node. Without Image.configure({ inline: true }) in
    // markdown-editor-extensions.ts, an image immediately followed by
    // another block collapses onto the same line on serialization.
    const out = roundTrip("![alt](https://example.com/a.png)\n\n[link](https://example.com)\n");
    expect(out).toContain("![alt](https://example.com/a.png)\n\n[link](https://example.com)");
  });
});
