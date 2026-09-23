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
import { socketUserId } from "./socketAuth";
import { getWriting } from "./writingStore";
import { db, userProfilesTable, guildMembersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { markOnline, markOffline } from "./guildPresence";
import { rollItem, rollMysteryItems, ITEM_EMOJIS } from "./kartItems";
import { visibleKartWords, kartWordCeiling } from "./kartWriting";
import {
  initGladiatorParticipant,
  processGladiatorUpdate,
  broadcastGladiatorExecution,
  broadcastGladiatorTimerEnd,
  broadcastGladiatorState,
  advanceGladiatorCombat,
} from "./gladiatorEngine";

function countWords(text: string): number {
  return text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
}

// ── Emotes (Clash-Royale-style taunts) ──────────────────────────────────────
// Server-validated list so clients can only send curated, on-brand emotes.
// IDs and labels are mirrored on the client in src/components/EmoteBar.tsx.
const EMOTES: Record<string, { emoji: string; label: string }> = {
  too_slow:     { emoji: "😏", label: "Too slow!" },
  haha:         { emoji: "😂", label: "Haha!" },
  eat_dust:     { emoji: "🚀", label: "Eat my dust!" },
  catch_up:     { emoji: "🐢", label: "Catch up!" },
  on_fire:      { emoji: "🔥", label: "On fire!" },
  bow_down:     { emoji: "👑", label: "Bow down." },
  write_faster: { emoji: "✍️", label: "Write faster!" },
  good_luck:    { emoji: "🤝", label: "Good luck!" },
  bring_it:     { emoji: "💪", label: "Bring it!" },
  wake_up:      { emoji: "😴", label: "Wake up!" },
  big_brain:    { emoji: "🧠", label: "Big brain." },
  gg:           { emoji: "🏁", label: "GG!" },
};
const EMOTE_COOLDOWN_MS = 1500;

function isStarActive(room: Room, participantId: string): boolean {
  const expiry = room.activeStars.get(participantId);
  return expiry !== undefined && expiry > Date.now();
}

function getActiveParticipants(room: Room): Participant[] {
  return Array.from(room.participants.values()).filter((p) => !p.isSpectator && p.role !== "editor");
}

function getParticipantPosition(room: Room, participantId: string): { position: number; total: number } {
  const active = getActiveParticipants(room);
  const sorted = [...active].sort((a, b) => kartScore(b) - kartScore(a));
  const pos = sorted.findIndex((p) => p.id === participantId) + 1;
  return { position: pos || active.length, total: active.length };
}

function kartScore(participant: Participant): number {
  return participant.wordCount + participant.kartCarOffset;
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

function checkBananaTraps(room: Room, participant: Participant, previousPosition: number): void {
  const currentPosition = kartScore(participant);
  room.bananaTraps = room.bananaTraps.filter((trap) => {
    if (trap.placedById === participant.id || previousPosition > trap.threshold || currentPosition <= trap.threshold) return true;
    const target = isStarActive(room, participant.id)
      ? getRedirectTarget(room, [participant.id, trap.placedById])
      : participant;
    if (!target) return false;
    sendEffect(target, "bold_text", 5000, trap.placedByName);
    broadcastToRoom(room, {
      type: "item_used", item: "banana", emoji: ITEM_EMOJIS.banana,
      sourceId: trap.placedById, sourceName: trap.placedByName,
      targetId: target.id, targetName: target.name,
      effect: "bold_text", duration: 5000,
    });
    return false;
  });
}

export function setupWebSocketServer(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 5 * 1024 * 1024 });
  server.on("upgrade", (req, socket, head) => {
    if (new URL(req.url ?? "/", "http://localhost").pathname !== "/ws") return;
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
  });

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    logger.info({ url: req.url }, "WebSocket connection established");

    let participantId: string | null = null;
    let roomCode: string | null = null;
    let presenceUserId: string | null = null;
    let presenceGuildId: number | null = null;

    const handleMessage = async (data: Buffer) => {
      let message: Record<string, unknown>;
      try {
        message = JSON.parse(data.toString());
        if (!message || typeof message !== "object" || Array.isArray(message)) {
          throw new Error("Expected a message object");
        }
      } catch {
        ws.send(JSON.stringify({ type: "error", message: "Invalid JSON" }));
        return;
      }

      const type = message.type as string;

      if (type === "join_room") {
        if (participantId) {
          ws.send(JSON.stringify({ type: "error", message: "Already joined a room" }));
          return;
        }
        const code = typeof message.code === "string" ? message.code.toUpperCase() : "";
        const name = typeof message.name === "string" ? message.name.trim() : "";

        if (!code || !name || name.length > 100) {
          ws.send(JSON.stringify({ type: "error", message: "code and name required" }));
          return;
        }

        const room = getRoom(code);
        if (!room) {
          ws.send(JSON.stringify({ type: "error", message: "Room not found" }));
          return;
        }

        // ── Password check ────────────────────────────────────────────────────
        if (room.passwordHash) {
          const providedPassword = message.password as string | undefined;
          if (typeof providedPassword !== "string" || !providedPassword) {
            ws.send(JSON.stringify({ type: "error", message: "Password required", code: "PASSWORD_REQUIRED" }));
            return;
          }
          const match = await bcrypt.compare(providedPassword, room.passwordHash);
          if (!match) {
            ws.send(JSON.stringify({ type: "error", message: "Incorrect room password", code: "WRONG_PASSWORD" }));
            return;
          }
        }

        // Only a verified session may claim an account; a supplied user ID
        // or matching display name is not proof of ownership.
        let resolvedClerkUserId: string | null;
        try {
          resolvedClerkUserId = await socketUserId(req, message.token);
        } catch {
          ws.send(JSON.stringify({ type: "error", message: "Please sign in again", code: "AUTH_REQUIRED" }));
          return;
        }
        if (message.clerkUserId && message.clerkUserId !== resolvedClerkUserId) {
          ws.send(JSON.stringify({ type: "error", message: "Please sign in again", code: "AUTH_REQUIRED" }));
          return;
        }

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
              crimson: 20000, gold: 60000, blue: 175000, purple: 450000,
            };
            const minRequired = nameplateMinXp[profileRows[0].activeNameplate] ?? 0;
            userNameplate = userXp >= minRequired ? (profileRows[0].activeNameplate ?? "default") : "default";
          }
        }

        // Grand Scribes (60k+ XP) can join any room as an invisible spectator
        const isGrandScribe = userXp >= 60000;

        const saved = await getWriting(code, name);
        if (saved?.clerkUserId && saved.clerkUserId !== resolvedClerkUserId) {
          ws.send(JSON.stringify({ type: "error", message: "That name belongs to another writer", code: "NAME_IN_USE" }));
          return;
        }
        if (ws.readyState !== WebSocket.OPEN) return;

        // Re-read after awaits so simultaneous joins cannot replace each other
        // using an obsolete participant snapshot.
        const existing = Array.from(room.participants.values()).find((p) => p.name === name);
        const reconnectToken = typeof message.reconnectToken === "string"
          ? message.reconnectToken : undefined;
        if (existing && (existing.clerkUserId
          ? existing.clerkUserId !== resolvedClerkUserId
          : !existing.reconnectToken || existing.reconnectToken !== reconnectToken)) {
          ws.send(JSON.stringify({ type: "error", message: "That name is already in use in this room", code: "NAME_IN_USE" }));
          return;
        }
        const inheritedId = existing?.id ?? null;
        const inheritedIsCreator = existing?.isCreator ?? false;
        // In-memory state is newer than a periodic backup, including intentional
        // deletions and zeroed counts after a restart.
        const restoredWordCount = existing ? existing.wordCount : (saved?.wordCount ?? 0);
        const restoredText = existing ? existing.latestText : (saved?.text ?? "");

        // Grant creator status if: (a) this is a reconnect that already had it,
        // OR (b) the name matches the room's designated creator name.
        // The old "size === 0" gate broke Discord-bot-launched sprints because
        // web participants had already joined by the time the bot connected.
        const isCreator = inheritedIsCreator || name === room.creatorName;

        // Creators and Grand Scribes (25k+ XP) can join as invisible spectators
        const wantsSpectator = message.spectator === true;
        const isSpectator = existing && room.status !== "waiting"
          ? existing.isSpectator
          : wantsSpectator && (isCreator || isGrandScribe);

        // Optional sprint role — anyone can join as an "editor" (visible
        // non-racer). Defaults to "writer". Editors aren't allowed in
        // gladiator (1v1 only) — they'd just sit there.
        const requestedRole = message.role === "editor" ? "editor" : "writer";
        const role: "writer" | "editor" = existing && room.status !== "waiting"
          ? existing.role
          : requestedRole === "editor" && room.mode !== "gladiator" ? "editor" : "writer";

        if (room.mode === "gladiator" && !isSpectator && getActiveParticipants(room).filter((p) => p.id !== existing?.id).length >= 2) {
          ws.send(JSON.stringify({ type: "error", message: "The arena is full", code: "ARENA_FULL" }));
          return;
        }

        // Only claim this connection after every admission check succeeds.
        participantId = inheritedId ?? uuidv4();
        roomCode = code;

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
            role,
          );
        } else {
          participant = {
            id: participantId,
            reconnectToken,
            name,
            wordCount: restoredWordCount,
            wpm: 0,
            lastWordCountTime: Date.now(),
            lastWordCount: restoredWordCount,
            ws,
            isCreator,
            isSpectator,
            role,
            latestText: restoredText,
            clerkUserId: resolvedClerkUserId,
            nameplate: userNameplate,
            xp: userXp,
            kartItems: [],
            kartBonusWords: 0,
            kartCarOffset: 0,
            // Anchor the next-item threshold to where the player ACTUALLY is
            // already — so disconnecting + rejoining (or a full server restart
            // re-creating the participant from scratch) doesn't retroactively
            // grant items they previously earned. Formula: the next 250-multi
            // strictly above their current word count.
            kartNextItemAt: Math.floor(restoredWordCount / 250) * 250 + 250,
            kartBaselineWords: visibleKartWords(restoredText),
            kartArchivedWords: restoredWordCount,
            kartVisibleWords: undefined,
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

        // ── Guild presence: mark this user online in their guild ───────────
        if (resolvedClerkUserId) {
          try {
            const memRows = await db
              .select({ guildId: guildMembersTable.guildId })
              .from(guildMembersTable)
              .where(eq(guildMembersTable.userId, resolvedClerkUserId))
              .limit(1);
            if (memRows[0]) {
              presenceUserId = resolvedClerkUserId;
              presenceGuildId = memRows[0].guildId;
              markOnline(presenceGuildId, presenceUserId);
            }
          } catch (err) {
            logger.warn({ err }, "guild presence lookup failed");
          }
        }

        const currentParticipants = Array.from(room.participants.values())
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
            ...(room.mode === "kart" && { kartCarOffset: p.kartCarOffset, kartBonusWords: p.kartBonusWords }),
          }));

        const bossTotalWords = room.mode === "boss"
          ? currentParticipants.filter((p) => p.role !== "editor").reduce((sum, p) => sum + p.wordCount, 0)
          : null;

        // For kart mode: give the joining participant their current item list so
        // reconnects and late joins restore the inventory correctly.
        const selfParticipant = room.participants.get(participantId);
        const kartItems = room.mode === "kart" ? (selfParticipant?.kartItems ?? []) : undefined;

        ws.send(
          JSON.stringify({
            type: "joined",
            participantId,
            isCreator,
            restoredWordCount: restoredWordCount > 0 ? restoredWordCount : undefined,
            kartItems,
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
              timeLeft:
                room.status === "running" && room.endTime
                  ? Math.max(0, Math.floor((room.endTime - Date.now()) / 1000))
                  : room.status === "finished" ? 0 : null,
              countdownTimeLeft: room.status === "countdown" && room.countdownEndsAt
                ? Math.max(0, Math.ceil((room.countdownEndsAt - Date.now()) / 1000))
                : null,
              participants: currentParticipants,
              creatorXp: room.creatorXp,
              starActiveIds: Array.from(room.activeStars).filter(([, expiry]) => expiry > Date.now()).map(([id]) => id),
            },
          })
        );

        if (room.mode === "kart" && isStarActive(room, participantId)) {
          sendEffect(participant, "star", room.activeStars.get(participantId)! - Date.now());
        }
        if (room.mode === "gladiator" && room.gladiatorMatchStats) {
          const fighters = getActiveParticipants(room);
          if (fighters.length === 2) {
            if (room.status === "finished") {
              const winner = fighters.find((p) => p.id === room.gladiatorMatchStats?.winnerId);
              const loser = fighters.find((p) => p.id !== winner?.id);
              if (room.gladiatorMatchStats.endedByExecution && winner && loser) {
                broadcastGladiatorExecution(room, winner, loser, room.gladiatorMatchStats);
              } else {
                broadcastGladiatorTimerEnd(room, fighters[0], fighters[1], room.gladiatorMatchStats);
              }
            } else {
              broadcastGladiatorState(fighters[0], fighters[1], Math.abs(fighters[0].wordCount - fighters[1].wordCount), room.gladiatorDeathGap ?? 400);
            }
          }
        }

        // Catch the new participant up with everyone's current text in
        // open mode (everyone is visible) AND always send any editor's text
        // (editors are visible by design so writers can see what they're
        // editing/noting in real time).
        const includeEditorTexts = true;
        if (room.mode === "open" || includeEditorTexts) {
          room.participants.forEach((p) => {
            const shouldSend = room.mode === "open" || p.role === "editor";
            if (shouldSend && p.id !== participantId && p.latestText) {
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
      if (!participant || participant.ws !== ws) return;

      // The interval may be delayed by a busy event loop. Its scheduling must
      // never grant extra race time to a late text or item packet.
      if ((type === "text_update" || type === "use_item") && room.status === "running" && room.endTime && Date.now() >= room.endTime) {
        endSprint(room);
        return;
      }

      if (type === "text_update") {
        if (participant.isSpectator) return;
        if (typeof message.text !== "string" ||
          (message.netWordCount !== undefined &&
            (typeof message.netWordCount !== "number" || !Number.isFinite(message.netWordCount)))) {
          ws.send(JSON.stringify({ type: "error", message: "Invalid text update" }));
          return;
        }
        const text = message.text;
        const rawNetWordCount =
          typeof message.netWordCount === "number"
            ? Math.max(0, Math.floor(message.netWordCount))
            : countWords(text);

        // Anti-cheat: cap implausibly large word jumps. A sustained 250 WPM is
        // already world-class; we allow up to 400 WPM in any one update plus a
        // burst tolerance that's GENEROUS for paste-of-pre-typed-buffer
        // scenarios.
        //
        // Previously BURST_TOLERANCE was 30, which meant pasting a paragraph
        // (or even just typing a fast 50-word stretch in a single 100ms text
        // update) got the wordCount silently clamped — and kart-mode item
        // grants are gated on `participant.wordCount >= kartNextItemAt`, so
        // the user wrote past 250 words but the server only credited ~230 and
        // no item appeared. Bumped to 1500 so pasting a normal chapter/scene
        // sails through; sustained cheating still capped by MAX_WPM.
        const MAX_WPM = 400;
        const BURST_TOLERANCE = 1500;
        let netWordCount = rawNetWordCount;
        if (room.status === "running") {
          const elapsedMin = Math.max(
            0,
            (Date.now() - participant.lastWordCountTime) / 60_000,
          );
          const allowedDelta = Math.ceil(elapsedMin * MAX_WPM) + BURST_TOLERANCE;
          const ceiling = participant.lastWordCount + allowedDelta;
          if (rawNetWordCount > ceiling) {
            logger.warn(
              {
                code: roomCode,
                participantId,
                name: participant.name,
                rawNetWordCount,
                ceiling,
                lastWordCount: participant.lastWordCount,
                elapsedMin,
              },
              "Clamped suspicious word-count jump",
            );
            netWordCount = ceiling;
          }
          if (room.mode === "kart" && participant.role !== "editor") {
            const visibleWords = visibleKartWords(text);
            const previousVisible = participant.kartVisibleWords;
            if (previousVisible === undefined) {
              // The first packet can contain a draft written before the race.
              participant.kartBaselineWords = Math.max(participant.kartBaselineWords ?? 0, visibleWords - rawNetWordCount);
            } else if (visibleWords === 0 && previousVisible > 0 && rawNetWordCount >= participant.wordCount) {
              // Chapter Finished clears the editor while keeping race progress.
              participant.kartArchivedWords = (participant.kartArchivedWords ?? 0) + Math.max(0, previousVisible - (participant.kartBaselineWords ?? 0));
              participant.kartBaselineWords = 0;
            }
            participant.kartVisibleWords = visibleWords;
            const contentCeiling = Math.max(0, (participant.kartArchivedWords ?? 0) + visibleWords - (participant.kartBaselineWords ?? 0));
            netWordCount = Math.min(netWordCount, contentCeiling, kartWordCeiling(room.startTime, Date.now()));
          }
        }

        // In open (Spectator) mode, always store + broadcast text so hover-to-read
        // works in waiting / countdown / finished phases too — not just during the
        // active sprint. For other modes, only count words while the sprint runs.
        // Broadcast the text in (a) open mode (everyone can see each other)
        // or (b) when the sender is an editor (their notes are visible to
        // writers by design).
        if (room.mode === "open" || participant.role === "editor") {
          participant.latestText = text;
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

        if (room.status !== "running") return;

        // Detect suspicious resets: participant had significant progress but is
        // now sending 0.  Log a warning so we can diagnose reconnect edge-cases.
        const currentWc = participant.wordCount;
        if (netWordCount === 0 && currentWc > 10) {
          logger.warn(
            { code: roomCode, participantId, name: participant.name, previousWordCount: currentWc },
            "Participant word count reset to 0 — possible reconnect baseline bug"
          );
        }

        // Store latest text for catchup on reconnect / new joins (non-open modes
        // also benefit so reconnect restores in-progress text).
        if (room.mode !== "open") participant.latestText = text;

        // Charge the elapsed time at the previous gap before changing it.
        if (room.mode === "gladiator") advanceGladiatorCombat(room, Date.now(), false);
        updateParticipantStats(room, participantId, netWordCount);

        // Kart mode: item earning + banana trap check.
        // Editors don't race so they neither earn items nor trip traps.
        if (room.mode === "kart" && room.status === "running" && participant.role !== "editor") {
          const { position, total } = getParticipantPosition(room, participantId);

          // Each 250-word box is passed once. A full inventory misses that
          // box; holding the threshold let players cash in old boxes later
          // by sending the same word count again after using an item.
          let kartChanged = false;
          while (participant.wordCount >= participant.kartNextItemAt) {
            participant.kartNextItemAt += 250;
            if (participant.kartItems.length >= 3) continue;
            const item = rollItem(position, total, !room.goldenPenUsed);
            if (item === "golden_pen") room.goldenPenUsed = true;
            participant.kartItems.push(item);
            ws.send(JSON.stringify({ type: "item_earned", item, emoji: ITEM_EMOJIS[item] }));
            kartChanged = true;
          }
          // Authoritative inventory resync — defends against a dropped
          // `item_earned` message silently desyncing the client. With this
          // sync, even if 1+ item_earned messages are lost in transit, the
          // next sync (sent on every grant) brings the client back to the
          // server's truth and items reappear in the slot bar.
          if (kartChanged) {
            ws.send(JSON.stringify({
              type: "kart_inventory",
              items: participant.kartItems.slice(),
            }));
          }

          checkBananaTraps(room, participant, currentWc + participant.kartCarOffset);
        }

        // ── Gladiator mode: process combat ───────────────────────────────────
        if (room.mode === "gladiator" && room.status === "running" && room.gladiatorMatchStats) {
          // currentWc was captured before updateParticipantStats ran — use as prevWordCount
          const result = processGladiatorUpdate(room, participant, netWordCount, currentWc);
          if (result.executed && result.winnerId) {
            const active = getActiveParticipants(room);
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
        if (room.mode !== "kart" || room.status !== "running" || participant.isSpectator || participant.role === "editor") return;
        const item = typeof message.item === "string" ? message.item : "";
        if (!Object.prototype.hasOwnProperty.call(ITEM_EMOJIS, item)) return;
        const rejectItem = (reason: string) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "item_rejected", message: reason }));
            ws.send(JSON.stringify({ type: "kart_inventory", items: participant.kartItems.slice() }));
          }
        };
        const itemIdx = participant.kartItems.indexOf(item);
        if (itemIdx === -1) { rejectItem("That item is no longer in your inventory."); return; }

        const active = getActiveParticipants(room);
        const sorted = [...active].sort((a, b) => kartScore(b) - kartScore(a));
        const senderIdx = sorted.findIndex((p) => p.id === participantId);
        const ahead = senderIdx > 0 ? sorted[senderIdx - 1] : null;
        const availableRivals = sorted.filter(p => p.id !== participantId && p.ws.readyState === WebSocket.OPEN && !isStarActive(room, p.id));
        const hittableAhead = sorted.slice(0, Math.max(0, senderIdx)).filter(p => p.ws.readyState === WebSocket.OPEN && !isStarActive(room, p.id));
        if (item === "red_shell" && hittableAhead.length === 0) {
          rejectItem("No racer ahead can be hit right now."); return;
        }
        if ((item === "green_shell" || item === "blue_shell" || item === "lightning" || item === "banana") && availableRivals.length === 0) {
          rejectItem("No rival can be hit right now."); return;
        }
        if (item === "boo" && (!ahead || ahead.ws.readyState !== WebSocket.OPEN || isStarActive(room, ahead.id) || ahead.kartItems.length === 0)) {
          rejectItem("The racer ahead has no item to steal."); return;
        }
        participant.kartItems.splice(itemIdx, 1);
        const previousPosition = kartScore(participant);

        switch (item) {
          case "red_shell": {
            const targetP = hittableAhead[hittableAhead.length - 1];
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
            const targetP = availableRivals[Math.floor(Math.random() * availableRivals.length)];
            // Persist the offset on the server so it survives the next
            // room_state re-sync — otherwise the client's local -100 gets
            // wiped within ~1s.
            targetP.kartCarOffset -= 100;
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
            room.bananaTraps = room.bananaTraps.filter(trap => trap.placedById !== participantId).slice(-9).concat(room.bananaTraps.filter(trap => trap.placedById === participantId).slice(-2));
            room.bananaTraps.push({ id: trapId, placedById: participantId, placedByName: participant.name, threshold: kartScore(participant) });
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
            const starParticipantId = participant.id;
            setTimeout(() => {
              if (room.activeStars.get(starParticipantId) === expiry) {
                room.activeStars.delete(starParticipantId);
              }
            }, 30000);
            sendEffect(participant, "star", 30000);
            broadcastToRoom(room, {
              type: "item_used", item, emoji: ITEM_EMOJIS[item as keyof typeof ITEM_EMOJIS],
              sourceId: participantId, sourceName: participant.name,
              targetId: participantId, effect: "star", duration: 30000,
            });
            break;
          }
          case "blue_shell": {
            const targetP = availableRivals[0];
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
            for (const p of availableRivals) {
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
            if (!ahead) break;
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
            // Golden pen is a forward boost. It MUST move the car via
            // kartCarOffset — the only field that flows through room_state,
            // client RaceTrack rendering AND the final standings sort. The old
            // code only bumped kartBonusWords, which is read nowhere for
            // position, so the rarest item did nothing. Mirror the (working)
            // mushroom path with a larger amount, and keep the bonus-words
            // counter purely as an end-of-sprint stat.
            participant.kartCarOffset += 400;
            participant.kartBonusWords += 400;
            broadcastToRoom(room, {
              type: "item_used", item, emoji: ITEM_EMOJIS[item as keyof typeof ITEM_EMOJIS],
              sourceId: participantId, sourceName: participant.name,
              targetId: participantId, targetName: participant.name,
              effect: "car_add", amount: 400,
            });
            break;
          }
        }
        // Boosts can cross a trap even without a new word being typed.
        if (kartScore(participant) > previousPosition) checkBananaTraps(room, participant, previousPosition);
        // Authoritative inventory resync after every use_item — covers all
        // cases (mystery_box additions, boo steals, regular uses). Same
        // rationale as the kart-grant sync: never let a dropped message
        // leave the client stuck with a stale items array.
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: "kart_inventory",
            items: participant.kartItems.slice(),
          }));
        }
        // Also resync the player whose item was stolen (boo) so their slot
        // empties on the next render.
        if (item === "boo") {
          const ahead = senderIdx > 0 ? sorted[senderIdx - 1] : null;
          if (ahead && ahead.ws.readyState === WebSocket.OPEN) {
            ahead.ws.send(JSON.stringify({
              type: "kart_inventory",
              items: ahead.kartItems.slice(),
            }));
          }
        }
        return;
      }

      if (type === "send_emote") {
        // Available any time the participant is in the room (waiting, countdown,
        // sprinting, finished) — taunting is fun in the lobby too. Rate-limited.
        const emoteId = String(message.emoteId ?? "");
        const def = EMOTES[emoteId];
        if (!def) return;

        const now = Date.now();
        const last = participant.lastEmoteAt ?? 0;
        if (now - last < EMOTE_COOLDOWN_MS) return;
        participant.lastEmoteAt = now;

        const rawTarget = message.targetId;
        let targetId: string | null = null;
        let targetName: string | null = null;
        if (typeof rawTarget === "string" && rawTarget && rawTarget !== participantId) {
          const target = room.participants.get(rawTarget);
          if (target) {
            targetId = target.id;
            targetName = target.name;
          }
        }

        broadcastToRoom(room, {
          type: "emote",
          id: uuidv4(),
          emoteId,
          emoji: def.emoji,
          label: def.label,
          sourceId: participantId,
          sourceName: participant.name,
          targetId,
          targetName,
          ts: now,
        });
        logger.info(
          { code: roomCode, sourceId: participantId, sourceName: participant.name, emoteId, targetId, recipients: room.participants.size },
          "emote broadcast"
        );
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
        if (room.mode === "gladiator" && getActiveParticipants(room).length !== 2) {
          ws.send(JSON.stringify({ type: "error", message: "Two writers must join before the duel can start." }));
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
        endSprint(room, false);
        return;
      }

      if (type === "restart_sprint") {
        if (!participant.isCreator) {
          ws.send(JSON.stringify({ type: "error", message: "Only the creator can restart the sprint" }));
          return;
        }
        const durationMinutes = message.durationMinutes ?? room.durationMinutes;
        if (typeof durationMinutes !== "number" || !Number.isFinite(durationMinutes) || durationMinutes < 1 || durationMinutes > 180) {
          ws.send(JSON.stringify({ type: "error", message: "Duration must be between 1 and 180 minutes" }));
          return;
        }
        restartSprint(room, durationMinutes);
        return;
      }

      if (type === "ping") {
        ws.send(JSON.stringify({ type: "pong" }));
        return;
      }

      logger.warn({ type }, "Unknown WebSocket message type");
    };

    // EventEmitter does not catch rejected async callbacks. Keep messages in
    // order and contain DB/auth failures so one connection cannot crash the API.
    let pending = Promise.resolve();
    ws.on("message", (data: Buffer) => {
      pending = pending.then(() => {
        if (ws.readyState === WebSocket.OPEN) return handleMessage(data);
        return undefined;
      }).catch((err) => {
        logger.error({ err }, "Failed to handle sprint message");
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "error", message: "Could not process room request. Please retry." }));
        }
      });
    });

    ws.on("close", () => {
      // ── Guild presence: mark offline ────────────────────────────────────
      if (presenceUserId && presenceGuildId !== null) {
        markOffline(presenceGuildId, presenceUserId);
        presenceUserId = null;
        presenceGuildId = null;
      }

      if (!participantId || !roomCode) return;
      const room = getRoom(roomCode);
      if (!room) return;

      // Apply a grace period so a network blip or quick refresh doesn't evict
      // the participant. We cover ALL room states, including "waiting".
      //
      // The previous 30 s active-sprint grace was too short — users on flaky
      // mobile connections or behind aggressive proxies would routinely cross
      // the threshold, and once a participant is removed from `room.participants`
      // the very next `broadcastRoomState` makes their car DISAPPEAR for every
      // other writer until they reconnect. Bumped to 5 minutes so true short
      // outages no longer flicker the field. Permanent leavers still get
      // collected for end-of-sprint chest grants while the room is alive.
      const hasGracePeriod = true;
      const gracePeriodMs = room.status === "waiting" ? 30_000 : 5 * 60_000;

      if (hasGracePeriod) {
        const p = room.participants.get(participantId);
        if (p && p.ws === ws) {
          if (p.disconnectTimer) clearTimeout(p.disconnectTimer);
          p.disconnectTimer = setTimeout(() => {
            const currentRoom = getRoom(roomCode!);
            if (currentRoom?.participants.get(participantId!)?.ws === ws) {
              removeParticipant(currentRoom, participantId!);
              logger.info({ code: roomCode, participantId }, `Participant removed after ${gracePeriodMs / 1000}s grace period`);
            }
          }, gracePeriodMs);
          logger.info({ code: roomCode, participantId, gracePeriodMs }, "Participant disconnected — grace period started");
        }
      }
    });

    ws.on("error", (err) => {
      logger.error({ err }, "WebSocket error");
    });
  });

  return wss;
}
