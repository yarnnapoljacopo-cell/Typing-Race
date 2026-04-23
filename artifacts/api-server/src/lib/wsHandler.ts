import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage, Server } from "http";
import { v4 as uuidv4 } from "uuid";
import { logger } from "./logger";
import bcrypt from "bcrypt";
import {
  getRoom,
  addParticipant,
  reconnectParticipant,
  removeParticipant,
  updateParticipantStats,
  startSprint,
  endSprint,
  broadcastRoomState,
  broadcastToRoom,
  restartSprint,
  Participant,
  Room,
} from "./roomManager";
import { getWriting } from "./writingStore";
import { db, userProfilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { rollItem, rollMysteryItems, ITEM_EMOJIS } from "./kartItems";
import {
  initGladiatorParticipant,
  processGladiatorUpdate,
  broadcastGladiatorExecution,
  broadcastGladiatorTimerEnd,
  broadcastGladiatorState,
} from "./gladiatorEngine";

function countWords(text: string): number {
  return text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
}

function isStarActive(room: Room, participantId: string): boolean {
  const expiry = room.activeStars.get(participantId);
  return expiry !== undefined && expiry > Date.now();
}

function getActiveParticipants(room: Room): Participant[] {
  return Array.from(room.participants.values()).filter((p) => !p.isSpectator);
}

function getParticipantPosition(room: Room, participantId: string): { position: number; total: number } {
  const active = getActiveParticipants(room);
  const sorted = [...active].sort((a, b) => b.wordCount - a.wordCount);
  const pos = sorted.findIndex((p) => p.id === participantId) + 1;
  return { position: pos || active.length, total: active.length };
}

function getRedirectTarget(room: Room, excludeIds: string[]): Participant | null {
  const eligible = getActiveParticipants(room).filter(
    (p) => !excludeIds.includes(p.id) && !isStarActive(room, p.id) && p.ws.readyState === WebSocket.OPEN,
  );
  return eligible.length > 0 ? eligible[Math.floor(Math.random() * eligible.length)] : null;
}

function sendEffect(target: Participant, effect: string, duration?: number, sourceName?: string, extra?: Record<string, unknown>): void {
  if (target.ws.readyState === WebSocket.OPEN) {
    target.ws.send(JSON.stringify({ type: "item_effect_start", effect, duration, sourceName, ...extra }));
  }
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

        // ── Gladiator: max 2 fighters ─────────────────────────────────────────
        if (room.mode === "gladiator") {
          const fighters = Array.from(room.participants.values()).filter((p) => !p.isSpectator && p.name !== name);
          if (fighters.length >= 2) {
            ws.send(JSON.stringify({ type: "error", message: "The arena is full. Two gladiators have already entered.", code: "ARENA_FULL" }));
            ws.close();
            return;
          }
        }

        // ── Password check ────────────────────────────────────────────────────
        if (room.passwordHash) {
          const providedPassword = message.password as string | undefined;
          if (!providedPassword) {
            ws.send(JSON.stringify({ type: "error", message: "Password required", code: "PASSWORD_REQUIRED" }));
            return;
          }
          const match = await bcrypt.compare(providedPassword, room.passwordHash);
          if (!match) {
            ws.send(JSON.stringify({ type: "error", message: "Incorrect room password", code: "WRONG_PASSWORD" }));
            return;
          }
        }

        // ── Inherit state from a previous connection with the same name ──────
        // If someone disconnects and quickly reconnects, they may still appear
        // in the room. Transfer their word count, text, AND id to the new
        // connection so client-side lane maps stay stable across reconnects.
        const incomingClerkUserId = (message.clerkUserId as string | null | undefined) ?? null;
        let inheritedWordCount = 0;
        let inheritedText = "";
        let inheritedIsCreator = false;
        let inheritedClerkUserId: string | null = null;
        let inheritedId: string | null = null;
        for (const [existingId, existingP] of room.participants) {
          if (existingP.name === name) {
            // Cancel any pending grace-period removal so the rejoin is seamless.
            // Do NOT call removeParticipant here — we will update this entry
            // in-place via reconnectParticipant so the Map position (and
            // therefore every client's lane/colour assignment) never changes.
            if (existingP.disconnectTimer) clearTimeout(existingP.disconnectTimer);
            inheritedWordCount = existingP.wordCount;
            inheritedText = existingP.latestText;
            inheritedIsCreator = existingP.isCreator;
            inheritedClerkUserId = existingP.clerkUserId;
            inheritedId = existingId;
            break;
          }
        }
        // ── Verify incoming clerkUserId actually belongs to this writer name ──
        // Never trust a client-supplied Clerk ID without confirming the DB-stored
        // writerName matches. This prevents a malicious client from claiming
        // someone else's ID and having XP awarded into their account.
        let verifiedClerkUserId: string | null = null;
        if (incomingClerkUserId) {
          const verifyRows = await db
            .select({ writerName: userProfilesTable.writerName })
            .from(userProfilesTable)
            .where(eq(userProfilesTable.clerkUserId, incomingClerkUserId))
            .limit(1);
          if (verifyRows[0]?.writerName === name) {
            verifiedClerkUserId = incomingClerkUserId;
          }
          // If writerName doesn't match, silently discard the supplied ID.
        }
        const resolvedClerkUserId = verifiedClerkUserId ?? inheritedClerkUserId;

        // ── Look up profile for nameplate, xp, and Grand Scribe spectating ──
        let userNameplate = "default";
        let userXp = 0;
        if (resolvedClerkUserId) {
          const profileRows = await db
            .select({ xp: userProfilesTable.xp, activeNameplate: userProfilesTable.activeNameplate })
            .from(userProfilesTable)
            .where(eq(userProfilesTable.clerkUserId, resolvedClerkUserId))
            .limit(1);
          if (profileRows[0]) {
            userXp = profileRows[0].xp;
            // Only apply nameplate if user still has the required XP for it
            const nameplateMinXp: Record<string, number> = {
              crimson: 10000, gold: 25000, blue: 75000, purple: 200000,
            };
            const minRequired = nameplateMinXp[profileRows[0].activeNameplate] ?? 0;
            userNameplate = userXp >= minRequired ? (profileRows[0].activeNameplate ?? "default") : "default";
          }
        }

        // Grand Scribes (25k+ XP) can join any room as an invisible spectator
        const isGrandScribe = userXp >= 25000;

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

        // Creators and Grand Scribes (25k+ XP) can join as invisible spectators
        const wantsSpectator = message.spectator === true;
        const isSpectator = wantsSpectator && (isCreator || isGrandScribe);

        // For reconnects, update the existing entry in-place so the participant
        // keeps their original Map position (= stable lane + colour for everyone).
        // For new joins, insert normally.
        let participant: Participant;
        if (inheritedId) {
          participant = reconnectParticipant(
            room,
            participantId,
            ws,
            restoredWordCount,
            restoredText,
            isCreator,
            isSpectator,
            name,
            resolvedClerkUserId,
          );
        } else {
          participant = {
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
            clerkUserId: resolvedClerkUserId,
            nameplate: userNameplate,
            xp: userXp,
            kartItems: [],
            kartBonusWords: 0,
            kartCarOffset: 0,
            kartNextItemAt: 250,
            gladiatorHp: 1000,
            gladiatorBuffs: [],
            gladiatorFrenzyStartWc: restoredWordCount,
            gladiatorFrenzyStartTime: Date.now(),
            gladiatorAheadSince: null,
            gladiatorMomentumSince: null,
            gladiatorMomentumGapAtStart: null,
            gladiatorWoundSince: null,
            gladiatorWoundGapAtStart: null,
          };
          addParticipant(room, participant);
        }

        // Always refresh nameplate/xp for reconnects too
        if (inheritedId) {
          const p = room.participants.get(participantId);
          if (p) { p.nameplate = userNameplate; p.xp = userXp; }
        }

        // Update creatorXp when the creator joins
        if (isCreator) room.creatorXp = userXp;

        const currentParticipants = Array.from(room.participants.values())
          .filter((p) => !p.isSpectator)
          .map((p) => ({
            id: p.id,
            name: p.name,
            wordCount: p.wordCount,
            wpm: p.wpm,
            isCreator: p.isCreator,
            nameplate: p.nameplate,
            xp: p.xp,
          }));

        const bossTotalWords = room.mode === "boss"
          ? currentParticipants.reduce((sum, p) => sum + p.wordCount, 0)
          : null;

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
              bossWordGoal: room.bossWordGoal,
              bossTotalWords,
              deathModeWpm: room.deathModeWpm,
              gladiatorDeathGap: room.gladiatorDeathGap,
              timeLeft:
                room.status === "running" && room.endTime
                  ? Math.max(0, Math.floor((room.endTime - Date.now()) / 1000))
                  : null,
              participants: currentParticipants,
              creatorXp: room.creatorXp,
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

        // Kart mode: item earning + banana trap check
        if (room.mode === "kart" && room.status === "running") {
          const { position, total } = getParticipantPosition(room, participantId);

          while (participant.kartItems.length < 3 && participant.wordCount >= participant.kartNextItemAt) {
            participant.kartNextItemAt += 250;
            const item = rollItem(position, total, !room.goldenPenUsed);
            if (item === "golden_pen") room.goldenPenUsed = true;
            participant.kartItems.push(item);
            ws.send(JSON.stringify({ type: "item_earned", item, emoji: ITEM_EMOJIS[item] }));
          }

          room.bananaTraps = room.bananaTraps.filter((trap) => {
            if (trap.placedById === participantId) return true;
            if (participant.wordCount <= trap.threshold) return true;

            let targetPId = participantId;
            let targetP: Participant = participant;

            if (isStarActive(room, participantId)) {
              const redirect = getRedirectTarget(room, [participantId, trap.placedById]);
              if (redirect) { targetPId = redirect.id; targetP = redirect; }
              else return false;
            }

            sendEffect(targetP, "bold_text", 5000, trap.placedByName);
            broadcastToRoom(room, {
              type: "item_used", item: "banana", emoji: ITEM_EMOJIS["banana"],
              sourceId: trap.placedById, sourceName: trap.placedByName,
              targetId: targetPId, targetName: targetP.name,
              effect: "bold_text", duration: 5000,
            });
            return false;
          });
        }

        // ── Gladiator mode: process combat ───────────────────────────────────
        if (room.mode === "gladiator" && room.status === "running" && room.gladiatorMatchStats) {
          // currentWc was captured before updateParticipantStats ran — use as prevWordCount
          const result = processGladiatorUpdate(room, participant, netWordCount, currentWc);
          if (result.executed && result.winnerId) {
            const active = Array.from(room.participants.values()).filter((p) => !p.isSpectator);
            const winner = active.find((p) => p.id === result.winnerId);
            const loser = active.find((p) => p.id !== result.winnerId);
            if (winner && loser) {
              broadcastGladiatorExecution(room, winner, loser, room.gladiatorMatchStats);
            }
            endSprint(room);
          }
        }

        return;
      }

      if (type === "use_item") {
        if (room.mode !== "kart" || room.status !== "running") return;
        const item = message.item as string;
        const itemIdx = participant.kartItems.indexOf(item);
        if (itemIdx === -1) return;
        participant.kartItems.splice(itemIdx, 1);

        const active = getActiveParticipants(room);
        const sorted = [...active].sort((a, b) => b.wordCount - a.wordCount);
        const senderIdx = sorted.findIndex((p) => p.id === participantId);

        switch (item) {
          case "red_shell": {
            const ahead = senderIdx > 0 ? sorted[senderIdx - 1] : null;
            if (!ahead || ahead.id === participantId) break;
            const targetP = isStarActive(room, ahead.id)
              ? getRedirectTarget(room, [participantId, ahead.id])
              : ahead;
            if (!targetP) break;
            sendEffect(targetP, "blur_counter", 20000, participant.name);
            broadcastToRoom(room, {
              type: "item_used", item, emoji: ITEM_EMOJIS[item as keyof typeof ITEM_EMOJIS],
              sourceId: participantId, sourceName: participant.name,
              targetId: targetP.id, targetName: targetP.name,
              effect: "blur_counter", duration: 20000,
            });
            break;
          }
          case "green_shell": {
            const pool = active.filter((p) => !isStarActive(room, p.id) && p.ws.readyState === WebSocket.OPEN);
            if (pool.length === 0) break;
            const targetP = pool[Math.floor(Math.random() * pool.length)];
            broadcastToRoom(room, {
              type: "item_used", item, emoji: ITEM_EMOJIS[item as keyof typeof ITEM_EMOJIS],
              sourceId: participantId, sourceName: participant.name,
              targetId: targetP.id, targetName: targetP.name,
              effect: "car_subtract", amount: 100,
            });
            break;
          }
          case "banana": {
            const trapId = Math.random().toString(36).slice(2);
            room.bananaTraps.push({ id: trapId, placedById: participantId, placedByName: participant.name, threshold: participant.wordCount });
            broadcastToRoom(room, {
              type: "item_used", item, emoji: ITEM_EMOJIS[item as keyof typeof ITEM_EMOJIS],
              sourceId: participantId, sourceName: participant.name,
              effect: "banana_placed",
            });
            break;
          }
          case "star": {
            const expiry = Date.now() + 30000;
            room.activeStars.set(participantId, expiry);
            setTimeout(() => room.activeStars.delete(participantId), 30000);
            sendEffect(participant, "star", 30000);
            broadcastToRoom(room, {
              type: "item_used", item, emoji: ITEM_EMOJIS[item as keyof typeof ITEM_EMOJIS],
              sourceId: participantId, sourceName: participant.name,
              targetId: participantId, effect: "star", duration: 30000,
            });
            break;
          }
          case "blue_shell": {
            let targetP = sorted[0];
            if (!targetP) break;
            if (targetP.id === participantId && sorted.length > 1) targetP = sorted[1];
            if (isStarActive(room, targetP.id)) {
              const redirect = getRedirectTarget(room, [participantId]);
              if (!redirect) break;
              targetP = redirect;
            }
            targetP.kartCarOffset -= 200;
            broadcastToRoom(room, {
              type: "item_used", item, emoji: ITEM_EMOJIS[item as keyof typeof ITEM_EMOJIS],
              sourceId: participantId, sourceName: participant.name,
              targetId: targetP.id, targetName: targetP.name,
              effect: "car_subtract", amount: 200,
            });
            break;
          }
          case "lightning": {
            const hitIds: string[] = [];
            const hitNames: string[] = [];
            for (const p of active) {
              if (p.id === participantId) continue;
              if (isStarActive(room, p.id)) continue;
              p.kartCarOffset -= 300;
              hitIds.push(p.id);
              hitNames.push(p.name);
            }
            broadcastToRoom(room, {
              type: "item_used", item, emoji: ITEM_EMOJIS[item as keyof typeof ITEM_EMOJIS],
              sourceId: participantId, sourceName: participant.name,
              targetIds: hitIds, targetNames: hitNames,
              effect: "car_subtract", amount: 300,
            });
            break;
          }
          case "mushroom": {
            participant.kartCarOffset += 200;
            broadcastToRoom(room, {
              type: "item_used", item, emoji: ITEM_EMOJIS[item as keyof typeof ITEM_EMOJIS],
              sourceId: participantId, sourceName: participant.name,
              targetId: participantId, targetName: participant.name,
              effect: "car_add", amount: 200,
            });
            break;
          }
          case "mystery_box": {
            const newItems = rollMysteryItems(3);
            const available = 3 - participant.kartItems.length;
            const toAdd = newItems.slice(0, available);
            participant.kartItems.push(...toAdd);
            for (const ni of toAdd) {
              ws.send(JSON.stringify({ type: "item_earned", item: ni, emoji: ITEM_EMOJIS[ni] }));
            }
            broadcastToRoom(room, {
              type: "item_used", item, emoji: ITEM_EMOJIS[item as keyof typeof ITEM_EMOJIS],
              sourceId: participantId, sourceName: participant.name,
              effect: "mystery_box",
            });
            break;
          }
          case "boo": {
            if (senderIdx <= 0 && sorted.length > 0) break;
            const ahead = senderIdx > 0 ? sorted[senderIdx - 1] : null;
            if (!ahead || ahead.kartItems.length === 0) break;
            const stealIdx = Math.floor(Math.random() * ahead.kartItems.length);
            const stolen = ahead.kartItems.splice(stealIdx, 1)[0];
            if (participant.kartItems.length < 3) {
              participant.kartItems.push(stolen);
              ws.send(JSON.stringify({ type: "item_earned", item: stolen, emoji: ITEM_EMOJIS[stolen as keyof typeof ITEM_EMOJIS] }));
            }
            broadcastToRoom(room, {
              type: "item_used", item, emoji: ITEM_EMOJIS[item as keyof typeof ITEM_EMOJIS],
              sourceId: participantId, sourceName: participant.name,
              targetId: ahead.id, targetName: ahead.name,
              stolenItem: stolen, stolenEmoji: ITEM_EMOJIS[stolen as keyof typeof ITEM_EMOJIS],
              effect: "boo",
            });
            break;
          }
          case "golden_pen": {
            participant.kartBonusWords += 400;
            broadcastToRoom(room, {
              type: "item_used", item, emoji: ITEM_EMOJIS[item as keyof typeof ITEM_EMOJIS],
              sourceId: participantId, sourceName: participant.name,
              targetId: participantId, targetName: participant.name,
              effect: "bonus_words", amount: 400,
            });
            break;
          }
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
