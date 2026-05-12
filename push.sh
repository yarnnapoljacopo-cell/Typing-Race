#!/bin/sh
git add lib/db/src/index.ts artifacts/api-server/src/lib/roomManager.ts artifacts/api-server/src/lib/xpDecay.ts
git commit -m "Fix xpDecay zombie cascade: collapse per-user queries into single CTE UPDATE

Root cause of cascade: old approach made 1 + 2*N pool.query() calls per scan
(findUsersNeedingDecay SELECT + per-user SELECT + per-user UPDATE). When DB
degrades mid-scan, the UPDATE for user N times out -> pg-pool destroys that
connection (release-with-error). The next user's pool.query() must open a NEW
TCP connection. If DB is still slow, that connection hangs in PG auth phase ->
auth-phase zombie (active+1, tracked=0). N users = N zombies -> watchdog exit.
Explains the 'active=5, tracked=0' pattern on scan 5 (first scan with users).

Fix: single CTE UPDATE does candidate selection, decay calculation, and all
row updates in one SQL statement -> one connection borrowed and released per
scan. Cascade is impossible: if the query fails, one connection is destroyed,
not N. Rank thresholds and decay rates inlined as CASE expressions in SQL.

Also includes: PERSIST_BACKOFF_MS 30s->15s (roomManager.ts), pool lifecycle
logging (lib/db/src/index.ts)."
git push origin HEAD:main
