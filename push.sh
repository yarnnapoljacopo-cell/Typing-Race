#!/bin/sh
git add lib/db/src/index.ts artifacts/api-server/src/lib/roomManager.ts artifacts/api-server/src/lib/xpDecay.ts
git commit -m "Fix xpDecay zombie connections: replace pool.connect() with pool.query()

Root cause: runDecayDb() called pool.connect() to open a manual transaction.
When the DB is intermittently slow, pg internally starts a new TCP connection
for pool.connect(). If that auth handshake takes >4s, pg's AuthTimeoutClient
fires, leaving an active=1 tracked=0 zombie per scan (every 5 min) until the
watchdog threshold forces a restart.

Fix: replace pool.connect() + BEGIN/COMMIT/ROLLBACK with two plain pool.query()
calls — each auto-releases immediately after completing, no connection held
between SELECT and UPDATE, no manual transaction needed.

Also includes: PERSIST_BACKOFF_MS 30s->15s (roomManager.ts), pool lifecycle
logging (lib/db/src/index.ts)."
git push origin HEAD:main
