import { WebSocket } from "ws";
import { logger } from "./logger";

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
}

export type RoomMode = "regular" | "open";

export interface Room {
  code: string;
  creatorName: string;
  durationMinutes: number;
  countdownDelayMinutes: number;
  mode: RoomMode;
  status: RoomStatus;
  participants: Map<string, Participant>;
  startTime: number | null;
  endTime: number | null;
  countdownEndsAt: number | null;
  timerInterval: ReturnType<typeof setInterval> | null;
}

const rooms = new Map<string, Room>();

function generateRoomCode(): string {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `SPRINT-${num}`;
}

export function createRoom(
  creatorName: string,
  durationMinutes: number,
  mode: RoomMode = "regular",
  countdownDelayMinutes = 0
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
    status: "waiting",
    participants: new Map(),
    startTime: null,
    endTime: null,
    countdownEndsAt: null,
    timerInterval: null,
  };

  rooms.set(code, room);
  logger.info({ code, creatorName, durationMinutes, countdownDelayMinutes }, "Room created");

  setTimeout(() => {
    if (rooms.has(code) && rooms.get(code)!.status === "waiting") {
      rooms.delete(code);
      logger.info({ code }, "Room expired after inactivity");
    }
  }, 2 * 60 * 60 * 1000);

  return room;
}

export function getRoom(code: string): Room | undefined {
  return rooms.get(code);
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

  const message = {
    type: "room_state",
    room: {
      code: room.code,
      status: room.status,
      durationMinutes: room.durationMinutes,
      countdownDelayMinutes: room.countdownDelayMinutes,
      mode: room.mode,
      timeLeft,
      countdownTimeLeft,
      participants,
    },
  };

  broadcastToRoom(room, message);
}

export function startSprint(room: Room): void {
  if (room.status !== "waiting") return;

  if (room.countdownDelayMinutes > 0) {
    // Enter countdown phase first
    room.status = "countdown";
    room.countdownEndsAt = Date.now() + room.countdownDelayMinutes * 60 * 1000;

    broadcastRoomState(room);

    room.timerInterval = setInterval(() => {
      const now = Date.now();
      if (!room.countdownEndsAt || now >= room.countdownEndsAt) {
        // Transition from countdown to running
        if (room.timerInterval) {
          clearInterval(room.timerInterval);
          room.timerInterval = null;
        }
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

export function endSprint(room: Room): void {
  if (room.status === "finished") return;

  room.status = "finished";
  if (room.timerInterval) {
    clearInterval(room.timerInterval);
    room.timerInterval = null;
  }

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

  broadcastToRoom(room, {
    type: "sprint_ended",
    results: participants,
  });

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
      // Room is mid-sprint — keep it alive so reconnects can restore it.
      // The sprint timer will call endSprint naturally when time runs out.
      logger.info({ code: room.code, status: room.status }, "Room empty during active sprint — keeping alive");
      return;
    }

    // Waiting or finished — schedule cleanup after a grace period so brief
    // disconnects don't kill the room before a rejoin can succeed.
    const gracePeriodMs = 10 * 60 * 1000; // 10 minutes
    const code = room.code;
    setTimeout(() => {
      const current = rooms.get(code);
      if (!current) return;
      if (current.participants.size === 0 && current.status !== "running" && current.status !== "countdown") {
        if (current.timerInterval) clearInterval(current.timerInterval);
        rooms.delete(code);
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
}

export function restartSprint(room: Room, durationMinutes: number): void {
  if (room.status !== "finished") return;

  room.status = "waiting";
  room.startTime = null;
  room.endTime = null;
  room.countdownEndsAt = null;
  room.durationMinutes = durationMinutes;

  room.participants.forEach((p) => {
    p.wordCount = 0;
    p.wpm = 0;
    p.lastWordCount = 0;
    p.lastWordCountTime = Date.now();
  });

  broadcastRoomState(room);
  logger.info({ code: room.code }, "Sprint restarted");
}
