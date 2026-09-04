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
type Draft = { history: InkHistory; base: InkStroke[] };
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
    } else if (!conflict) {
      send({
        type: "annotation-action",
        deckUrl,
        page,
        baseStrokes: remote!.strokes,
        action: { type: "commit", page, strokes: draft.history.strokes },
      });
    }
  }, [draft, connected, matches, remote, key, deckUrl, page, conflict, send]);
  const act = (action: AnnotationAction) => {
    if (!draft && connected && matches) {
      send({
        type: "annotation-action",
        deckUrl,
        page,
        baseStrokes: remote!.strokes,
        action,
      });
      return;
    }
    setDrafts((previous) => {
      const current = previous[key];
      const history = annotationReducer(
        { [page]: current?.history ?? remoteHistory },
        action,
      )[page];
      return {
        ...previous,
        [key]: { history, base: current?.base ?? remoteHistory.strokes },
      };
    });
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
                [key]: { ...previous[key], base: remote!.strokes },
              }
            : previous,
        );
    },
  };
}
