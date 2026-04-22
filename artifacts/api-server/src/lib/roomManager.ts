import { WebSocket } from "ws";
import { logger } from "./logger";
import { db, roomsTable, userProfilesTable, sprintWritingTable } from "@workspace/db";
import { eq, gt, and, ne, sql } from "drizzle-orm";
import { saveWriting } from "./writingStore";
import { initGladiatorParticipant, broadcastGladiatorTimerEnd } from "./gladiatorEngine";

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
  latestText: string;
  clerkUserId: string | null;
  disconnectTimer?: ReturnType<typeof setTimeout>;
  kartItems: string[];
  kartBonusWords: number;
  kartNextItemAt: number;
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

function persistRoom(room: Room): void {
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
        updatedAt: new Date(),
      },
    })
    .catch((err: unknown) => logger.error({ err, code: room.code }, "Failed to persist room"));
}

function deleteRoomFromDB(code: string): void {
  db.delete(roomsTable)
    .where(eq(roomsTable.code, code))
    .catch((err: unknown) => logger.error({ err, code }, "Failed to delete room from DB"));
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
  };

  rooms.set(code, room);
  persistRoom(room);
  logger.info({ code, creatorName, durationMinutes, countdownDelayMinutes }, "Room created");

  setTimeout(() => {
    if (rooms.has(code) && rooms.get(code)!.status === "waiting") {
      rooms.delete(code);
      deleteRoomFromDB(code);
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
        participantCount: Array.from(r.participants.values()).filter((p) => !p.isSpectator).length,
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
  const participants = Array.from(room.participants.values())
    .filter((p) => !p.isSpectator)
    .map((p) => ({
      id: p.id,
      name: p.name,
      wordCount: p.wordCount,
      wpm: p.wpm,
      isCreator: p.isCreator,
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
    ? participants.reduce((sum, p) => sum + p.wordCount, 0)
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
      timeLeft,
      countdownTimeLeft,
      participants,
    },
  });
}

export function startSprint(room: Room): void {
  if (room.status !== "waiting") return;

  // Gladiator mode requires exactly 2 non-spectator participants
  if (room.mode === "gladiator") {
    const fighters = Array.from(room.participants.values()).filter((p) => !p.isSpectator);
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
      if (!p.isSpectator) initGladiatorParticipant(p);
    });
  }

  broadcastRoomState(room);

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
async function finalizeSprintData(room: Room): Promise<void> {
  const allParticipants = Array.from(room.participants.values()).filter((p) => !p.isSpectator);
  if (allParticipants.length === 0) return;

  const sorted = [...allParticipants].sort((a, b) => b.wordCount - a.wordCount);
  const firstPlaceId = sorted[0]?.id;

  await Promise.all(allParticipants.map(async (p) => {
    // Always flush the server's in-memory copy to the DB so no text is lost
    if (p.latestText || p.wordCount > 0) {
      await saveWriting(room.code, p.name, p.latestText, p.wordCount, p.clerkUserId, room.mode, room.wordGoal);
    }

    // Award XP for signed-in users with non-zero words
    if (!p.clerkUserId || p.wordCount <= 0) return;

    // Check idempotency flag — if client already awarded XP, skip
    const rows = await db
      .select({ xpAwarded: sprintWritingTable.xpAwarded })
      .from(sprintWritingTable)
      .where(and(
        eq(sprintWritingTable.roomCode, room.code),
        eq(sprintWritingTable.participantName, p.name),
      ))
      .limit(1);

    if (rows[0]?.xpAwarded) return;

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
  }));
}

export function endSprint(room: Room): void {
  if (room.status === "finished") return;

  room.status = "finished";
  if (room.timerInterval) { clearInterval(room.timerInterval); room.timerInterval = null; }
  persistRoom(room);

  // Gladiator timer end: broadcast HP-based outcome before the normal results
  if (room.mode === "gladiator" && room.gladiatorMatchStats) {
    const fighters = Array.from(room.participants.values()).filter((p) => !p.isSpectator);
    if (fighters.length === 2) {
      broadcastGladiatorTimerEnd(room, fighters[0], fighters[1], room.gladiatorMatchStats);
    }
  }

  const participants = Array.from(room.participants.values())
    .filter((p) => !p.isSpectator)
    .map((p) => ({
      id: p.id,
      name: p.name,
      wordCount: p.wordCount,
      wpm: p.wpm,
      isCreator: p.isCreator,
      kartBonusWords: room.mode === "kart" ? p.kartBonusWords : 0,
    }))
    .sort((a, b) => (b.wordCount + b.kartBonusWords) - (a.wordCount + a.kartBonusWords));

  broadcastToRoom(room, { type: "sprint_ended", results: participants });

  // Persist writing and award XP server-side so data is never lost even if
  // a client disconnects before reaching the results screen.
  finalizeSprintData(room).catch((err) =>
    logger.error({ err, code: room.code }, "Failed to finalize sprint data"),
  );

  if (room.closeTimer) clearTimeout(room.closeTimer);
  room.closeTimer = setTimeout(() => {
    const current = rooms.get(room.code);
    if (!current || current.status !== "finished") return;
    if (current.timerInterval) clearInterval(current.timerInterval);
    rooms.delete(current.code);
    deleteRoomFromDB(current.code);
    current.participants.forEach((p) => {
      if (p.ws.readyState === WebSocket.OPEN) p.ws.close(1000, "Room closed after sprint");
    });
    logger.info({ code: current.code }, "Room auto-closed 10 min after sprint ended");
  }, POST_SPRINT_CLOSE_MS);

  logger.info({ code: room.code }, "Sprint ended");
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
      latestText: text,
      clerkUserId,
      kartItems: [],
      kartBonusWords: 0,
      kartNextItemAt: 250,
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

  // Boss mode: check if collective word count defeated the boss
  if (room.mode === "boss" && room.bossWordGoal && room.status === "running") {
    const total = Array.from(room.participants.values())
      .filter((p) => !p.isSpectator)
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
