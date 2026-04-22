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

  const room = await createRoom({
    durationMinutes,
    mode,
    countdownDelayMinutes: 0,
    wordGoal,
  });
  const roomCode = room.code;

  const joinLink = `${appBaseUrl}/room?code=${roomCode}`;
  const modeLabel = mode === "goal" && wordGoal ? ` · Goal: ${wordGoal} words` : mode !== "regular" ? ` · Mode: ${mode}` : "";
  const delayLabel = delayMinutes === 1 ? "1 minute" : `${delayMinutes} minutes`;

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
  };

  sprints.set(key(guildId, channelId), sprint);

  sprint.startTimer = setTimeout(() => {
    void launchSprint(sprint, channel, appBaseUrl);
  }, delayMinutes * 60 * 1000);
}

async function launchSprint(sprint: ChannelSprint, channel: TextChannel, appBaseUrl: string): Promise<void> {
  sprint.status = "running";
  sprint.sprintStartedAt = Date.now();

  const wsUrl = process.env.WS_URL ?? appBaseUrl.replace(/^http/, "ws") + "/ws";
  const ws = new WebSocket(wsUrl);
  sprint.ws = ws;

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

    if (msg.type === "joined") {
      sprint.participantId = msg.participantId as string;
      ws.send(JSON.stringify({ type: "start_sprint" }));
      const joinLink = `${appBaseUrl}/room?code=${sprint.roomCode}`;
      const modeExtra = sprint.mode === "goal" && sprint.wordGoal
        ? ` Target: ${sprint.wordGoal} words.`
        : sprint.mode === "open" ? " (Open mode — everyone can see each other's text!)" : "";
      void channel.send(
        `🖊️ **The sprint has begun!** You have ${sprint.durationMinutes} minutes. Go go go!${modeExtra}\n` +
        `Room code: \`${sprint.roomCode}\` | Website: ${joinLink}`
      );

      const durationMs = sprint.durationMinutes * 60 * 1000;
      const warnAt = durationMs - 60_000;
      if (warnAt > 0) {
        sprint.warningTimer = setTimeout(() => {
          void channel.send("⏰ **One minute left!** Wrap up your thoughts.");
        }, warnAt);
      }
      return;
    }

    if (msg.type === "sprint_ended") {
      void handleSprintEnded(sprint, channel);
    }
  });

  ws.on("error", () => {
    void channel.send("⚠️ Lost connection to the sprint server. The sprint may still be running on the website.");
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

  await channel.send(
    `⏱️ **Time's up!** Great work everyone!\n` +
    `Please submit your final word count with \`/words [count]\` or \`/words +[words written]\`.\n` +
    `You have 2 minutes to submit.`
  );

  sprint.collectionTimer = setTimeout(() => {
    void postScoreboard(sprint, channel);
  }, 2 * 60 * 1000);
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
  if (sprint.ws) {
    sprint.ws.send(JSON.stringify({ type: "end_sprint" }));
    sprint.ws.close();
    sprint.ws = null;
  }
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

  const ranked = Array.from(sprint.participants.values())
    .filter((p) => p.finalWords !== undefined)
    .map((p) => ({
      username: p.username,
      wordsWritten: Math.max(0, (p.finalWords ?? p.startingWords) - p.startingWords),
      wpm: sprint.durationMinutes > 0
        ? Math.round(Math.max(0, (p.finalWords ?? p.startingWords) - p.startingWords) / sprint.durationMinutes)
        : 0,
      discordId: p.discordId,
    }))
    .sort((a, b) => b.wordsWritten - a.wordsWritten);

  const totalWords = ranked.reduce((sum, r) => sum + r.wordsWritten, 0);

  ranked.forEach((r) => {
    recordSprint({
      guildId: sprint.guildId,
      discordId: r.discordId,
      username: r.username,
      wordsWritten: r.wordsWritten,
      durationMinutes: sprint.durationMinutes,
    });
  });

  const noSubmissions = ranked.length === 0;
  if (noSubmissions) {
    await channel.send("📊 No word counts submitted. Better luck next time!");
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
