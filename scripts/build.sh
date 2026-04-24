#!/usr/bin/env bash
# build.sh — called by railway.toml buildCommand
# Reads NODE_ENV from the Railway dashboard env var (default: production)
# This lets the same railway.toml serve both the production and development services.
set -euo pipefail

: "${NODE_ENV:=production}"
echo "[build] NODE_ENV=$NODE_ENV"

# Disable corepack to avoid signature verification failures on Node 18 (known
# corepack/keyid mismatch bug). pnpm is already available in the environment;
# this just removes the corepack wrapper so it runs directly.
corepack disable

pnpm install --no-frozen-lockfile

# Attempt schema push — only works if DATABASE_URL is available at build time
# (Railway injects it at runtime, so this is usually a no-op; ensureSchema() in
# the server handles the actual migration on startup)
pnpm --filter @workspace/db push || echo "[build] DB push skipped (DATABASE_URL not available at build time — that is expected)"

# Build the frontend with the correct NODE_ENV baked in
PORT=3000 BASE_PATH=/ NODE_ENV="$NODE_ENV" pnpm --filter @workspace/writing-sprint run build

# Build the API server
pnpm --filter @workspace/api-server run build

echo "[build] Done."
