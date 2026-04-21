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
  broadcastToRoom,
  restartSprint,
  Participant,
} from "./roomManager";

function countWords(text: string): number {
  return text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
}

export function setupWebSocketServer(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    logger.info({ url: req.url }, "WebSocket connection established");

    let participantId: string | null = null;
    let roomCode: string | null = null;

    ws.on("message", (data: Buffer) => {
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
        const isSpectator = message.isSpectator === true;

        if (!code || !name) {
          ws.send(JSON.stringify({ type: "error", message: "code and name required" }));
          return;
        }

        const room = getRoom(code);
        if (!room) {
          ws.send(JSON.stringify({ type: "error", message: "Room not found" }));
          return;
        }

        if (room.status === "finished") {
          ws.send(JSON.stringify({ type: "error", message: "Sprint already finished" }));
          return;
        }

        participantId = uuidv4();
        roomCode = code;

        // Creator is the first non-spectator who matches the creator name
        const isCreator =
          !isSpectator &&
          room.participants.size === 0 &&
          name === room.creatorName;

        const participant: Participant = {
          id: participantId,
          name,
          wordCount: 0,
          wpm: 0,
          lastWordCountTime: Date.now(),
          lastWordCount: 0,
          ws,
          isCreator,
          isSpectator,
          latestText: "",
        };

        addParticipant(room, participant);

        // Collect current writers (non-spectators) for the join response
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
            isSpectator,
            room: {
              code: room.code,
              status: room.status,
              durationMinutes: room.durationMinutes,
              timeLeft:
                room.status === "running" && room.endTime
                  ? Math.max(0, Math.floor((room.endTime - Date.now()) / 1000))
                  : null,
              participants: currentParticipants,
            },
          })
        );

        // If joining as spectator, immediately send them the current text of all writers
        if (isSpectator) {
          room.participants.forEach((p) => {
            if (!p.isSpectator && p.latestText) {
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

        logger.info({ code, name, participantId, isSpectator }, "Participant joined room");
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
        if (participant.isSpectator) return;

        const text = (message.text as string) ?? "";
        // Client can send a pre-computed net word count to respect the
        // pre-sprint baseline; fall back to counting from the raw text.
        const netWordCount =
          typeof message.netWordCount === "number"
            ? Math.max(0, message.netWordCount)
            : countWords(text);

        // Store latest text so spectators (and late-joining spectators) can read it
        participant.latestText = text;

        updateParticipantStats(room, participantId, netWordCount);

        // Push live text to all current spectators
        const spectatorPayload = JSON.stringify({
          type: "participant_text",
          participantId,
          name: participant.name,
          text,
          wordCount: netWordCount,
        });
        room.participants.forEach((p) => {
          if (p.isSpectator && p.ws.readyState === WebSocket.OPEN) {
            p.ws.send(spectatorPayload);
          }
        });
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
      if (participantId && roomCode) {
        const room = getRoom(roomCode);
        if (room) {
          removeParticipant(room, participantId);
          logger.info({ code: roomCode, participantId }, "Participant left room");
        }
      }
    });

    ws.on("error", (err) => {
      logger.error({ err }, "WebSocket error");
    });
  });

  return wss;
}
