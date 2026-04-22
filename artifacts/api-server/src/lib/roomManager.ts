import { WebSocket } from "ws";
import { logger } from "./logger";
import { db, roomsTable } from "@workspace/db";
import { eq, gt, and, ne } from "drizzle-orm";

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
  disconnectTimer?: ReturnType<typeof setTimeout>;
}

export type RoomMode = "regular" | "open" | "goal" | "boss";

export interface Room {
  code: string;
  creatorName: string;
  durationMinutes: number;
  countdownDelayMinutes: number;
  mode: RoomMode;
  wordGoal: number | null;
  bossWordGoal: number | null;
  deathModeWpm: number | null;
  status: RoomStatus;
  participants: Map<string, Participant>;
  startTime: number | null;
  endTime: number | null;
  countdownEndsAt: number | null;
  timerInterval: ReturnType<typeof setInterval> | null;
  closeTimer?: ReturnType<typeof setTimeout>;
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
        status: row.status as RoomStatus,
        participants: new Map(),
        startTime: row.startTime ?? null,
        endTime: row.endTime ?? null,
        countdownEndsAt: row.countdownEndsAt ?? null,
        timerInterval: null,
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

export function createRoom(
  creatorName: string,
  durationMinutes: number,
  mode: RoomMode = "regular",
  countdownDelayMinutes = 0,
  wordGoal: number | null = null,
  deathModeWpm: number | null = null,
  bossWordGoal: number | null = null
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
    status: "waiting",
    participants: new Map(),
    startTime: null,
    endTime: null,
    countdownEndsAt: null,
    timerInterval: null,
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
      timeLeft,
      countdownTimeLeft,
      participants,
    },
  });
}

export function startSprint(room: Room): void {
  if (room.status !== "waiting") return;

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

export function endSprint(room: Room): void {
  if (room.status === "finished") return;

  room.status = "finished";
  if (room.timerInterval) { clearInterval(room.timerInterval); room.timerInterval = null; }
  persistRoom(room);

  const participants = Array.from(room.participants.values())
    .filter((p) => !p.isSpectator)
    .map((p) => ({
      id: p.id,
      name: p.name,
      wordCount: p.wordCount,
      wpm: p.wpm,
      isCreator: p.isCreator,
    }))
    .sort((a, b) => b.wordCount - a.wordCount);

  broadcastToRoom(room, { type: "sprint_ended", results: participants });

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
