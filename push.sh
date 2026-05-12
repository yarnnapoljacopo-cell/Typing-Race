#!/bin/sh
git add lib/db/src/index.ts artifacts/api-server/src/lib/roomManager.ts
git commit -m "Fix synchronized persist burst: PERSIST_BACKOFF_MS 30s->15s; add pool lifecycle logging"
git push origin HEAD:main
