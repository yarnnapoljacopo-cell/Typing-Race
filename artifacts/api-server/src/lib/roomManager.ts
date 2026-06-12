import { WebSocket } from "ws";
import { logger } from "./logger";
import { db, pool, roomsTable, userProfilesTable, sprintWritingTable } from "@workspace/db";
import { eq, gt, and, ne, sql } from "drizzle-orm";
import { saveWriting } from "./writingStore";
import { initGladiatorParticipant, broadcastGladiatorTimerEnd } from "./gladiatorEngine";
import { settleBets, refundActiveBets, type BetOutcome } from "./bettingManager";

// ── Sprint chest roll ─────────────────────────────────────────────────────────
// Probabilities (add up to 1.0):
//   Immortal  0.10%
//   Inferno   0.50%
//   Crystal   2.00%
//   Iron      8.00%
//   Mortal   89.40%
function rollSprintChest(): string {
  const r = Math.random() * 100;
  if (r < 0.10) return "immortal";
  if (r < 0.60) return "inferno";
  if (r < 2.60) return "crystal";
  if (r < 10.60) return "iron";
  return "mortal";
}

async function grantSprintChest(clerkUserId: string, chestType: string): Promise<void> {
  await pool.query(
    `INSERT INTO user_chests (user_id, chest_type, quantity)
     VALUES ($1, $2, 1)
     ON CONFLICT (user_id, chest_type)
     DO UPDATE SET quantity = user_chests.quantity + 1, earned_at = NOW()`,
    [clerkUserId, chestType],
  );
}

export type RoomStatus = "waiting" | "countdown" | "running" | "finished";

export interface Participant {
  id: string;
  name: string;
  wordCount: number;
  wpm: number;
  lastWordCountTime: number;
  lastWordCount: number;
  ws: WebSocket;
  isCreator: boolean;
  isSpectator: boolean;
  /** Sprint role.
   *  - "writer" (default): races on the track, contributes to word counts.
   *  - "editor": joins as a visible non-racer. Has no car, doesn't count
   *    toward goals/boss totals/kart items/gladiator fighter slots, but
   *    appears in the writers list and their text is broadcast so other
   *    participants can see what the editor is doing.
   */
  role: "writer" | "editor";
  latestText: string;
  clerkUserId: string | null;
  nameplate: string;
  xp: number;
  disconnectTimer?: ReturnType<typeof setTimeout>;
  kartItems: string[];
  kartBonusWords: number;
  kartCarOffset: number;
  kartNextItemAt: number;
  // Last emote timestamp (ms epoch) — used for per-sender rate limiting.
  lastEmoteAt?: number;
  // Gladiator mode fields
  gladiatorHp: number;
  gladiatorBuffs: string[];
  gladiatorFrenzyStartWc: number;
  gladiatorFrenzyStartTime: number;
  gladiatorAheadSince: number | null;
  gladiatorMomentumSince: number | null;
  gladiatorMomentumGapAtStart: number | null;
  gladiatorWoundSince: number | null;
  gladiatorWoundGapAtStart: number | null;
}

export type RoomMode = "regular" | "open" | "goal" | "boss" | "kart" | "gladiator";

export interface BananaTrap {
  id: string;
  placedById: string;
  placedByName: string;
  threshold: number;
}

export interface Room {
  code: string;
  creatorName: string;
  durationMinutes: number;
  countdownDelayMinutes: number;
  mode: RoomMode;
  wordGoal: number | null;
  bossWordGoal: number | null;
  deathModeWpm: number | null;
  passwordHash: string | null;
  status: RoomStatus;
  participants: Map<string, Participant>;
  startTime: number | null;
  endTime: number | null;
  countdownEndsAt: number | null;
  timerInterval: ReturnType<typeof setInterval> | null;
  closeTimer?: ReturnType<typeof setTimeout>;
  bananaTraps: BananaTrap[];
  goldenPenUsed: boolean;
  activeStars: Map<string, number>;
  gladiatorDeathGap: number | null;
  gladiatorMatchStats: GladiatorMatchStats | null;
  creatorXp: number;
  hostCarSkin: string | null;
  hostRoadSkin: string | null;
}

export interface GladiatorMatchStats {
  closestGap: number;
  maxGap: number;
  totalHpHealed: Record<string, number>;
  leadChanges: number;
  timeInDangerMs: number;
  endedByExecution: boolean;
  currentLeaderId: string | null;
}

const rooms = new Map<string, Room>();

function generateRoomCode(): string {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `SPRINT-${num}`;
}

const VALID_DEATH_WPMS = [10, 20, 30, 40, 50];

// ── DB persistence helpers ─────────────────────────────────────────────────
//
// persistRoom() is invoked from a 1-second setInterval per active sprint
// room, so a slow or failing DB would otherwise hammer the pool every
// second forever. Each room gets a tiny circuit breaker: after
// PERSIST_FAILURE_THRESHOLD consecutive failures we stop attempting writes
// for PERSIST_BACKOFF_MS and double the backoff up to PERSIST_BACKOFF_MAX_MS.
// One success resets everything.
//
// IMPORTANT — do NOT set PERSIST_BACKOFF_MS >= idleTimeoutMillis (30 s):
//   When all N rooms' circuits open at the same instant (same DB-degradation
//   event) and the backoff equals the idle timeout, the circuit reopen and
//   the idle-timeout cleanup fire simultaneously. The pool drains to zero at
//   exactly T+30 s AND all N rooms' circuits reopen at exactly T+30 s, so
//   the very next 1-second interval creates N simultaneous newClient() calls —
//   a synchronized auth-phase burst. Keeping the initial backoff shorter than
//   the idle timeout means the circuit reopens while connections are still
//   alive in the pool and can be reused without creating new connections.

const PERSIST_FAILURE_THRESHOLD = 3;
const PERSIST_BACKOFF_MS = 15_000;       // < idleTimeoutMillis (30 s) — see above
const PERSIST_BACKOFF_MAX_MS = 5 * 60_000;

interface PersistFailureState {
  count: number;
  pausedUntil: number;
  currentBackoffMs: number;
}
const persistFailures = new Map<string, PersistFailureState>();

function recordPersistSuccess(code: string): void {
  if (persistFailures.has(code)) persistFailures.delete(code);
}

function recordPersistFailure(code: string, err: unknown): void {
  const prev = persistFailures.get(code) ?? { count: 0, pausedUntil: 0, currentBackoffMs: PERSIST_BACKOFF_MS };
  const count = prev.count + 1;
  let pausedUntil = 0;
  let currentBackoffMs = prev.currentBackoffMs;
  if (count >= PERSIST_FAILURE_THRESHOLD) {
    pausedUntil = Date.now() + currentBackoffMs;
    currentBackoffMs = Math.min(currentBackoffMs * 2, PERSIST_BACKOFF_MAX_MS);
    if (count === PERSIST_FAILURE_THRESHOLD) {
      logger.warn(
        { code, count, pauseMs: pausedUntil - Date.now(), err: (err as Error).message },
        "[persistRoom] circuit OPEN — pausing room persistence",
      );
    }
  }
  persistFailures.set(code, { count, pausedUntil, currentBackoffMs });
}

function isPersistPaused(code: string): boolean {
  const s = persistFailures.get(code);
  return !!s && s.count >= PERSIST_FAILURE_THRESHOLD && Date.now() < s.pausedUntil;
}

function persistRoom(room: Room): void {
  if (isPersistPaused(room.code)) return;
  db.insert(roomsTable)
    .values({
      code: room.code,
      creatorName: room.creatorName,
      durationMinutes: room.durationMinutes,
      countdownDelayMinutes: room.countdownDelayMinutes,
      mode: room.mode,
      wordGoal: room.wordGoal,
      bossWordGoal: room.bossWordGoal,
      deathModeWpm: room.deathModeWpm,
      passwordHash: room.passwordHash,
      gladiatorDeathGap: room.gladiatorDeathGap,
      status: room.status,
      startTime: room.startTime,
      endTime: room.endTime,
      countdownEndsAt: room.countdownEndsAt,
      hostCarSkin: room.hostCarSkin,
      hostRoadSkin: room.hostRoadSkin,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [roomsTable.code],
      set: {
        status: room.status,
        startTime: room.startTime,
        endTime: room.endTime,
        countdownEndsAt: room.countdownEndsAt,
        durationMinutes: room.durationMinutes,
        hostCarSkin: room.hostCarSkin,
        hostRoadSkin: room.hostRoadSkin,
        updatedAt: new Date(),
      },
    })
    .then(() => recordPersistSuccess(room.code))
    .catch((err: unknown) => {
      recordPersistFailure(room.code, err);
      logger.error({ err, code: room.code }, "Failed to persist room");
    });
}

function deleteRoomFromDB(code: string): void {
  // Always drop the breaker entry — the room object is being torn down, so
  // there's no in-memory state left to protect, and we don't want to leak
  // an entry per ever-deleted room into persistFailures.
  if (isPersistPaused(code)) {
    persistFailures.delete(code);
    return;
  }
  db.delete(roomsTable)
    .where(eq(roomsTable.code, code))
    .then(() => recordPersistSuccess(code))
    .catch((err: unknown) => {
      recordPersistFailure(code, err);
      logger.error({ err, code }, "Failed to delete room from DB");
    })
    .finally(() => {
      // Tear-down: remove any breaker entry once the room is gone.
      persistFailures.delete(code);
    });
}

export async function restoreRoomsFromDB(): Promise<void> {
  const now = Date.now();
  const cutoff = new Date(now - 3 * 60 * 60 * 1000); // 3 hours ago

  try {
    const rows = await db
      .select()
      .from(roomsTable)
      .where(
        and(
          gt(roomsTable.createdAt, cutoff),
          ne(roomsTable.status, "finished"),
        )
      );

    let restored = 0;

    for (const row of rows) {
      if (rooms.has(row.code)) continue;

      const room: Room = {
        code: row.code,
        creatorName: row.creatorName,
        durationMinutes: row.durationMinutes,
        countdownDelayMinutes: row.countdownDelayMinutes ?? 0,
        mode: (row.mode as RoomMode) ?? "regular",
        wordGoal: row.wordGoal ?? null,
        bossWordGoal: row.bossWordGoal ?? null,
        deathModeWpm: row.deathModeWpm ?? null,
        passwordHash: row.passwordHash ?? null,
        status: row.status as RoomStatus,
        participants: new Map(),
        startTime: row.startTime ?? null,
        endTime: row.endTime ?? null,
        countdownEndsAt: row.countdownEndsAt ?? null,
        timerInterval: null,
        bananaTraps: [],
        goldenPenUsed: false,
        activeStars: new Map(),
        gladiatorDeathGap: (row as Record<string, unknown>).gladiatorDeathGap as number | null ?? null,
        gladiatorMatchStats: null,
        creatorXp: 0,
        hostCarSkin: row.hostCarSkin ?? null,
        hostRoadSkin: row.hostRoadSkin ?? null,
      };

      if (row.status === "running") {
        if (row.endTime && row.endTime > now) {
          // Sprint still has time remaining
          rooms.set(row.code, room);
          room.timerInterval = setInterval(() => {
            if (!room.endTime || Date.now() >= room.endTime) {
              endSprint(room);
            } else {
              broadcastRoomState(room);
            }
          }, 1000);
          restored++;
        }
        // If endTime already passed, don't restore — room is effectively done
      } else if (row.status === "countdown") {
        if (row.countdownEndsAt && row.countdownEndsAt > now) {
          rooms.set(row.code, room);
          room.timerInterval = setInterval(() => {
            if (!room.countdownEndsAt || Date.now() >= room.countdownEndsAt) {
              if (room.timerInterval) { clearInterval(room.timerInterval); room.timerInterval = null; }
              room.status = "waiting";
              room.countdownEndsAt = null;
              _startRunning(room);
            } else {
              broadcastRoomState(room);
            }
          }, 1000);
          restored++;
        } else {
          // Countdown expired while server was down — start the sprint now
          room.status = "waiting";
          room.countdownEndsAt = null;
          rooms.set(row.code, room);
          _startRunning(room);
          restored++;
        }
      } else if (row.status === "waiting") {
        rooms.set(row.code, room);
        restored++;
      }
    }

    if (restored > 0) {
      logger.info({ restored }, "Rooms restored from database on startup");
    }
  } catch (err) {
    logger.error({ err }, "Failed to restore rooms from database");
  }
}

// ── Room lifecycle ─────────────────────────────────────────────────────────

const VALID_GLADIATOR_DEATH_GAPS = [200, 400, 600, 800] as const;

export function createRoom(
  creatorName: string,
  durationMinutes: number,
  mode: RoomMode = "regular",
  countdownDelayMinutes = 0,
  wordGoal: number | null = null,
  deathModeWpm: number | null = null,
  bossWordGoal: number | null = null,
  passwordHash: string | null = null,
  gladiatorDeathGap: number | null = null,
  hostCarSkin: string | null = null,
  hostRoadSkin: string | null = null,
): Room {
  let code = generateRoomCode();
  while (rooms.has(code)) {
    code = generateRoomCode();
  }

  const room: Room = {
    code,
    creatorName,
    durationMinutes,
    countdownDelayMinutes: Math.min(30, Math.max(0, countdownDelayMinutes)),
    mode,
    wordGoal: wordGoal && wordGoal > 0 ? Math.floor(wordGoal) : null,
    bossWordGoal: mode === "boss" && bossWordGoal && bossWordGoal > 0 ? Math.floor(bossWordGoal) : null,
    deathModeWpm: deathModeWpm && VALID_DEATH_WPMS.includes(deathModeWpm) ? deathModeWpm : null,
    passwordHash,
    status: "waiting",
    participants: new Map(),
    startTime: null,
    endTime: null,
    countdownEndsAt: null,
    timerInterval: null,
    bananaTraps: [],
    goldenPenUsed: false,
    activeStars: new Map(),
    gladiatorDeathGap: mode === "gladiator" && gladiatorDeathGap && VALID_GLADIATOR_DEATH_GAPS.includes(gladiatorDeathGap as (typeof VALID_GLADIATOR_DEATH_GAPS)[number]) ? gladiatorDeathGap : (mode === "gladiator" ? 400 : null),
    gladiatorMatchStats: null,
    creatorXp: 0,
    hostCarSkin,
    hostRoadSkin,
  };

  rooms.set(code, room);
  persistRoom(room);
  logger.info({ code, creatorName, durationMinutes, countdownDelayMinutes }, "Room created");

  setTimeout(() => {
    if (rooms.has(code) && rooms.get(code)!.status === "waiting") {
      rooms.delete(code);
      deleteRoomFromDB(code);
      // Refund any bets placed before the never-started sprint expired.
      refundActiveBets(code, "Sprint never started — bet refunded").catch(() => undefined);
      logger.info({ code }, "Room expired after inactivity");
    }
  }, 2 * 60 * 60 * 1000);

  return room;
}

export function getRoom(code: string): Room | undefined {
  return rooms.get(code);
}

export function getActiveRooms(): Array<{
  code: string;
  creatorName: string;
  durationMinutes: number;
  mode: RoomMode;
  wordGoal: number | null;
  status: RoomStatus;
  participantCount: number;
  timeLeft: number | null;
  countdownTimeLeft: number | null;
  isPasswordProtected: boolean;
}> {
  const now = Date.now();
  return Array.from(rooms.values())
    .filter((r) => r.status !== "finished")
    .map((r) => {
      let timeLeft: number | null = null;
      let countdownTimeLeft: number | null = null;
      if (r.status === "countdown" && r.countdownEndsAt) {
        countdownTimeLeft = Math.max(0, Math.ceil((r.countdownEndsAt - now) / 1000));
      } else if (r.status === "running" && r.endTime) {
        timeLeft = Math.max(0, Math.floor((r.endTime - now) / 1000));
      }
      return {
        code: r.code,
        creatorName: r.creatorName,
        durationMinutes: r.durationMinutes,
        mode: r.mode,
        wordGoal: r.wordGoal,
        status: r.status,
        participantCount: Array.from(r.participants.values()).filter((p) => !p.isSpectator && p.role !== "editor").length,
        timeLeft,
        countdownTimeLeft,
        isPasswordProtected: !!r.passwordHash,
      };
    });
}

export function broadcastToRoom(room: Room, message: object, excludeId?: string): void {
  const payload = JSON.stringify(message);
  room.participants.forEach((p) => {
    if (p.id !== excludeId && p.ws.readyState === WebSocket.OPEN) {
      p.ws.send(payload);
    }
  });
}

export function broadcastRoomState(room: Room): void {
  // Visible = everyone except invisible spectators. Editors are included
  // (so they show up in the writers list / spectator panel) but the client
  // is responsible for filtering them out of car-rendering.
  const participants = Array.from(room.participants.values())
    .filter((p) => !p.isSpectator)
    .map((p) => ({
      id: p.id,
      name: p.name,
      wordCount: p.wordCount,
      wpm: p.wpm,
      isCreator: p.isCreator,
      role: p.role,
      nameplate: p.nameplate,
      xp: p.xp,
      ...(room.mode === "kart" && { kartCarOffset: p.kartCarOffset }),
    }));

  const now = Date.now();
  let timeLeft: number | null = null;
  let countdownTimeLeft: number | null = null;

  if (room.status === "countdown" && room.countdownEndsAt) {
    countdownTimeLeft = Math.max(0, Math.ceil((room.countdownEndsAt - now) / 1000));
  } else if (room.status === "running" && room.startTime && room.endTime) {
    timeLeft = Math.max(0, Math.floor((room.endTime - now) / 1000));
  } else if (room.status === "finished") {
    timeLeft = 0;
  }

  const bossTotalWords = room.mode === "boss"
    ? participants.filter((p) => p.role !== "editor").reduce((sum, p) => sum + p.wordCount, 0)
    : null;

  broadcastToRoom(room, {
    type: "room_state",
    room: {
      code: room.code,
      status: room.status,
      durationMinutes: room.durationMinutes,
      countdownDelayMinutes: room.countdownDelayMinutes,
      mode: room.mode,
      wordGoal: room.wordGoal,
      bossWordGoal: room.bossWordGoal,
      bossTotalWords,
      deathModeWpm: room.deathModeWpm,
      gladiatorDeathGap: room.gladiatorDeathGap,
      hostCarSkin: room.hostCarSkin,
      hostRoadSkin: room.hostRoadSkin,
      timeLeft,
      countdownTimeLeft,
      participants,
      creatorXp: room.creatorXp,
    },
  });
}

export function startSprint(room: Room): void {
  if (room.status !== "waiting") return;

  // Gladiator mode requires exactly 2 non-spectator, non-editor participants
  if (room.mode === "gladiator") {
    const fighters = Array.from(room.participants.values()).filter((p) => !p.isSpectator && p.role !== "editor");
    if (fighters.length < 2) {
      logger.warn({ code: room.code }, "Gladiator start blocked — need 2 fighters");
      return;
    }
  }

  if (room.countdownDelayMinutes > 0) {
    room.status = "countdown";
    room.countdownEndsAt = Date.now() + room.countdownDelayMinutes * 60 * 1000;
    persistRoom(room);

    broadcastRoomState(room);

    room.timerInterval = setInterval(() => {
      const now = Date.now();
      if (!room.countdownEndsAt || now >= room.countdownEndsAt) {
        if (room.timerInterval) { clearInterval(room.timerInterval); room.timerInterval = null; }
        room.status = "waiting";
        room.countdownEndsAt = null;
        _startRunning(room);
      } else {
        broadcastRoomState(room);
      }
    }, 1000);

    logger.info({ code: room.code, countdownDelayMinutes: room.countdownDelayMinutes }, "Countdown started");
    return;
  }

  _startRunning(room);
}

function _startRunning(room: Room): void {
  if (room.status !== "waiting") return;

  room.status = "running";
  room.startTime = Date.now();
  room.endTime = room.startTime + room.durationMinutes * 60 * 1000;
  // Reset per-participant counters so the WPM anti-cheat clamp uses
  // sprint-start as its baseline rather than the (possibly minutes-old)
  // last lobby/countdown timestamp — otherwise the very first text_update
  // gets a huge elapsedMin and the clamp is effectively bypassed.
  room.participants.forEach((p) => {
    p.lastWordCount = p.wordCount;
    p.lastWordCountTime = room.startTime as number;
  });
  persistRoom(room);

  // Initialize gladiator state for all current participants
  if (room.mode === "gladiator") {
    room.gladiatorMatchStats = {
      closestGap: -1,
      maxGap: 0,
      totalHpHealed: {},
      leadChanges: 0,
      timeInDangerMs: 0,
      endedByExecution: false,
      currentLeaderId: null,
    };
    room.participants.forEach((p) => {
      if (!p.isSpectator && p.role !== "editor") initGladiatorParticipant(p);
    });
  }

  // Initialize kart state for all current participants. This MUST run on every
  // start (idempotent on the first one), because restartSprint only zeroes word
  // counts — without this, a restarted kart room kept last sprint's car offsets,
  // item thresholds (so high-word players earned nothing), spent golden pen,
  // armed banana traps and active stars. Mirrors the gladiator reset above.
  if (room.mode === "kart") {
    room.bananaTraps = [];
    room.activeStars.clear();
    room.goldenPenUsed = false;
    room.participants.forEach((p) => {
      p.kartItems = [];
      p.kartCarOffset = 0;
      p.kartBonusWords = 0;
      p.kartNextItemAt = Math.floor(p.wordCount / 250) * 250 + 250;
      // Push the cleared inventory to each client so the slot bar empties
      // immediately rather than showing last sprint's stale items.
      if (p.ws.readyState === WebSocket.OPEN) {
        p.ws.send(JSON.stringify({ type: "kart_inventory", items: [] }));
      }
    });
  }

  broadcastRoomState(room);

  // Always clear any pre-existing interval before creating a new one.
  // Prevents a double-broadcast loop if _startRunning is somehow called
  // while a stale interval from a previous countdown or restore is still running.
  if (room.timerInterval) { clearInterval(room.timerInterval); room.timerInterval = null; }
  room.timerInterval = setInterval(() => {
    const now = Date.now();
    if (!room.endTime || now >= room.endTime) {
      endSprint(room);
    } else {
      broadcastRoomState(room);
    }
  }, 1000);

  logger.info({ code: room.code, durationMinutes: room.durationMinutes }, "Sprint started");
}

const POST_SPRINT_CLOSE_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Idempotently award XP for a sprint and persist writing.
 * Safe to call multiple times — the xpAwarded flag prevents double-award.
 */
async function finalizeSprintData(room: Room, naturalEnd: boolean): Promise<void> {
  // Editors are visible non-racers — they don't appear in rankings or
  // earn race XP, but their text is still persisted below where applicable.
  const allParticipants = Array.from(room.participants.values()).filter((p) => !p.isSpectator && p.role !== "editor");
  if (allParticipants.length === 0) return;

  const sorted = [...allParticipants].sort((a, b) => b.wordCount - a.wordCount);
  const firstPlaceId = sorted[0]?.id;

  for (const p of allParticipants) {
    if (p.latestText || p.wordCount > 0) {
      await saveWriting(room.code, p.name, p.latestText, p.wordCount, p.clerkUserId, room.mode, room.wordGoal, p.wpm);
    }

    if (!p.clerkUserId || p.wordCount <= 0) continue;

    const rows = await db
      .select({ xpAwarded: sprintWritingTable.xpAwarded })
      .from(sprintWritingTable)
      .where(and(
        eq(sprintWritingTable.roomCode, room.code),
        eq(sprintWritingTable.participantName, p.name),
      ))
      .limit(1);

    if (rows[0]?.xpAwarded) continue;

    const isFirstPlace = p.id === firstPlaceId;
    const xpGained = isFirstPlace
      ? Math.max(5, Math.ceil(p.wordCount / 5)) * 2
      : Math.max(5, Math.ceil(p.wordCount / 5));

    const now = new Date();
    await db
      .update(userProfilesTable)
      .set({ xp: sql`${userProfilesTable.xp} + ${xpGained}`, lastSprintAt: now, decayCheckedAt: now, updatedAt: now })
      .where(eq(userProfilesTable.clerkUserId, p.clerkUserId));

    await db
      .update(sprintWritingTable)
      .set({ xpAwarded: true })
      .where(and(
        eq(sprintWritingTable.roomCode, room.code),
        eq(sprintWritingTable.participantName, p.name),
      ));

    try {
      const { bumpQuestsBatch } = await import("./quests");
      const bumps: Array<{ metric: string; amount: number }> = [
        { metric: "sprints_completed", amount: 1 },
        { metric: "words_written", amount: p.wordCount },
      ];
      if (p.wpm && p.wpm > 0) bumps.push({ metric: "max_wpm", amount: p.wpm });
      if (isFirstPlace) bumps.push({ metric: "sprints_won", amount: 1 });
      if (room.mode === "kart") {
        bumps.push({ metric: "kart_completed", amount: 1 });
        if (isFirstPlace) bumps.push({ metric: "kart_won", amount: 1 });
      }
      if (room.mode === "gladiator") {
        bumps.push({ metric: "gladiator_completed", amount: 1 });
        if (isFirstPlace) bumps.push({ metric: "gladiator_won", amount: 1 });
      }
      await bumpQuestsBatch(p.clerkUserId, bumps);
    } catch (err) {
      logger.warn({ err, code: room.code }, "quest bump failed");
    }

    try {
      const { recordWritingDay } = await import("./streaks");
      const award = await recordWritingDay(p.clerkUserId, p.wordCount, 1);
      if (award.base && p.ws.readyState === WebSocket.OPEN) {
        p.ws.send(JSON.stringify({
          type: "chest_awarded",
          chestType: award.base,
          source: "daily_streak",
          streakDay: award.streakDay,
        }));
      }
      if (award.bonus && p.ws.readyState === WebSocket.OPEN) {
        p.ws.send(JSON.stringify({
          type: "chest_awarded",
          chestType: award.bonus,
          source: "streak_milestone",
          streakDay: award.streakDay,
        }));
        logger.info(
          { userId: p.clerkUserId, chestType: award.bonus, streakDay: award.streakDay },
          "Streak milestone bonus chest awarded",
        );
      }
    } catch (err) {
      logger.warn({ err, code: room.code }, "streak update failed");
    }

    if (naturalEnd) {
      const chestType = rollSprintChest();
      try {
        await grantSprintChest(p.clerkUserId, chestType);
        if (p.ws.readyState === WebSocket.OPEN) {
          p.ws.send(JSON.stringify({ type: "chest_awarded", chestType }));
        }
        logger.info({ code: room.code, userId: p.clerkUserId, chestType }, "Sprint chest awarded");
      } catch (err) {
        logger.error({ err, code: room.code }, "Failed to grant sprint chest");
      }
    }
  }
}

export function endSprint(room: Room, naturalEnd = true): void {
  if (room.status === "finished") return;

  room.status = "finished";
  if (room.timerInterval) { clearInterval(room.timerInterval); room.timerInterval = null; }
  persistRoom(room);

  // Gladiator timer end: broadcast the HP-based outcome before the normal
  // results — BUT only when the match did NOT already end by execution. An
  // execution (gap ≥ death gap) is broadcast separately by the wsHandler with
  // the gap-based winner; HP and gap are independent, so also firing the
  // HP-based timer result here would send a second, possibly CONTRADICTORY
  // gladiator_execution that overwrites the correct one on the client.
  if (
    room.mode === "gladiator" &&
    room.gladiatorMatchStats &&
    !room.gladiatorMatchStats.endedByExecution
  ) {
    const fighters = Array.from(room.participants.values()).filter((p) => !p.isSpectator && p.role !== "editor");
    if (fighters.length === 2) {
      broadcastGladiatorTimerEnd(room, fighters[0], fighters[1], room.gladiatorMatchStats);
    }
  }

  // Compute final WPM as words / actual elapsed minutes (not the live EMA,
  // which only updates when wordCount changes — so a writer who blasts a
  // burst then pauses ends with an artificially low EMA). Use the real
  // elapsed time bounded by the configured duration; clamp to ≥1 second to
  // avoid division blow-ups for instantly-ended sprints.
  const sprintEndedAt = Date.now();
  const elapsedMs = room.startTime
    ? Math.min(sprintEndedAt - room.startTime, room.durationMinutes * 60_000)
    : room.durationMinutes * 60_000;
  const elapsedMinutes = Math.max(elapsedMs / 60_000, 1 / 60);

  const participants = Array.from(room.participants.values())
    .filter((p) => !p.isSpectator && p.role !== "editor")
    .map((p) => {
      const finalWpm = Math.round(p.wordCount / elapsedMinutes);
      // Update the in-memory participant so subsequent broadcasts
      // (results screen, persisted stats) use the accurate value.
      p.wpm = finalWpm;
      return {
        id: p.id,
        name: p.name,
        wordCount: p.wordCount,
        wpm: finalWpm,
        isCreator: p.isCreator,
        kartBonusWords: room.mode === "kart" ? p.kartBonusWords : 0,
        kartCarOffset: room.mode === "kart" ? p.kartCarOffset : 0,
      };
    })
    .sort((a, b) =>
      (b.wordCount + b.kartCarOffset) - (a.wordCount + a.kartCarOffset)
    );

  broadcastToRoom(room, { type: "sprint_ended", results: participants });

  // Persist writing and award XP server-side so data is never lost even if
  // a client disconnects before reaching the results screen.
  finalizeSprintData(room, naturalEnd).catch((err) =>
    logger.error({ err, code: room.code }, "Failed to finalize sprint data"),
  );

  // ── Settle bets ────────────────────────────────────────────────────────
  // Winner = first in `participants` (already sorted by score). Settle by
  // clerkUserId, NOT writer name — name matching could let an unrelated user
  // claim the pot. If the top scorer has no signed-in account, or everyone
  // wrote 0 words, treat as no winner so all bets refund.
  const topScorer = participants[0];
  const hasAnyWords = participants.some((p) => p.wordCount > 0);
  const winnerParticipant = topScorer
    ? room.participants.get(topScorer.id)
    : undefined;
  const winnerUserId = hasAnyWords && winnerParticipant?.clerkUserId
    ? winnerParticipant.clerkUserId
    : null;
  settleBets(room.code, winnerUserId)
    .then((outcomes) => notifyBetOutcomes(room, outcomes))
    .catch((err) => logger.error({ err, code: room.code }, "Failed to settle bets"));

  if (room.closeTimer) clearTimeout(room.closeTimer);
  room.closeTimer = setTimeout(() => {
    const current = rooms.get(room.code);
    if (!current || current.status !== "finished") return;
    if (current.timerInterval) clearInterval(current.timerInterval);
    rooms.delete(current.code);
    deleteRoomFromDB(current.code);
    // Refund any bets that somehow survived settlement (defensive — should be 0).
    refundActiveBets(current.code, "Sprint room closed without settlement").catch(() => undefined);
    current.participants.forEach((p) => {
      if (p.ws.readyState === WebSocket.OPEN) p.ws.close(1000, "Room closed after sprint");
    });
    logger.info({ code: current.code }, "Room auto-closed 10 min after sprint ended");
  }, POST_SPRINT_CLOSE_MS);

  logger.info({ code: room.code }, "Sprint ended");
}

function notifyBetOutcomes(room: Room, outcomes: BetOutcome[]): void {
  if (outcomes.length === 0) return;
  for (const o of outcomes) {
    // Find any open WS belonging to this user (matched by clerkUserId)
    for (const p of room.participants.values()) {
      if (p.clerkUserId === o.userId && p.ws.readyState === WebSocket.OPEN) {
        p.ws.send(JSON.stringify({
          type: "bet_settled",
          outcome: o.outcome,
          stake: o.amount,
          payout: o.payout,
        }));
      }
    }
  }
  // Broadcast a generic settled signal so all clients can refetch the pot view.
  broadcastToRoom(room, { type: "bets_settled" });
}

export function addParticipant(room: Room, participant: Participant): void {
  room.participants.set(participant.id, participant);
  broadcastRoomState(room);
}

/**
 * Update an existing participant's live connection in-place.
 *
 * Unlike removeParticipant + addParticipant, this:
 *  - Keeps the entry at its original position in `room.participants` (Map
 *    preserves insertion order), so every client's lane-map stays stable.
 *  - Emits only ONE broadcastRoomState instead of two, eliminating the
 *    one-frame flicker where other clients briefly see the writer disappear.
 */
export function reconnectParticipant(
  room: Room,
  existingId: string,
  ws: WebSocket,
  wordCount: number,
  text: string,
  isCreator: boolean,
  isSpectator: boolean,
  name: string,
  clerkUserId: string | null = null,
  role: "writer" | "editor" = "writer",
): Participant {
  const existing = room.participants.get(existingId);

  if (!existing) {
    // Participant was already removed (grace period expired just before this
    // reconnect arrived).  Fall back to a normal fresh add at end of Map.
    const participant: Participant = {
      id: existingId,
      name,
      wordCount,
      wpm: 0,
      lastWordCountTime: Date.now(),
      lastWordCount: wordCount,
      ws,
      isCreator,
      isSpectator,
      role,
      latestText: text,
      clerkUserId,
      nameplate: "default",
      xp: 0,
      kartItems: [],
      kartBonusWords: 0,
      kartCarOffset: 0,
      // Anchor to current progress so a reconnect after the grace-period
      // eviction can't re-earn items the user already collected before the
      // disconnect. Floor-to-250 + 250 = the NEXT threshold past their count.
      kartNextItemAt: Math.floor(wordCount / 250) * 250 + 250,
      gladiatorHp: 1000,
      gladiatorBuffs: [],
      gladiatorFrenzyStartWc: wordCount,
      gladiatorFrenzyStartTime: Date.now(),
      gladiatorAheadSince: null,
      gladiatorMomentumSince: null,
      gladiatorMomentumGapAtStart: null,
      gladiatorWoundSince: null,
      gladiatorWoundGapAtStart: null,
    };
    room.participants.set(existingId, participant);
    broadcastRoomState(room);
    return participant;
  }

  // Cancel any pending grace-period eviction (already cancelled in wsHandler
  // before this is called, but be safe in case the flow changes).
  if (existing.disconnectTimer) {
    clearTimeout(existing.disconnectTimer);
    existing.disconnectTimer = undefined;
  }

  // Mutate in-place — Map entry keeps its original insertion position.
  existing.ws = ws;
  existing.wordCount = wordCount;
  existing.lastWordCount = wordCount;
  existing.lastWordCountTime = Date.now();
  existing.wpm = 0;
  existing.isCreator = isCreator;
  existing.isSpectator = isSpectator;
  existing.role = role;
  existing.latestText = text;
  // Prefer the freshly-supplied clerkUserId; fall back to whatever was stored.
  existing.clerkUserId = clerkUserId ?? existing.clerkUserId;

  broadcastRoomState(room);
  return existing;
}

export function removeParticipant(room: Room, participantId: string): void {
  room.participants.delete(participantId);

  if (room.participants.size === 0) {
    const isActive = room.status === "running" || room.status === "countdown";

    if (isActive) {
      logger.info({ code: room.code, status: room.status }, "Room empty during active sprint — keeping alive");
      return;
    }

    const gracePeriodMs = 10 * 60 * 1000;
    const code = room.code;
    setTimeout(() => {
      const current = rooms.get(code);
      if (!current) return;
      if (current.participants.size === 0 && current.status !== "running" && current.status !== "countdown") {
        if (current.timerInterval) clearInterval(current.timerInterval);
        rooms.delete(code);
        deleteRoomFromDB(code);
        // Refund any active bets — sprint is being abandoned without settlement.
        refundActiveBets(code, "Sprint room abandoned — bet refunded").catch(() => undefined);
        logger.info({ code }, "Empty room cleaned up after grace period");
      }
    }, gracePeriodMs);

    logger.info({ code: room.code }, "Room empty — will clean up in 10 min if still unused");
    return;
  }

  broadcastRoomState(room);
}

export function updateParticipantStats(
  room: Room,
  participantId: string,
  wordCount: number
): void {
  const participant = room.participants.get(participantId);
  if (!participant) return;

  const now = Date.now();
  const timeDeltaMinutes = (now - participant.lastWordCountTime) / 60000;
  const wordDelta = Math.max(0, wordCount - participant.lastWordCount);

  let wpm = participant.wpm;
  if (timeDeltaMinutes > 0 && timeDeltaMinutes < 5) {
    const instantWpm = wordDelta / timeDeltaMinutes;
    wpm = Math.round(wpm * 0.7 + instantWpm * 0.3);
  }

  // Skip broadcasting if nothing meaningful changed — avoids flooding all clients
  // with updates on every mid-word keystroke (debounced at 100 ms on the client).
  if (participant.wordCount === wordCount && participant.wpm === wpm) return;

  participant.wordCount = wordCount;
  participant.wpm = wpm;
  participant.lastWordCountTime = now;
  participant.lastWordCount = wordCount;

  broadcastToRoom(room, {
    type: "participant_update",
    participant: {
      id: participant.id,
      name: participant.name,
      wordCount: participant.wordCount,
      wpm: participant.wpm,
      isCreator: participant.isCreator,
    },
  });

  // Boss mode: check if collective word count defeated the boss.
  // Editors don't race so their words don't count toward the boss goal.
  if (room.mode === "boss" && room.bossWordGoal && room.status === "running") {
    const total = Array.from(room.participants.values())
      .filter((p) => !p.isSpectator && p.role !== "editor")
      .reduce((sum, p) => sum + p.wordCount, 0);
    if (total >= room.bossWordGoal) {
      broadcastToRoom(room, { type: "boss_defeated", bossTotalWords: total });
      endSprint(room);
    }
  }
}

export function restartSprint(room: Room, durationMinutes: number): void {
  if (room.status !== "finished") return;

  if (room.closeTimer) { clearTimeout(room.closeTimer); room.closeTimer = undefined; }

  room.status = "waiting";
  room.startTime = null;
  room.endTime = null;
  room.countdownEndsAt = null;
  room.durationMinutes = durationMinutes;
  persistRoom(room);

  room.participants.forEach((p) => {
    p.wordCount = 0;
    p.wpm = 0;
    p.lastWordCount = 0;
    p.lastWordCountTime = Date.now();
  });

  broadcastRoomState(room);
  logger.info({ code: room.code }, "Sprint restarted");
}
