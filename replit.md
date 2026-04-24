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
- Room modes: regular, open (no time limit), goal (word target), boss battle (collective HP boss)
- Death Mode: typing speed floor — fall below WPM threshold and the sprint ends for you
- Focus Mode: hides all UI chrome for distraction-free writing
- XP/Levels system: 8 ranks (Blank Page → Ranker 👑), 1 XP per 5 words, 2× for 1st place; XP decay after 5-day idle
- Writer profiles at `/profile/:name` with rank badge, XP bar, and rank progression
- My Files page: saved sprint writing capsules per user
- Clerk auth + guest mode; XP only awarded to signed-in users
- Global Ranking leaderboard (`/global-ranking`): locked to Ranker-tier users (200k+ XP)
- **Data persistence**: server finalizes all writing + awards XP at `endSprint` (`finalizeSprintData`); `xpAwarded` flag on `sprint_writing` prevents double-award between server and client paths
- **Cultivation system**: Bag (`/bag`), Chests (`/chests`), Crafting Lab (`/crafting`) — complete item/chest/crafting feature with 171 items across 6 rarity tiers; sprint completion awards Mortal Chest, win awards Iron Chest; active effects (30+ handlers) integrate with XP calculation at `/api/user/xp`

### API Server (`artifacts/api-server`)
- Express 5 server at `/api` and `/ws`
- WebSocket server for real-time room management (`src/lib/wsHandler.ts`)
- In-memory room manager (`src/lib/roomManager.ts`) — rooms live for 2 hours
- PostgreSQL writing backup: PUT /api/rooms/:code/writing, GET /api/rooms/:code/writing/:name
- Writing store (`src/lib/writingStore.ts`) — Drizzle upsert/fetch on `sprint_writing` table
- XP endpoint: POST /api/user/xp (awards XP to signed-in users after sprints)
- Public profile endpoint: GET /api/user/profile/:name (returns xp, wordCount totals)
- Boss battle: bossWordGoal column in rooms table; roomManager tracks collective HP and broadcasts defeat

## WebSocket Protocol

Rooms are identified by codes like `SPRINT-4821`. Real-time sync uses WebSockets at `/ws`.
Message types: join_room, text_update, start_sprint, end_sprint, restart_sprint, ping
Room status flow: waiting → running → finished

## Important Notes
- After each OpenAPI spec change, run codegen and then manually fix `lib/api-zod/src/index.ts` to only export `./generated/api` (orval regenerates it with duplicates)
- The `/ws` path must remain in the API server's `artifact.toml` paths array for WebSocket proxying to work

## Rank Reward System
- DB: `user_profiles` has `active_nameplate` + `active_skin` columns
- Nameplates: default / crimson (10k XP, Ink Reaper) / gold (25k, Grand Scribe) / blue (75k, Eternal Quill) / purple (200k, The Ranker)
- Skins: Eternal (75k, stars canvas) / Final (200k, gold ink-drop canvas reacting to typing speed)
- Room WS: `broadcastRoomState` sends participant `nameplate`+`xp` + `creatorXp`
- Grand Scribe banner shown in room when host XP >= 25k; Ranker banner when >= 200k
- Ranker Crown (👑) shown next to participant names in SpectatorView
- `SkinOverlay` component mounted in Room.tsx (cosmic stars or gold ink drops)
- `SkinProvider` context in App.tsx: reads `localStorage.activeSkin`, sets `html[data-skin]`
- Portal skin toggle button (unlocked at 75k XP) cycles Default → Eternal → Final
- Profile.tsx nameplate picker: shows when viewing own profile, saves via PATCH /user/preferences
- API: `GET /api/user/profile` returns `activeNameplate`+`activeSkin`+`writerName`; `PATCH /user/preferences` validates XP before saving

### Discord Bot (`artifacts/discord-bot`)
- Standalone Node.js + TypeScript process (not a web artifact)
- Mirrors the Sprinto bot flow: `/sprint`, `/join`, `/words`, `/leave`, `/cancel`, `/end`, `/time`, `/status`, `/pb`, `/stats`
- Creates Writing Sprint rooms via REST API (`POST /api/rooms`) as "DiscordBot" creator
- Connects to the backend WebSocket (`/ws`) to trigger `start_sprint` / `end_sprint`
- Tracks Discord participants and word count submissions internally
- Per-guild stats persisted in `artifacts/discord-bot/data/stats.json`
- Requires env secrets: `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `API_BASE_URL`
- One-time command registration: `pnpm --filter @workspace/discord-bot run deploy`
- Started via the "Discord Bot" workflow (configure and start once secrets are set)

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
