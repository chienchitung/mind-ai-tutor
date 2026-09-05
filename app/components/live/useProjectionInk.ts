"use client";
import { useEffect, useState } from "react";
import {
  annotationReducer,
  EMPTY_INK,
  type InkHistory,
  type InkStroke,
  type AnnotationAction,
} from "@/lib/presentation-annotations";
type Remote = {
  deckUrl: string | null;
  page: number;
  strokes: InkStroke[];
  history?: InkHistory;
};
type Draft = { history: InkHistory; base: InkStroke[]; sent: boolean };
const signature = (strokes: InkStroke[]) =>
  JSON.stringify(
    strokes.map((s) => [
      s.id,
      s.color,
      s.width,
      s.points.map((p) => [p.x, p.y]),
    ]),
  );
export function useProjectionInk(
  deckUrl: string | null,
  page: number,
  remote: Remote | null,
  connected: boolean,
  send: (value: unknown) => void,
) {
  const key = JSON.stringify([deckUrl, page]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [saved, setSaved] = useState<Record<string, InkHistory>>({});
  const matches =
    !!remote && remote.deckUrl === deckUrl && remote.page === page;
  const remoteHistory = matches
    ? (remote.history ?? { ...EMPTY_INK, strokes: remote.strokes })
    : (saved[key] ?? EMPTY_INK);
  const draft = drafts[key];
  const conflict =
    !!draft &&
    matches &&
    signature(draft.base) !== signature(remote!.strokes) &&
    signature(draft.history.strokes) !== signature(remote!.strokes);
  useEffect(() => {
    if (!remote) return;
    const remoteKey = JSON.stringify([remote.deckUrl, remote.page]);
    setSaved((previous) => ({
      ...previous,
      [remoteKey]: remote.history ?? { ...EMPTY_INK, strokes: remote.strokes },
    }));
  }, [remote]);
  useEffect(() => {
    if (!draft || !connected || !matches) return;
    if (signature(draft.history.strokes) === signature(remote!.strokes)) {
      setDrafts((previous) => {
        const next = { ...previous };
        delete next[key];
        return next;
      });
    } else if (!conflict && !draft.sent) {
      send({
        type: "annotation-action",
        deckUrl,
        page,
        baseStrokes: remote!.strokes,
        action: { type: "commit", page, strokes: draft.history.strokes },
      });
      setDrafts((previous) =>
        previous[key] === draft
          ? { ...previous, [key]: { ...draft, sent: true } }
          : previous,
      );
    }
  }, [draft, connected, matches, remote, key, deckUrl, page, conflict, send]);
  useEffect(() => {
    if (connected || !draft?.sent) return;
    setDrafts((previous) =>
      previous[key] === draft
        ? { ...previous, [key]: { ...draft, sent: false } }
        : previous,
    );
  }, [connected, draft, key]);
  const act = (action: AnnotationAction) => {
    // Always apply the command locally first. Waiting for the teacher window
    // to echo it makes a finished pen stroke disappear between pointer-up and
    // the round trip; it also leaves the eraser with no visible stroke to hit
    // when that acknowledgement is delayed or missed. The effect above sends
    // this optimistic draft and retires it only after the same strokes return.
    const history = annotationReducer(
      { [page]: draft?.history ?? remoteHistory },
      action,
    )[page];
    const canSend = connected && matches && !conflict;
    if (canSend) {
      send({
        type: "annotation-action",
        deckUrl,
        page,
        baseStrokes: remote!.strokes,
        // Preserve undo/redo semantics when there is no earlier command in
        // flight. If there is, send the cumulative visible result so commands
        // cannot be applied out of order by the teacher window.
        action: draft
          ? { type: "commit", page, strokes: history.strokes }
          : action,
      });
    }
    setDrafts((previous) => ({
      ...previous,
      [key]: {
        history,
        base: previous[key]?.base ?? remoteHistory.strokes,
        sent: canSend,
      },
    }));
  };
  return {
    history: draft?.history ?? remoteHistory,
    act,
    pending: !!draft,
    conflict,
    useRemote: () =>
      setDrafts((previous) => {
        const next = { ...previous };
        delete next[key];
        return next;
      }),
    keepLocal: () => {
      if (matches)
        setDrafts((previous) =>
          previous[key]
            ? {
                ...previous,
                [key]: { ...previous[key], base: remote!.strokes, sent: false },
              }
            : previous,
        );
    },
  };
}
