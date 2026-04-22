import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dir, "..", "data");
const STATS_FILE = join(DATA_DIR, "stats.json");

export interface UserStats {
  discordId: string;
  username: string;
  totalWords: number;
  totalSprints: number;
  totalMinutes: number;
  pb: number;
  pbDate: string;
}

type StatsMap = Record<string, Record<string, UserStats>>;

function load(): StatsMap {
  if (!existsSync(STATS_FILE)) return {};
  try {
    return JSON.parse(readFileSync(STATS_FILE, "utf8")) as StatsMap;
  } catch {
    return {};
  }
}

function save(data: StatsMap): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(STATS_FILE, JSON.stringify(data, null, 2));
}

export function getStats(guildId: string, discordId: string): UserStats | null {
  const data = load();
  return data[guildId]?.[discordId] ?? null;
}

export function recordSprint(opts: {
  guildId: string;
  discordId: string;
  username: string;
  wordsWritten: number;
  durationMinutes: number;
}): void {
  const data = load();
  if (!data[opts.guildId]) data[opts.guildId] = {};
  const existing = data[opts.guildId][opts.discordId] ?? {
    discordId: opts.discordId,
    username: opts.username,
    totalWords: 0,
    totalSprints: 0,
    totalMinutes: 0,
    pb: 0,
    pbDate: "",
  };
  existing.username = opts.username;
  existing.totalWords += opts.wordsWritten;
  existing.totalSprints += 1;
  existing.totalMinutes += opts.durationMinutes;
  if (opts.wordsWritten > existing.pb) {
    existing.pb = opts.wordsWritten;
    existing.pbDate = new Date().toISOString().slice(0, 10);
  }
  data[opts.guildId][opts.discordId] = existing;
  save(data);
}
