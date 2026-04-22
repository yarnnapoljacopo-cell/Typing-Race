import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage, Server } from "http";
import { v4 as uuidv4 } from "uuid";
import { logger } from "./logger";
import {
  getRoom,
  addParticipant,
  removeParticipant,
  updateParticipantStats,
  startSprint,
  endSprint,
  broadcastRoomState,
  restartSprint,
  Participant,
} from "./roomManager";
import { getWriting } from "./writingStore";

function countWords(text: string): number {
  return text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
}

export function setupWebSocketServer(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    logger.info({ url: req.url }, "WebSocket connection established");

    let participantId: string | null = null;
    let roomCode: string | null = null;

    ws.on("message", async (data: Buffer) => {
      let message: Record<string, unknown>;
      try {
        message = JSON.parse(data.toString());
      } catch {
        ws.send(JSON.stringify({ type: "error", message: "Invalid JSON" }));
        return;
      }

      const type = message.type as string;

      if (type === "join_room") {
        const code = (message.code as string)?.toUpperCase();
        const name = message.name as string;

        if (!code || !name) {
          ws.send(JSON.stringify({ type: "error", message: "code and name required" }));
          return;
        }

        const room = getRoom(code);
        if (!room) {
          ws.send(JSON.stringify({ type: "error", message: "Room not found" }));
          return;
        }

        // ── Inherit state from a previous connection with the same name ──────
        // If someone disconnects and quickly reconnects, they may still appear
        // in the room. Transfer their word count, text, AND id to the new
        // connection so client-side lane maps stay stable across reconnects.
        let inheritedWordCount = 0;
        let inheritedText = "";
        let inheritedIsCreator = false;
        let inheritedId: string | null = null;
        for (const [existingId, existingP] of room.participants) {
          if (existingP.name === name) {
            // Cancel any pending grace-period removal so the rejoin is seamless
            if (existingP.disconnectTimer) clearTimeout(existingP.disconnectTimer);
            inheritedWordCount = existingP.wordCount;
            inheritedText = existingP.latestText;
            inheritedIsCreator = existingP.isCreator;
            inheritedId = existingId; // reuse the same UUID so lane order never shifts
            removeParticipant(room, existingId);
            break;
          }
        }

        // ── Restore word count from DB if higher than in-memory value ────────
        const saved = await getWriting(code, name);
        const restoredWordCount = Math.max(inheritedWordCount, saved?.wordCount ?? 0);
        const restoredText = inheritedText || saved?.text || "";

        // Reuse the old id if this is a reconnect — guarantees lane stability
        participantId = inheritedId ?? uuidv4();
        roomCode = code;

        // Grant creator status if: (a) this is a reconnect that already had it,
        // OR (b) the name matches the room's designated creator name.
        // The old "size === 0" gate broke Discord-bot-launched sprints because
        // web participants had already joined by the time the bot connected.
        const isCreator = inheritedIsCreator || name === room.creatorName;

        // A participant may self-declare as spectator only if they are the creator
        // (prevents random people from hiding from the race track).
        const wantsSpectator = message.spectator === true;
        const isSpectator = wantsSpectator && isCreator;

        const participant: Participant = {
          id: participantId,
          name,
          wordCount: restoredWordCount,
          wpm: 0,
          lastWordCountTime: Date.now(),
          lastWordCount: restoredWordCount,
          ws,
          isCreator,
          isSpectator,
          latestText: restoredText,
        };

        addParticipant(room, participant);

        const currentParticipants = Array.from(room.participants.values())
          .filter((p) => !p.isSpectator)
          .map((p) => ({
            id: p.id,
            name: p.name,
            wordCount: p.wordCount,
            wpm: p.wpm,
            isCreator: p.isCreator,
          }));

        ws.send(
          JSON.stringify({
            type: "joined",
            participantId,
            isCreator,
            restoredWordCount: restoredWordCount > 0 ? restoredWordCount : undefined,
            room: {
              code: room.code,
              status: room.status,
              durationMinutes: room.durationMinutes,
              countdownDelayMinutes: room.countdownDelayMinutes,
              mode: room.mode,
              wordGoal: room.wordGoal,
              timeLeft:
                room.status === "running" && room.endTime
                  ? Math.max(0, Math.floor((room.endTime - Date.now()) / 1000))
                  : null,
              participants: currentParticipants,
            },
          })
        );

        // In open mode, catch the new participant up with everyone's current text
        if (room.mode === "open") {
          room.participants.forEach((p) => {
            if (p.id !== participantId && p.latestText) {
              ws.send(
                JSON.stringify({
                  type: "participant_text",
                  participantId: p.id,
                  name: p.name,
                  text: p.latestText,
                  wordCount: p.wordCount,
                })
              );
            }
          });
        }

        logger.info({ code, name, participantId }, "Participant joined room");
        return;
      }

      if (!participantId || !roomCode) {
        ws.send(JSON.stringify({ type: "error", message: "Must join a room first" }));
        return;
      }

      const room = getRoom(roomCode);
      if (!room) {
        ws.send(JSON.stringify({ type: "error", message: "Room no longer exists" }));
        return;
      }

      const participant = room.participants.get(participantId);
      if (!participant) return;

      if (type === "text_update") {
        if (room.status !== "running") return;

        const text = (message.text as string) ?? "";
        const netWordCount =
          typeof message.netWordCount === "number"
            ? Math.max(0, message.netWordCount)
            : countWords(text);

        // Detect suspicious resets: participant had significant progress but is
        // now sending 0.  Log a warning so we can diagnose reconnect edge-cases.
        const currentWc = participant.wordCount;
        if (netWordCount === 0 && currentWc > 10) {
          logger.warn(
            { code: roomCode, participantId, name: participant.name, previousWordCount: currentWc },
            "Participant word count reset to 0 — possible reconnect baseline bug"
          );
        }

        // Store latest text for catchup on reconnect / new joins
        participant.latestText = text;

        updateParticipantStats(room, participantId, netWordCount);

        // In open mode, broadcast live text to every other participant
        if (room.mode === "open") {
          const payload = JSON.stringify({
            type: "participant_text",
            participantId,
            name: participant.name,
            text,
            wordCount: netWordCount,
          });
          room.participants.forEach((p) => {
            if (p.id !== participantId && p.ws.readyState === WebSocket.OPEN) {
              p.ws.send(payload);
            }
          });
        }
        return;
      }

      if (type === "start_sprint") {
        if (!participant.isCreator) {
          ws.send(JSON.stringify({ type: "error", message: "Only the creator can start the sprint" }));
          return;
        }
        if (room.status !== "waiting") {
          ws.send(JSON.stringify({ type: "error", message: "Sprint already started" }));
          return;
        }
        startSprint(room);
        return;
      }

      if (type === "end_sprint") {
        if (!participant.isCreator) {
          ws.send(JSON.stringify({ type: "error", message: "Only the creator can end the sprint" }));
          return;
        }
        endSprint(room);
        return;
      }

      if (type === "restart_sprint") {
        if (!participant.isCreator) {
          ws.send(JSON.stringify({ type: "error", message: "Only the creator can restart the sprint" }));
          return;
        }
        const durationMinutes = (message.durationMinutes as number) || room.durationMinutes;
        restartSprint(room, durationMinutes);
        return;
      }

      if (type === "ping") {
        ws.send(JSON.stringify({ type: "pong" }));
        return;
      }

      logger.warn({ type }, "Unknown WebSocket message type");
    });

    ws.on("close", () => {
      if (!participantId || !roomCode) return;
      const room = getRoom(roomCode);
      if (!room) return;

      // Apply a 30-second grace period during active sprints AND the post-sprint
      // results window, so a network blip or quick refresh doesn't evict the
      // participant. "finished" gets the same grace so reconnecting back to the
      // results screen works seamlessly.
      const hasGracePeriod =
        room.status === "running" ||
        room.status === "countdown" ||
        room.status === "finished";

      if (hasGracePeriod) {
        const p = room.participants.get(participantId);
        if (p) {
          if (p.disconnectTimer) clearTimeout(p.disconnectTimer);
          p.disconnectTimer = setTimeout(() => {
            const currentRoom = getRoom(roomCode!);
            if (currentRoom?.participants.has(participantId!)) {
              removeParticipant(currentRoom, participantId!);
              logger.info({ code: roomCode, participantId }, "Participant removed after 30 s grace period");
            }
          }, 30_000);
          logger.info({ code: roomCode, participantId }, "Participant disconnected — 30 s grace started");
        }
      } else {
        removeParticipant(room, participantId);
        logger.info({ code: roomCode, participantId }, "Participant left room");
      }
    });

    ws.on("error", (err) => {
      logger.error({ err }, "WebSocket error");
    });
  });

  return wss;
}
