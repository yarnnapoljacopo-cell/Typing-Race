# Writing Sprint Discord Bot

A Discord bot that brings writing sprints directly to your server, modelled on the Sprinto experience. Users start timed writing sprints, join them, submit word counts, and track personal bests — all without leaving Discord.

---

## 1. Create a Discord bot on the Developer Portal

1. Go to [https://discord.com/developers/applications](https://discord.com/developers/applications) and click **New Application**.
2. Give it a name (e.g. "Writing Sprint") and confirm.
3. Click **Bot** in the left sidebar.
4. Under **Token**, click **Reset Token** and copy the token — you'll need it shortly.
5. Under **Privileged Gateway Intents**, enable **Server Members Intent**.
6. Click **OAuth2 → General** in the sidebar and copy the **Client ID**.

---

## 2. Invite the bot to your server

1. Go to **OAuth2 → URL Generator** in the sidebar.
2. Under **Scopes**, check `bot` and `applications.commands`.
3. Under **Bot Permissions**, check:
   - Read Messages / View Channels
   - Send Messages
   - Manage Messages (for editing the announcement message as people join)
   - Read Message History
4. Copy the generated URL and open it in your browser to add the bot to your server.

---

## 3. Set up environment variables

The bot reads these environment variables at startup:

| Variable | Description |
|---|---|
| `DISCORD_TOKEN` | Your bot token from step 1 |
| `DISCORD_CLIENT_ID` | Your application Client ID from step 1 |
| `API_BASE_URL` | The public URL of your Writing Sprint app, e.g. `https://writing-sprint.example.replit.app` |
| `WS_URL` | (Optional) WebSocket URL — defaults to `API_BASE_URL` with `https` replaced by `wss` and `/ws` appended |

In Replit, add these as **Secrets** in the Secrets panel (the lock icon).

---

## 4. Register slash commands

Before the first run, register the slash commands with Discord:

```bash
pnpm --filter @workspace/discord-bot run deploy
```

This registers all commands globally (visible in all servers). It may take up to an hour for Discord to propagate them everywhere.

---

## 5. Run the bot alongside the app

Start the bot as a background process:

```bash
pnpm --filter @workspace/discord-bot run start
```

In Replit, add this as a **workflow** (Shell tab → New workflow → command: `pnpm --filter @workspace/discord-bot run start`).

The bot connects to your already-running Writing Sprint backend. Make sure the API Server workflow is running first.

---

## 6. Set up a Sprint MC role (optional)

The Sprint MC role lets trusted members cancel or end any sprint, not just their own:

1. In your Discord server, go to **Server Settings → Roles**.
2. Create a role called exactly **Sprint MC**.
3. Assign it to your moderators or trusted users.

Server admins always have Sprint MC powers regardless of the role.

---

## Commands

| Command | What it does |
|---|---|
| `/sprint` | Start a 15-minute sprint, beginning in 1 minute |
| `/sprint duration:30` | Start a 30-minute sprint |
| `/sprint in:5` | Start a sprint in 5 minutes |
| `/sprint duration:20 in:10` | 20-minute sprint, starting in 10 minutes |
| `/sprint at:30` | Sprint starting at the next :30 on the clock |
| `/sprint mode:open` | Start an open-mode sprint (everyone sees each other's text on the website) |
| `/sprint goal:500` | Goal mode — race to 500 words |
| `/sprint random:true` | Random duration between 10 and 25 minutes |
| `/join` | Join the active sprint (starting word count defaults to 0) |
| `/join startingwords:1200` | Join with a starting word count of 1200 |
| `/words count:1642` | Submit your final word count |
| `/words count:+342` | Submit words written (without remembering your starting count) |
| `/leave` | Leave the current sprint |
| `/cancel` | Cancel the sprint before it starts (creator or Sprint MC) |
| `/end` | End the sprint early (creator or Sprint MC) |
| `/time` | See how much time is left |
| `/status` | See sprint status and who has joined |
| `/pb` | Show your personal best sprint |
| `/stats` | Show your own stats |
| `/stats user:@someone` | Show another user's stats |

---

## How the sprint flows

1. `/sprint` is called → Bot posts an announcement with the room code and a website link
2. Participants call `/join` → Bot updates the announcement with the list of names
3. After the delay, the bot announces the sprint has started
4. At 1 minute remaining, the bot sends a warning
5. When time is up, the bot opens a 2-minute window for `/words` submissions
6. After 2 minutes (or when everyone submits), the bot posts the final scoreboard with rankings, word counts, WPM, and the total group word count
7. The top writer is congratulated!

> **Note:** There are no live word count updates during the sprint — only the final scoreboard after it ends. This matches the Sprinto experience.

---

## Stat persistence

The bot stores per-server per-user stats (total words, sprints, personal best) in `artifacts/discord-bot/data/stats.json`. This file is created automatically. Back it up if you don't want to lose historical data.
