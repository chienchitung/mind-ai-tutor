# Live presentation flow

This change adds a persisted presentation state for the dual-screen classroom mode.

## Teacher workflow

1. Create a poll (it starts in **draft**, including the first poll in a new session).
2. Show the question, open voting, close voting, then reveal results. Reopening retains existing votes and allows students to change their vote.
3. Q&A and reactions remain available when only voting is closed. Session pause/close still applies to all student interaction.
4. Feature a single public question, or show 3, 4 (default), or 6 pending questions per overview page. The overview's IDs/order are frozen until the teacher explicitly refreshes, changes sorting/density, or selects a different page. Hidden/answered questions are excluded when snapshots are read.
5. Use Back to slides or Blank screen at any time. Long single questions and polls expose scroll arrows only when the connected display reports overflow. The overview uses bounded cards (long text is summarized with an ellipsis; feature the question to read it fully). Content previews use the display content aspect ratio, defaulting to 1600:820 while disconnected, and container-relative typography. An enlarged preview is available.

6. Choose Popular / Newest / Oldest sorting. Display settings and offset survive reload; new public submissions are counted without replacing the frozen selection. Answer-and-next is one atomic owner command and chooses the next pending public question using the saved sorting.

## Synchronization and privacy

- Durable display mode, selected question IDs, poll phase and answered flags live in PostgreSQL.
- Realtime messages invalidate state. Clients refetch the authorized snapshot; reconnect and a five-second repair interval recover missed messages. The local display also receives same-origin invalidations immediately.
- Display refresh restores the selected poll/question/deck and requests current-page ink from the open teacher window. Ink is ephemeral and scoped to the deck URL/page; refreshing or closing the **teacher** window does not preserve its undo history or drawings.
- Drawing and laser events use `BroadcastChannel` on the same browser origin. This feature requires a modern browser and is intended for two windows on one computer, not a remote device. They no longer travel on the public student Realtime channel.
- `get_live_presentation(code)` exposes only public presentation data. It does not expose private questions, participant IDs, owner IDs or pulse responses. Before reveal its poll `voteCounts` is empty; legacy aggregate tally RPCs are unchanged and still publicly readable. This is a presentation reveal workflow, not a secret-ballot security boundary.
- `control_live_presentation` checks the signed-in session owner and locks the session. The vote trigger locks the same row, rejects votes outside the open phase and verifies the active poll. Stale UI commands cannot control a replacement poll.
- QR codes are generated locally; codes are not sent to an external QR service.

## Rollout — migration before application deployment

Apply `supabase/migrations/20260904051713_live_presentation_flow.sql` **after** the existing `scripts/add_live_sessions.sql` and `scripts/add_live_session_phase2.sql` setup, before deploying this app version. The repository's older schema lives in `scripts/`; this is an incremental migration, not a complete empty-database bootstrap.

Also apply `supabase/migrations/20260904101418_live_qa_display_options.sql` after the initial presentation migration and before deploying the adjustable Q&A UI. This replaces the two RPC definitions without changing existing rows or grants. Roll back this UI before restoring the prior RPC definitions if required.

The migration is additive and transactional. Existing polls default to open for compatibility with current sessions. It adds no direct anonymous table grants. Only the owner command RPC can change phases; the guard also protects existing vote RPC callers.

Rollback: revert the application first. If reverting to a client without phase controls, an administrator must deliberately reopen any draft/closed/results polls they intend to continue using. Do not blindly reopen all ended polls. Keep additive columns/functions until no new clients are in use.

## Validation

- PGlite runs the actual base SQL plus this migration: owner isolation, anonymous denial, legal/illegal transitions, stopped votes, public question filtering, stable ordering, answered questions and ended sessions.
- React tests cover projection restoration, fullscreen denial/re-entry, deck-scoped ink, local transport, reveal/blank/end rendering, queued user actions during reads, and failed mutations/reconnect.
- Full repo Vitest, TypeScript, targeted ESLint and production build are run locally.
- Browser checks use synthetic rendered fixtures for layout; they do not certify production Supabase or physical dual-monitor behavior. Production migration and an authenticated two-window smoke test remain rollout requirements.

## Shared slide tools and joining footer

Both fullscreen slides and the secondary display use PresentationStage: page navigation, cursor/laser/pen/eraser, colors, width, undo/redo, keyboard shortcuts, right-click tools and pinned controls. The QR join footer remains visible independently of the toolbar auto-hide timer; the PDF fits above its reserved 80px area.

The teacher owns annotation history in both modes. The secondary display sends deck/page-scoped commands with the base drawing; malformed or stale commands are rejected and current history replayed. Drawing requires the teacher window to remain connected. Display-page navigation uses the existing authenticated owner API. The secondary display's classroom control button returns to the teacher window (opens it if unavailable), keeping moderation on the teacher side. Single-screen mode retains its inline Q&A/poll panel.

No database migration is required for this shared-tools update. Validation includes browser drawing/undo/QR layout on a local PDF and component tests for dual-window undo routing and fullscreen recovery; physical projector hardware is not covered.
