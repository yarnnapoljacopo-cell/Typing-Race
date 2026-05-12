#!/bin/sh
git add lib/db/src/index.ts artifacts/api-server/src/lib/roomManager.ts artifacts/api-server/src/lib/xpDecay.ts
git commit -m "Increase idleTimeoutMillis 30s->360s to survive xpDecay scan interval

Root cause (from logs): xpDecay scan creates a connection that completes auth
cleanly (connect+scan fire within 1ms). 30s later, idle timeout removes it.
At the exact moment of removal, pg-pool _pulseQueue fires internally. If any
concurrent HTTP waiter exists, a new TCP+SSL connection is started. DB slow at
that moment -> hangs in auth -> zombie. One zombie per scan cycle.

Fix: idleTimeoutMillis=360s (6 min) > xpDecay scan interval (5 min). The
connection from scan N is reused by scan N+1 without a new SSL handshake.
No removal fires between scans, so _pulseQueue is never triggered between
scans, eliminating the removal-coincident zombie pattern.

keepAlive=true + keepAliveInitialDelayMillis=10s keeps Railway's load balancer
from dropping the connection during the 6-min idle window.

Also includes prior fixes: xpDecay single-CTE batch UPDATE, PERSIST_BACKOFF_MS
30s->15s, pool CONNECT/ACQUIRE/REMOVE stack traces (pending Railway watch path
fix in dashboard to deploy)."
git push origin HEAD:main
