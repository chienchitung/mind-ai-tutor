// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { LanguageProvider } from "@/app/contexts/LanguageContext";
import PresentDisplayPage from "./page";
const mocks = vi.hoisted(() => ({
  events: new Map<string, () => void>(),
  channels: [] as any[],
}));
vi.mock("next/navigation", () => ({ useParams: () => ({ id: "123456" }) }));
vi.mock("@/components/live/JoinQRCode", () => ({
  JoinQRCode: () => <div>QR</div>,
}));
vi.mock("@/components/live/DeckViewer", () => ({
  DeckViewer: ({
    overlay,
    page,
  }: {
    overlay: React.ReactNode;
    page: number;
  }) => (
    <div data-testid="deck" data-page={page}>
      {overlay}
    </div>
  ),
}));
vi.mock("@/lib/supabase", () => ({
  supabase: () => {
    const channel = {
      on: (_: string, { event }: { event: string }, handler: () => void) => {
        mocks.events.set(event, handler);
        return channel;
      },
      subscribe: () => channel,
    };
    return { channel: () => channel, removeChannel: vi.fn() };
  },
}));
const initial = {
  sessionId: "123456",
  title: "Test class",
  status: "open",
  joinCode: "482910",
  poll: null,
  deckUrl: "/deck.pdf",
  deckPage: 1,
  mode: "deck",
  questions: [],
  answeredIds: [],
};
let current: any;
let deleted = false;
beforeEach(() => {
  current = { ...initial };
  deleted = false;
  mocks.events.clear();
  mocks.channels = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: !deleted,
      status: deleted ? 404 : 200,
      json: async () => current,
    })),
  );
  vi.stubGlobal(
    "BroadcastChannel",
    class {
      onmessage: any = null;
      postMessage = vi.fn();
      close() {}
      constructor(public name: string) {
        mocks.channels.push(this);
      }
    },
  );
  Element.prototype.requestFullscreen = vi.fn().mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
async function mount() {
  render(
    <LanguageProvider>
      <PresentDisplayPage />
    </LanguageProvider>,
  );
  await screen.findByTestId("deck");
}
async function notify(event: string) {
  await act(async () => {
    mocks.events.get(event)?.();
  });
}
function ink(message: any) {
  act(() =>
    mocks.channels
      .find((c) => c.name === "live-ink:123456")
      .onmessage({ data: message }),
  );
}
describe("reliable projected display", () => {
  it("keeps pen, laser and eraser active without a teacher connection", async () => {
    await mount();
    fireEvent.click(screen.getByRole("button", { name: "開始投影" }));
    const surface = document.querySelector('[data-annotation-surface]') as SVGElement;
    for (const [key, cursor] of [['p', 'crosshair'], ['l', 'none'], ['e', 'cell']]) {
      fireEvent.keyDown(surface, { key });
      expect(surface.style.cursor).toBe(cursor);
    }
    expect(screen.getByText(/老師控制台未連線；工具仍可使用/)).toBeTruthy();
  });
  it("exposes the shared tools and routes undo back to the teacher history", async () => {
    await mount();
    const strokes = [{ id: "s", points: [{ x: 0.1, y: 0.1 }], width: 3, color: "#fb7185" }];
    ink({ type:"ink", page:1, deckUrl:"/deck.pdf", strokes, history:{strokes,past:[[]],future:[]} });
    fireEvent.click(screen.getByRole("button",{name:"開始投影"}));
    expect(await screen.findByRole("button",{name:"投影工具"})).toBeTruthy();
    fireEvent.click(screen.getByRole("button",{name:"復原"}));
    const channel=mocks.channels.find(c=>c.name==="live-ink:123456");
    expect(channel.postMessage).toHaveBeenCalledWith({type:"annotation-action",page:1,deckUrl:"/deck.pdf",baseStrokes:strokes,action:{type:"undo",page:1}});
  });
  it("opens the fullscreen gate and keeps a re-entry action when fullscreen is unsupported", async () => {
    await mount();
    fireEvent.click(screen.getByRole("button", { name: "開始投影" }));
    await waitFor(() =>
      expect(Element.prototype.requestFullscreen).toHaveBeenCalled(),
    );
    expect(screen.getByRole("button", { name: "回到全螢幕" })).toBeTruthy();
  });
  it("refetches authoritative deck state rather than trusting a broadcast payload", async () => {
    await mount();
    current = { ...current, deckPage: 4 };
    await notify("deck:sync");
    await waitFor(() =>
      expect(screen.getByTestId("deck").getAttribute("data-page")).toBe("4"),
    );
  });
  it("requests ink on mount and scopes late strokes/pointers to their deck and page", async () => {
    await mount();
    const channel = mocks.channels.find((c) => c.name === "live-ink:123456");
    expect(channel.postMessage).toHaveBeenCalledWith({ type: "ready" });
    ink({
      type: "ink",
      page: 1,
      deckUrl: "/deck.pdf",
      strokes: [
        { id: "s", points: [{ x: 0.1, y: 0.1 }], width: 3, color: "#fff" },
      ],
    });
    expect(document.querySelector('[data-ink-stroke="s"]')).toBeTruthy();
    ink({
      type: "live",
      page: 1,
      deckUrl: "/deck.pdf",
      payload: {
        tool: "laser",
        color: "#fff",
        width: 3,
        draft: [],
        pointer: { x: 0.5, y: 0.5 },
      },
    });
    expect(document.querySelector("[data-laser-pointer]")).toBeTruthy();
    current = { ...current, deckPage: 2 };
    await notify("deck:sync");
    expect(document.querySelector('[data-ink-stroke="s"]')).toBeNull();
    expect(document.querySelector("[data-laser-pointer]")).toBeNull();
  });
  it("restores a pinned question directly on refresh without needing another broadcast", async () => {
    current = {
      ...current,
      mode: "question",
      questions: [{ id: "q", text: "Pinned question", upvotes: 2 }],
    };
    render(
      <LanguageProvider>
        <PresentDisplayPage />
      </LanguageProvider>,
    );
    expect(await screen.findByText("Pinned question")).toBeTruthy();
    expect(screen.queryByTestId("deck")).toBeNull();
  });
  it("clears the deck when the session ends or is deleted", async () => {
    await mount();
    current = { ...current, status: "closed" };
    await notify("session:status");
    expect(await screen.findByText("本場次已結束，謝謝參與")).toBeTruthy();
    expect(screen.queryByTestId("deck")).toBeNull();
    deleted = true;
    await notify("session:deleted");
    expect(screen.queryByTestId("deck")).toBeNull();
  });
  it("shows a welcome screen without requiring an uploaded deck", async () => {
    current = { ...current, deckUrl: null };
    render(
      <LanguageProvider>
        <PresentDisplayPage />
      </LanguageProvider>,
    );
    expect(await screen.findByText("歡迎加入，等待老師開始")).toBeTruthy();
  });
});
