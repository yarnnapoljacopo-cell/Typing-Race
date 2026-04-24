#!/usr/bin/env bash
# build.sh — called by railway.toml buildCommand
# Reads NODE_ENV from the Railway dashboard env var (default: production)
# This lets the same railway.toml serve both the production and development services.
set -euo pipefail

: "${NODE_ENV:=production}"
echo "[build] NODE_ENV=$NODE_ENV"

# Use npm exec to invoke pnpm directly, bypassing the broken mise pnpm shim
# ("pnpm is not a valid shim" error). npm is always available and can locate
# the real pnpm binary without going through mise's shim layer.

npm exec pnpm -- install --no-frozen-lockfile

# Attempt schema push — only works if DATABASE_URL is available at build time
# (Railway injects it at runtime, so this is usually a no-op; ensureSchema() in
# the server handles the actual migration on startup)
npm exec pnpm -- --filter @workspace/db push || echo "[build] DB push skipped (DATABASE_URL not available at build time — that is expected)"

# Build the frontend with the correct NODE_ENV baked in
VITE_CLERK_PK="${VITE_CLERK_PK:-pk_live_Y2xlcmsud3JpdGluZ3NwcmludC5zaXRlJA}" \
VITE_CLERK_PUBLISHABLE_KEY="${VITE_CLERK_PUBLISHABLE_KEY:-pk_live_Y2xlcmsud3JpdGluZ3NwcmludC5zaXRlJA}" \
PORT=3000 BASE_PATH=/ NODE_ENV="$NODE_ENV" npm exec pnpm -- --filter @workspace/writing-sprint run build

# Build the API server
npm exec pnpm -- --filter @workspace/api-server run build

echo "[build] Done."
