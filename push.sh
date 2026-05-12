#!/bin/sh
git add lib/db/src/index.ts artifacts/api-server/src/lib/roomManager.ts artifacts/api-server/src/lib/xpDecay.ts
git commit -m "Add stack traces to pool connect/acquire/remove events for leak diagnosis

Extend existing pool lifecycle logging with full call stacks (8 frames) on
connect, acquire, and remove events. This identifies the exact code path that
opens connections that never reach acquire (auth-phase zombies) and never get
removed. Also includes prior fixes: xpDecay single-CTE batch UPDATE,
PERSIST_BACKOFF_MS 30s->15s."
git push origin HEAD:main
