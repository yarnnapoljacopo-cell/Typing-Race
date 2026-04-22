import { WebSocket } from "ws";
import {
  TextChannel,
  Message,
  Client,
} from "discord.js";
import { createRoom } from "./api.js";
import { recordSprint } from "./statsStore.js";

export type SprintMode = "regular" | "open" | "goal";

export interface DiscordParticipant {
  discordId: string;
  username: string;
  startingWords: number;
  finalWords?: number;
}

interface WebResult {
  name: string;
  wordCount: number;
  wpm: number;
}

export interface ChannelSprint {
  roomCode: string;
  creatorDiscordId: string;
  durationMinutes: number;
  mode: SprintMode;
  wordGoal?: number;
  guildId: string;
  channelId: string;
  participants: Map<string, DiscordParticipant>;
  status: "joining" | "running" | "collecting" | "done";
  announcementMessage: Message | null;
  ws: WebSocket | null;
  participantId: string | null;
  startTimer: ReturnType<typeof setTimeout> | null;
  warningTimer: ReturnType<typeof setTimeout> | null;
  collectionTimer: ReturnType<typeof setTimeout> | null;
  sprintStartedAt: number | null;
  delayMinutes: number;
  webResults: WebResult[];
}

const sprints = new Map<string, ChannelSprint>();

function key(guildId: string, channelId: string): string {
  return `${guildId}:${channelId}`;
}

export function getSprint(guildId: string, channelId: string): ChannelSprint | undefined {
  return sprints.get(key(guildId, channelId));
}

export function hasSprint(guildId: string, channelId: string): boolean {
  const s = sprints.get(key(guildId, channelId));
  return !!s && s.status !== "done";
}

export async function startSprint(opts: {
  client: Client;
  guildId: string;
  channelId: string;
  channel: TextChannel;
  creatorDiscordId: string;
  durationMinutes: number;
  delayMinutes: number;
  mode: SprintMode;
  wordGoal?: number;
  appBaseUrl: string;
}): Promise<void> {
  const { guildId, channelId, channel, creatorDiscordId, durationMinutes, delayMinutes, mode, wordGoal, appBaseUrl } = opts;

  // Pass the bot's delay to the server as countdownDelayMinutes so the web
  // app shows the same countdown that Discord participants see.
  const room = await createRoom({
    durationMinutes,
    mode,
    countdownDelayMinutes: delayMinutes,
    wordGoal,
  });
  const roomCode = room.code;

  const joinLink = `${appBaseUrl}/room?code=${roomCode}`;
  const modeLabel = mode === "goal" && wordGoal ? ` · Goal: ${wordGoal} words` : mode !== "regular" ? ` · Mode: ${mode}` : "";
  const delayLabel = delayMinutes === 0
    ? "now"
    : delayMinutes === 1 ? "1 minute" : `${delayMinutes} minutes`;

  const announcement = await channel.send(
    `📝 **A ${durationMinutes}-minute writing sprint is starting in ${delayLabel}!**${modeLabel}\n` +
    `Type \`/join\` to join. Room code: \`${roomCode}\`\n` +
    `Join on the website: ${joinLink}`
  );

  const sprint: ChannelSprint = {
    roomCode,
    creatorDiscordId,
    durationMinutes,
    mode,
    wordGoal,
    guildId,
    channelId,
    participants: new Map(),
    status: "joining",
    announcementMessage: announcement,
    ws: null,
    participantId: null,
    startTimer: null,
    warningTimer: null,
    collectionTimer: null,
    sprintStartedAt: null,
    delayMinutes,
    webResults: [],
  };

  sprints.set(key(guildId, channelId), sprint);

  // Connect to the server immediately and fire start_sprint right away.
  // The server owns the countdown (countdownDelayMinutes set above), so web
  // clients and Discord see the exact same timer.
  // NOTE: must use .catch() — `void` would turn any rejection into an
  // unhandled promise rejection, crashing the entire Node.js process.
  connectAndStart(sprint, channel, appBaseUrl).catch((err: unknown) => {
    console.error("[SprintManager] connectAndStart failed:", err);
    void channel.send("⚠️ Could not connect to the sprint server. Please try `/cancel` and start a new sprint.").catch(() => undefined);
  });
}

async function connectAndStart(sprint: ChannelSprint, channel: TextChannel, appBaseUrl: string): Promise<void> {
  const wsUrl = process.env.WS_URL ?? appBaseUrl.replace(/^http/, "ws") + "/ws";
  const ws = new WebSocket(wsUrl);
  sprint.ws = ws;

  let hasAnnouncedStart = false;

  ws.on("open", () => {
    // spectator: true hides the bot from the race track while still granting
    // creator powers so it can fire start_sprint / end_sprint.
    ws.send(JSON.stringify({ type: "join_room", code: sprint.roomCode, name: "DiscordBot", spectator: true }));
  });

  ws.on("message", (raw: Buffer) => {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(raw.toString()) as Record<string, unknown>;
    } catch {
      return;
    }

    // On successful join, immediately trigger the sprint countdown on the server.
    if (msg.type === "joined") {
      sprint.participantId = msg.participantId as string;
      ws.send(JSON.stringify({ type: "start_sprint" }));
      return;
    }

    // When the server transitions to "running", the countdown is over —
    // announce in Discord and set the 1-minute warning.
    if (msg.type === "room_state") {
      const roomMsg = msg.room as Record<string, unknown> | undefined;
      if (roomMsg?.status === "running" && !hasAnnouncedStart) {
        hasAnnouncedStart = true;
        sprint.status = "running";
        sprint.sprintStartedAt = Date.now();

        const joinLink = `${appBaseUrl}/room?code=${sprint.roomCode}`;
        const modeExtra = sprint.mode === "goal" && sprint.wordGoal
          ? ` Target: ${sprint.wordGoal} words.`
          : sprint.mode === "open" ? " (Open mode — everyone can see each other's text!)" : "";
        channel.send(
          `🖊️ **The sprint has begun!** You have ${sprint.durationMinutes} minutes. Go go go!${modeExtra}\n` +
          `Room code: \`${sprint.roomCode}\` | Website: ${joinLink}`
        ).catch((err: unknown) => console.error("[SprintManager] channel.send (start) failed:", err));

        // Use server's timeLeft to schedule the warning precisely.
        const timeLeft = typeof roomMsg.timeLeft === "number" ? roomMsg.timeLeft : sprint.durationMinutes * 60;
        const warnInMs = (timeLeft - 60) * 1000;
        if (warnInMs > 0) {
          sprint.warningTimer = setTimeout(() => {
            channel.send("⏰ **One minute left!** Wrap up your thoughts.")
              .catch((err: unknown) => console.error("[SprintManager] warning send failed:", err));
          }, warnInMs);
        }
      }
      return;
    }

    // Sprint ended — use the server's results directly.
    if (msg.type === "sprint_ended") {
      const results = msg.results as Array<{ name: string; wordCount: number; wpm: number }> | undefined;
      sprint.webResults = (results ?? []).map((r) => ({
        name: r.name,
        wordCount: r.wordCount,
        wpm: r.wpm,
      }));
      handleSprintEnded(sprint, channel).catch((err: unknown) => {
        console.error("[SprintManager] handleSprintEnded failed:", err);
      });
    }
  });

  ws.on("error", (err) => {
    console.error("[SprintManager] WebSocket error:", err);
    channel.send("⚠️ Lost connection to the sprint server. The sprint may still be running on the website.").catch(() => undefined);
  });

  ws.on("close", () => {
    sprint.ws = null;
  });
}

async function handleSprintEnded(sprint: ChannelSprint, channel: TextChannel): Promise<void> {
  if (sprint.status === "collecting" || sprint.status === "done") return;
  sprint.status = "collecting";

  if (sprint.warningTimer) clearTimeout(sprint.warningTimer);
  if (sprint.ws) {
    sprint.ws.close();
    sprint.ws = null;
  }

  // Check whether there are any Discord-only participants who haven't submitted
  // a word count yet (people who joined via /join but didn't use the website).
  const discordOnlyPending = Array.from(sprint.participants.values()).filter(
    (p) => p.finalWords === undefined
  );

  if (discordOnlyPending.length > 0) {
    await channel.send(
      `⏱️ **Time's up!** Great work everyone!\n` +
      `${discordOnlyPending.map((p) => `**${p.username}**`).join(", ")}: please submit your word count with \`/words [count]\` or \`/words +[words written]\`. You have 2 minutes.`
    );
    sprint.collectionTimer = setTimeout(() => {
      void postScoreboard(sprint, channel);
    }, 2 * 60 * 1000);
  } else {
    // Everyone tracked on the website — post the scoreboard immediately.
    await channel.send(`⏱️ **Time's up!** Great work everyone!`);
    await postScoreboard(sprint, channel);
  }
}

export async function endSprintEarly(sprint: ChannelSprint, channel: TextChannel): Promise<void> {
  if (sprint.startTimer) {
    clearTimeout(sprint.startTimer);
    sprint.startTimer = null;
  }
  if (sprint.warningTimer) {
    clearTimeout(sprint.warningTimer);
    sprint.warningTimer = null;
  }
  // Only send end_sprint if the WS is actually open — sending on a connecting
  // or closing socket throws and could crash the bot.
  if (sprint.ws && sprint.ws.readyState === WebSocket.OPEN) {
    sprint.ws.send(JSON.stringify({ type: "end_sprint" }));
    // Let the server's sprint_ended event drive handleSprintEnded via the
    // message listener — don't call it directly here to avoid double-posting.
    return;
  }
  // WS already gone or not yet open — clean up manually.
  if (sprint.status === "joining") {
    sprint.status = "done";
    sprints.delete(`${sprint.guildId}:${sprint.channelId}`);
    return;
  }
  await handleSprintEnded(sprint, channel);
}

export async function submitWords(
  sprint: ChannelSprint,
  discordId: string,
  finalWords: number,
  wordsWritten?: number
): Promise<void> {
  const p = sprint.participants.get(discordId);
  if (!p) return;
  if (wordsWritten !== undefined) {
    p.finalWords = p.startingWords + wordsWritten;
  } else {
    p.finalWords = finalWords;
  }
}

async function postScoreboard(sprint: ChannelSprint, channel: TextChannel): Promise<void> {
  if (sprint.status === "done") return;
  sprint.status = "done";

  // Merge web results (tracked automatically) with manual Discord submissions.
  // Web results take priority; Discord-only participants are appended below.
  const merged = new Map<string, { username: string; wordsWritten: number; wpm: number; discordId?: string }>();

  // Add web-tracked participants first.
  for (const r of sprint.webResults) {
    merged.set(r.name.toLowerCase(), {
      username: r.name,
      wordsWritten: r.wordCount,
      wpm: r.wpm,
    });
  }

  // Add Discord-only participants (those who joined via /join and submitted /words
  // but never opened the website). Skip if their name already appears in web results.
  for (const p of sprint.participants.values()) {
    const normalised = p.username.toLowerCase();
    if (!merged.has(normalised) && p.finalWords !== undefined) {
      const wordsWritten = Math.max(0, p.finalWords - p.startingWords);
      merged.set(normalised, {
        username: p.username,
        wordsWritten,
        wpm: sprint.durationMinutes > 0 ? Math.round(wordsWritten / sprint.durationMinutes) : 0,
        discordId: p.discordId,
      });
    }
  }

  const ranked = Array.from(merged.values()).sort((a, b) => b.wordsWritten - a.wordsWritten);
  const totalWords = ranked.reduce((sum, r) => sum + r.wordsWritten, 0);

  // Record stats for Discord-linked entries.
  for (const p of sprint.participants.values()) {
    const entry = merged.get(p.username.toLowerCase());
    if (entry) {
      recordSprint({
        guildId: sprint.guildId,
        discordId: p.discordId,
        username: p.username,
        wordsWritten: entry.wordsWritten,
        durationMinutes: sprint.durationMinutes,
      });
    }
  }

  if (ranked.length === 0) {
    await channel.send("📊 No word counts recorded. Better luck next time!");
    sprints.delete(`${sprint.guildId}:${sprint.channelId}`);
    return;
  }

  const medals = ["🥇", "🥈", "🥉"];
  const rows = ranked
    .map((r, i) => {
      const medal = medals[i] ?? `**${i + 1}.**`;
      return `${medal} **${r.username}** — ${r.wordsWritten.toLocaleString()} words (${r.wpm} WPM)`;
    })
    .join("\n");

  const winner = ranked[0];
  await channel.send(
    `📊 **Final Scoreboard**\n${rows}\n\n` +
    `🏆 Congrats to **${winner.username}** for the most words!\n` +
    `📝 Total group words: **${totalWords.toLocaleString()}**`
  );

  sprints.delete(`${sprint.guildId}:${sprint.channelId}`);
}

export function removeSprint(guildId: string, channelId: string): void {
  const k = key(guildId, channelId);
  const sprint = sprints.get(k);
  if (sprint) {
    if (sprint.startTimer) clearTimeout(sprint.startTimer);
    if (sprint.warningTimer) clearTimeout(sprint.warningTimer);
    if (sprint.collectionTimer) clearTimeout(sprint.collectionTimer);
    if (sprint.ws) {
      sprint.ws.close();
      sprint.ws = null;
    }
  }
  sprints.delete(k);
}
