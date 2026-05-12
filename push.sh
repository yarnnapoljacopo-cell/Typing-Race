#!/bin/sh
git add lib/db/src/index.ts
git commit -m "Remove acquire stack trace, simplify connect/remove to single-line logs

pool.on('acquire') fired on every query and hit Railway's 500 logs/sec rate
limit at startup. Removed the log entirely; the acquire handler still updates
the checkedOut map for the leak/hold-time sweep.

pool.on('connect') and pool.on('remove') reduced to single-line info logs
without stack traces — sufficient for ongoing new-connection monitoring now
that the zombie leak is resolved."
git push origin HEAD:main
