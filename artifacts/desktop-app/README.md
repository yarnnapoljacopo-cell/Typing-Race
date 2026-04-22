# Writing Sprint — Desktop App

![GitHub Downloads](https://img.shields.io/github/downloads/YOUR_USERNAME/YOUR_REPO/total?style=flat-square&label=Total%20Downloads&color=6366f1)

A native desktop app for Writing Sprint. Loads the live web app when online and switches to a fully self-contained offline sprint mode when you have no internet connection. Sprints are saved locally with SQLite and can be exported as `.txt` files.

---

## Platforms

| Platform | Format        | Architecture  |
|----------|---------------|---------------|
| macOS    | `.dmg`        | x64 + arm64 (Apple Silicon) |
| Windows  | `.exe`        | x64 (NSIS installer) |
| Linux    | `.AppImage`   | x64           |

---

## Downloading a Release

Go to the [**Releases**](../../releases) page and grab the installer for your platform from the latest release.

**Linux first-time setup:**
```bash
chmod +x Writing-Sprint-*.AppImage
./Writing-Sprint-*.AppImage
```

---

## Publishing a New Release

All you need to do is bump the version and push the tag. The GitHub Actions workflow handles the rest — it builds Mac, Windows, and Linux in parallel and creates a GitHub Release automatically.

### Step 1 — Bump the version

From inside `artifacts/desktop-app/`:

```bash
# Patch release (1.0.0 → 1.0.1)  bug fixes
pnpm run version patch

# Minor release (1.0.0 → 1.1.0)  new features
pnpm run version minor

# Major release (1.0.0 → 2.0.0)  breaking changes
pnpm run version major
```

This updates `package.json`, commits the change, and creates a local git tag (`v1.x.x`).

### Step 2 — Push the tag

```bash
git push && git push origin v1.x.x
```

Or push all tags at once:
```bash
git push --follow-tags
```

Pushing the tag triggers the CI workflow. In about 10–15 minutes you'll have a release with all three installers attached.

---

## GitHub Secrets Required

Add these in your repo → **Settings → Secrets and variables → Actions**:

| Secret             | Required | Description |
|--------------------|----------|-------------|
| `GH_TOKEN`         | ✅ Yes   | Personal access token with `repo` scope — used to create releases |
| `CSC_LINK`         | ⬜ Optional | Base64-encoded Mac signing certificate (`.p12`) |
| `CSC_KEY_PASSWORD` | ⬜ Optional | Password for the Mac signing certificate |

The Mac build will succeed without `CSC_LINK` — it just won't be notarized, so macOS will show a Gatekeeper warning on first launch (right-click → Open to bypass).

---

## Local Development

```bash
# From repo root
pnpm install

# Run in dev mode (Electron window loads live app)
pnpm --filter @workspace/desktop-app run dev

# Build unpacked directory (fast, no installer)
pnpm --filter @workspace/desktop-app run pack

# Build platform installers
pnpm --filter @workspace/desktop-app run build:mac
pnpm --filter @workspace/desktop-app run build:win
pnpm --filter @workspace/desktop-app run build:linux
```

Output goes to `artifacts/desktop-app/release/`.

---

## Architecture

```
artifacts/desktop-app/
├── src/
│   ├── main.ts          Electron main process (window, IPC, network check, SQLite)
│   ├── preload.ts       contextBridge API exposed to renderer
│   └── offline.html     Self-contained offline sprint UI (no external deps)
├── scripts/
│   └── bump.mjs         Version bump helper (used by `pnpm run version`)
├── build/               Compiled TypeScript output (git-ignored)
├── release/             Packaged installers (git-ignored)
├── electron-builder.config.js
├── tsconfig.json
└── package.json
```

**Online mode:** Electron loads the live Writing Sprint web app in a `BrowserWindow`.  
**Offline mode:** Falls back to the bundled `offline.html` — a standalone timer + word count tracker. Sprint history is stored in a local SQLite database at `~/.writing-sprint/sprints.db`.
