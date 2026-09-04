// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { RemoteInkOverlay } from "./RemoteInkOverlay";

const stroke = { id: "s1", points: [{ x: 0.1, y: 0.1 }, { x: 0.2, y: 0.2 }], color: "#fb7185", width: 3 };

afterEach(() => cleanup());

describe("RemoteInkOverlay", () => {
  it("renders committed strokes and an in-progress draft as separate polylines", () => {
    render(
      <RemoteInkOverlay
        strokes={[stroke]}
        draft={[{ x: 0.5, y: 0.5 }, { x: 0.6, y: 0.6 }]}
        pointer={null}
        tool="pen"
        color="#38bdf8"
        width={6}
        label="投影標註"
      />,
    );
    expect(document.querySelector('[data-ink-stroke="s1"]')).toBeTruthy();
    expect(document.querySelector('[data-ink-stroke="draft"]')).toBeTruthy();
  });

  it("shows the laser dot only for laser/eraser tools, never for pen", () => {
    const { rerender } = render(
      <RemoteInkOverlay strokes={[]} draft={[]} pointer={{ x: 0.5, y: 0.5 }} tool="laser" color="#fff" width={3} label="投影標註" />,
    );
    expect(document.querySelector('[data-laser-pointer]')).toBeTruthy();
    rerender(
      <RemoteInkOverlay strokes={[]} draft={[]} pointer={{ x: 0.5, y: 0.5 }} tool="pen" color="#fff" width={3} label="投影標註" />,
    );
    expect(document.querySelector('[data-laser-pointer]')).toBeNull();
  });

  it("is purely presentational - no interaction, no click/pointer handlers to fire", () => {
    render(
      <RemoteInkOverlay strokes={[stroke]} draft={[]} pointer={null} tool="cursor" color="#fff" width={3} label="投影標註" />,
    );
    const svg = screen.getByRole("img", { name: "投影標註" });
    expect(svg.closest('[class*="pointer-events-none"]')).toBeTruthy();
  });
});
