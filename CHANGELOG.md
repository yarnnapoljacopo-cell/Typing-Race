# Changelog

All notable changes to Writing Sprint are documented here.
Update this file before running `pnpm run deploy` to merge development → production.

Format: `## [date] — short description`, then bullet points for what changed.

---

## [2025-04-24] — Dev/prod workflow setup

- Created `development` branch for staging changes before production
- Added `scripts/deploy.sh` merge-to-production script
- Added `pnpm run deploy` shortcut
- Auto-create DB tables on startup (fixes "Failed to save" on Railway)
- Profile name dialog now opens even when profile fetch errors
- Added `ALTER TABLE ADD COLUMN IF NOT EXISTS` for all schema columns (fixes missing columns on existing Railway DB)
- Added try/catch to PUT /user/profile for descriptive DB error messages
- Fixed PortalGuard: redirects home instead of showing diagnostic page
- Hardcoded Clerk PK fallback on both server and client so deploys never fail if env var is missing
