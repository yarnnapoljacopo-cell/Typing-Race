# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **WebSockets**: ws (real-time sprint rooms)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Artifacts

### Writing Sprint (`artifacts/writing-sprint`)
- React + Vite web app at `/`
- Multiplayer writing sprint with real-time race track
- WebSocket-based room system (`/ws` path)
- REST endpoints: POST /api/rooms (create), GET /api/rooms/:code (lookup)

### API Server (`artifacts/api-server`)
- Express 5 server at `/api` and `/ws`
- WebSocket server for real-time room management (`src/lib/wsHandler.ts`)
- In-memory room manager (`src/lib/roomManager.ts`) — rooms live for 2 hours
- PostgreSQL writing backup: PUT /api/rooms/:code/writing, GET /api/rooms/:code/writing/:name
- Writing store (`src/lib/writingStore.ts`) — Drizzle upsert/fetch on `sprint_writing` table

## WebSocket Protocol

Rooms are identified by codes like `SPRINT-4821`. Real-time sync uses WebSockets at `/ws`.
Message types: join_room, text_update, start_sprint, end_sprint, restart_sprint, ping
Room status flow: waiting → running → finished

## Important Notes
- After each OpenAPI spec change, run codegen and then manually fix `lib/api-zod/src/index.ts` to only export `./generated/api` (orval regenerates it with duplicates)
- The `/ws` path must remain in the API server's `artifact.toml` paths array for WebSocket proxying to work

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
