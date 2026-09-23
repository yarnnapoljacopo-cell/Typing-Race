# Logic review and fixes

Reviewed sprint connections, reconnect/restart behavior, co-writing, writing backups, Folio synchronization, and compilation. Changes are local and have not been deployed.

## Fixed

- Forward `/ws` through Vite and route sprint/co-writing upgrades independently, so the sprint server does not abort co-writing connections.
- Retry initial connection failures, keep the client connected after results, and ignore events from replaced sockets. A stale connection can no longer remove or control its replacement.
- Require a verified Clerk session to claim an account over WebSocket. Protect guest reconnections with a session token, check co-writing document membership, and remove the HTTP body-user-ID authentication fallback.
- Reject malformed socket messages, invalid word counts, and invalid restart durations; catch asynchronous handler failures instead of letting them escape the event callback.
- Preserve current in-memory progress on reconnect, including deliberate deletions. Preserve results during asynchronous finalization and use kart finishing scores for winner rewards.
- Save a departing co-writing chapter under its own ID. Merge CRDT backups instead of inserting duplicate HTML or replacing concurrent edits, serialize persistence, share concurrent document loads, and broadcast each edit once.
- Serialize Folio uploads, retain failed saves for retry, and prevent background uploads while conflict resolution is pending.
- Return a failure when writing persistence fails, protect account-owned writing reads, and catch synchronous room-persistence errors.
- Load local environment configuration before modules consume it. Fix the existing TypeScript errors and restrict Vite's dependency scan to the actual app entry.

## Verification

- `pnpm run typecheck` — passed across the workspace.
- `BASE_PATH=/ pnpm --filter @workspace/writing-sprint run build` — passed; existing sourcemap warnings remain.
- `pnpm --filter @workspace/api-server run build` — passed.
- `pnpm --filter @workspace/api-server test` — 14 regression tests passed.
- `pnpm --filter @workspace/api-server run stress` — 32 assertions passed.
- Open `/sim/connection-regressions.html` on the Vite dev server — 3 browser checks passed against the real React connection hook.
- Live WebSocket handshake through the Vite proxy to the rebuilt local API — passed.

The regression suite uses real socket handlers, JWT signature verification, Yjs documents, and the Folio store, with a controlled database adapter. It does not validate PostgreSQL queries or transactions against a real database. The browser fixture simulates network events; it does not replace the normal app connection.

## Validation still requiring service configuration

This checkout has no `DATABASE_URL` or Clerk server credentials. Complete signed-in flows, database migrations, reward transactions, and production persistence therefore remain unverified end to end. Set the API environment in `artifacts/api-server/.env` before testing those flows. This review is scoped to the paths above, not a guarantee that every application feature is free of defects.

## Game modes and editor follow-up

The visual redesign was reverted at the user's request. The original portal, navigation, theme, room layout, and mode artwork are restored. Functional improvements remain:

- Kart targeting, item odds, standings, and traps use actual boosted position. Stars block theft, and temporary effects restore/reset correctly.
- Gladiator damage and danger duration use elapsed time, repeated deleted words cannot farm healing, and HP winners agree across results, rewards, and bets. Admission/countdown requires two fighters. Results can be dismissed to reach writing and restart controls.
- Boss contribution excludes editors, the client receives the final defeated state, and results no longer announce a victory when the timer expires before the goal.
- Timed races no longer claim a finish at an arbitrary track scale. Goal modes retain real finish lines.
- Validate room durations, countdowns, target values, and required passwords. Show correct mode labels and use guests' chosen names.
- Native paragraph editing retains undo and composition input. Toolbar formatting works from the keyboard, line spacing honors the selected preference, and spellcheck is enabled.
- Preserve drafts across round restarts and completed-chapter counts across reconnects. Reset round-specific result, reward-query, and snapshot flags. Avoid claiming an older asynchronous draft save covers newer edits.
- Ignore admission snapshots until participant identity/restored counts arrive, and display recoverable action errors without replacing the writing screen.

Additional verification: 24 API regression tests and 32 stress assertions passed; workspace typecheck and frontend/API production builds passed. Browser checks covered native undo/redo, warm-up exclusion, final results, and draft retention on restart with the actual Room component using a simulated local transport. The local fixture is `/sim/studio-preview.html?mode=regular`; it is excluded from the production build. All 16 browser network/state regression checks passed.

Known persistence limitation: writing history is keyed by room code and writer name, so multiple rounds can replace that history entry. A separate schema migration would be needed to retain independent records per round. Real PostgreSQL/authenticated service integration remains subject to the configuration limitation above.
