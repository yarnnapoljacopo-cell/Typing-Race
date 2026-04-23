import { useState, useEffect, useRef, useCallback } from "react";
import type { KartFlashEvent } from "@/components/KartHUD";

export interface Participant {
  id: string;
  name: string;
  wordCount: number;
  wpm: number;
  isCreator: boolean;
  kartBonusWords?: number;
  kartCarOffset?: number;
  nameplate?: string;
  xp?: number;
}

export interface RoomState {
  code: string;
  status: "waiting" | "countdown" | "running" | "finished";
  durationMinutes: number;
  countdownDelayMinutes: number;
  mode: "regular" | "open" | "goal" | "boss" | "kart" | "gladiator";
  wordGoal: number | null;
  bossWordGoal: number | null;
  bossTotalWords: number | null;
  deathModeWpm: number | null;
  gladiatorDeathGap: number | null;
  timeLeft: number | null;
  countdownTimeLeft: number | null;
  participants: Participant[];
  creatorXp: number;
}

export interface GladiatorResult {
  outcome: "victory" | "defeat" | "draw";
  myHp: number;
  opponentHp: number;
  myWordCount: number;
  opponentWordCount: number;
  stats: {
    closestGap: number;
    maxGap: number;
    leadChanges: number;
    timeInDangerMs: number;
    endedByExecution: boolean;
    totalHpHealed: Record<string, number>;
  };
}

export interface GladiatorState {
  myHp: number;
  opponentHp: number;
  myWordCount: number;
  opponentWordCount: number;
  gap: number;
  iAhead: boolean;
  deathGap: number;
  myBuffs: string[];
  opponentBuffs: string[];
  executionResult: GladiatorResult | null;
}

export interface KartState {
  items: string[];
  bonusWords: number;
  carOffsets: Record<string, number>;
  blurCounter: boolean;
  boldText: boolean;
  starActive: boolean;
  starActiveIds: string[];
  flashEvent: KartFlashEvent | null;
}

export interface ParticipantText {
  participantId: string;
  name: string;
  text: string;
  wordCount: number;
}

interface UseSprintRoomProps {
  code: string;
  name: string;
  isCreator?: boolean;
  password?: string | null;
  clerkUserId?: string | null;
}

const ROOM_STATE_DEFAULTS = {
  mode: "regular" as const,
  countdownDelayMinutes: 0,
  countdownTimeLeft: null,
  wordGoal: null,
  bossWordGoal: null,
  bossTotalWords: null,
  deathModeWpm: null,
  gladiatorDeathGap: null,
  creatorXp: 0,
};

// Exponential backoff: 500ms, 1s, 2s, 4s, 8s, capped at 10s
function nextDelay(attempt: number): number {
  return Math.min(500 * Math.pow(2, attempt), 10_000);
}

// How long to keep retrying "Room not found" — covers server restart window
const ROOM_NOT_FOUND_RETRY_MS = 90_000;

export function useSprintRoom({ code, name, password, clerkUserId }: UseSprintRoomProps) {
  const [room, setRoom] = useState<RoomState | null>(null);
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [restoredWordCount, setRestoredWordCount] = useState<number | null>(null);
  const [participantTexts, setParticipantTexts] = useState<Record<string, ParticipantText>>({});

  // Kart state
  const [kartState, setKartState] = useState<KartState>({
    items: [],
    bonusWords: 0,
    carOffsets: {},
    blurCounter: false,
    boldText: false,
    starActive: false,
    starActiveIds: [],
    flashEvent: null,
  });
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const starTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [gladiatorState, setGladiatorState] = useState<GladiatorState>({
    myHp: 1000,
    opponentHp: 1000,
    myWordCount: 0,
    opponentWordCount: 0,
    gap: 0,
    iAhead: false,
    deathGap: 400,
    myBuffs: [],
    opponentBuffs: [],
    executionResult: null,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const latestTextRef = useRef<string>("");
  const latestNetWordCountRef = useRef<number>(0);
  const hasJoinedRef = useRef(false);
  const reconnectAttemptRef = useRef(0);
  // Tracks when we first lost connection (for the "Room not found" retry window)
  const disconnectedAtRef = useRef<number | null>(null);
  const unmountedRef = useRef(false);
  // Zombie-connection detection: track when we last received ANY WS message
  const lastMessageAtRef = useRef<number>(Date.now());
  // When the most recent ping was sent — used to detect pong timeouts
  const lastPingSentAtRef = useRef<number>(0);

  const connect = useCallback(() => {
    if (!code || !name || unmountedRef.current) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      if (unmountedRef.current) { ws.close(); return; }
      setIsConnected(true);
      setIsReconnecting(false);
      setError(null);
      reconnectAttemptRef.current = 0;
      const joinMsg: Record<string, unknown> = { type: "join_room", code, name };
      if (password) joinMsg.password = password;
      if (clerkUserId) joinMsg.clerkUserId = clerkUserId;
      ws.send(JSON.stringify(joinMsg));
    };

    ws.onmessage = (event) => {
      if (unmountedRef.current) return;
      lastMessageAtRef.current = Date.now();
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case "joined": {
            const isReconnect = hasJoinedRef.current;
            disconnectedAtRef.current = null;
            setParticipantId(data.participantId);
            setRoom({ ...ROOM_STATE_DEFAULTS, ...data.room, participants: data.room.participants ?? [] });
            if (isReconnect && latestTextRef.current) {
              ws.send(JSON.stringify({
                type: "text_update",
                text: latestTextRef.current,
                netWordCount: latestNetWordCountRef.current,
              }));
            }
            hasJoinedRef.current = true;
            if (!isReconnect && typeof data.restoredWordCount === "number" && data.restoredWordCount > 0) {
              setRestoredWordCount(data.restoredWordCount);
            }
            break;
          }

          case "room_state":
            setRoom({ ...ROOM_STATE_DEFAULTS, ...data.room, participants: data.room.participants ?? [] });
            break;

          case "participant_update":
            setRoom((prev) => {
              if (!prev) return prev;
              const exists = prev.participants.some((p) => p.id === data.participant.id);
              const participants = exists
                ? prev.participants.map((p) => p.id === data.participant.id ? data.participant : p)
                : [...prev.participants, data.participant];
              return { ...prev, participants };
            });
            break;

          case "participant_text":
            setParticipantTexts((prev) => ({
              ...prev,
              [data.participantId]: {
                participantId: data.participantId,
                name: data.name,
                text: data.text,
                wordCount: data.wordCount,
              },
            }));
            break;

          case "sprint_ended":
            setRoom((prev) => {
              if (!prev) return prev;
              return { ...prev, status: "finished", participants: data.results };
            });
            break;

          case "error": {
            const isRoomNotFound = data.message === "Room not found";
            const elapsed = disconnectedAtRef.current
              ? Date.now() - disconnectedAtRef.current
              : 0;

            // During a server restart the room re-hydrates from DB — keep retrying
            // for up to ROOM_NOT_FOUND_RETRY_MS before giving up.
            if (isRoomNotFound && hasJoinedRef.current && elapsed < ROOM_NOT_FOUND_RETRY_MS) {
              // Don't surface the error yet; just let onclose schedule a retry
              ws.close();
              return;
            }

            setError(data.message);
            if (isRoomNotFound || data.message === "Sprint already finished") {
              hasJoinedRef.current = false;
              ws.close();
            }
            break;
          }

          case "item_earned": {
            setKartState((prev) => ({
              ...prev,
              items: [...prev.items, data.item as string].slice(0, 3),
            }));
            break;
          }

          case "item_used": {
            const effect = data.effect as string;
            const amount = (data.amount as number) ?? 0;
            const targetId = data.targetId as string | undefined;
            const targetIds = data.targetIds as string[] | undefined;

            if (effect === "car_subtract") {
              setKartState((prev) => {
                const next = { ...prev.carOffsets };
                if (targetId) next[targetId] = (next[targetId] ?? 0) - amount;
                if (targetIds) targetIds.forEach((id) => { next[id] = (next[id] ?? 0) - amount; });
                return { ...prev, carOffsets: next };
              });
            } else if (effect === "car_add" && targetId) {
              setKartState((prev) => ({
                ...prev,
                carOffsets: { ...prev.carOffsets, [targetId]: (prev.carOffsets[targetId] ?? 0) + amount },
              }));
            } else if (effect === "star" && targetId) {
              const starDuration = (data.duration as number) ?? 30000;
              setKartState((prev) => ({
                ...prev,
                starActiveIds: [...prev.starActiveIds.filter((id) => id !== targetId), targetId],
              }));
              setTimeout(() => {
                setKartState((prev) => ({
                  ...prev,
                  starActiveIds: prev.starActiveIds.filter((id) => id !== targetId),
                }));
              }, starDuration);
            }

            // Flash notification
            const itemEmoji = (data.emoji as string) ?? "🎮";
            const sourceName = (data.sourceName as string) ?? "Someone";
            const targetName = (data.targetName as string) ?? "";
            const flashMsg = targetName
              ? `${sourceName} hit ${targetName}!`
              : `${sourceName} used an item!`;
            const flashEvent: KartFlashEvent = {
              emoji: itemEmoji,
              label: data.item as string,
              message: flashMsg,
              color: "#a855f7",
            };
            if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
            setKartState((prev) => ({ ...prev, flashEvent }));
            flashTimerRef.current = setTimeout(() => {
              setKartState((prev) => ({ ...prev, flashEvent: null }));
            }, 3000);
            break;
          }

          case "item_effect_start": {
            const effect = data.effect as string;
            const duration = (data.duration as number) ?? 5000;
            const amount = (data.amount as number) ?? 0;
            if (effect === "blur_counter") {
              if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
              setKartState((prev) => ({ ...prev, blurCounter: true }));
              blurTimerRef.current = setTimeout(() => {
                setKartState((prev) => ({ ...prev, blurCounter: false }));
              }, duration);
            } else if (effect === "bold_text") {
              if (boldTimerRef.current) clearTimeout(boldTimerRef.current);
              setKartState((prev) => ({ ...prev, boldText: true }));
              boldTimerRef.current = setTimeout(() => {
                setKartState((prev) => ({ ...prev, boldText: false }));
              }, duration);
            } else if (effect === "star") {
              if (starTimerRef.current) clearTimeout(starTimerRef.current);
              setKartState((prev) => ({ ...prev, starActive: true }));
              starTimerRef.current = setTimeout(() => {
                setKartState((prev) => ({ ...prev, starActive: false }));
              }, duration);
            } else if (effect === "bonus_words") {
              setKartState((prev) => ({ ...prev, bonusWords: prev.bonusWords + amount }));
            }
            break;
          }

          case "gladiator_state": {
            setGladiatorState((prev) => ({
              ...prev,
              myHp: (data.myHp as number) ?? prev.myHp,
              opponentHp: (data.opponentHp as number) ?? prev.opponentHp,
              myWordCount: (data.myWordCount as number) ?? prev.myWordCount,
              opponentWordCount: (data.opponentWordCount as number) ?? prev.opponentWordCount,
              gap: (data.gap as number) ?? prev.gap,
              iAhead: (data.iAhead as boolean) ?? prev.iAhead,
              deathGap: (data.deathGap as number) ?? prev.deathGap,
              myBuffs: (data.myBuffs as string[]) ?? prev.myBuffs,
              opponentBuffs: (data.opponentBuffs as string[]) ?? prev.opponentBuffs,
            }));
            break;
          }

          case "gladiator_execution": {
            const result: GladiatorResult = {
              outcome: data.outcome as "victory" | "defeat" | "draw",
              myHp: data.myHp as number,
              opponentHp: data.opponentHp as number,
              myWordCount: data.myWordCount as number,
              opponentWordCount: data.opponentWordCount as number,
              stats: data.stats as GladiatorResult["stats"],
            };
            setGladiatorState((prev) => ({ ...prev, executionResult: result }));
            break;
          }

          case "gladiator_buff":
            // Individual buff events — already handled by gladiator_state state diffs
            break;

          case "pong":
            break;
        }
      } catch (err) {
        console.error("Failed to parse websocket message", err);
      }
    };

    ws.onclose = () => {
      if (unmountedRef.current) return;
      setIsConnected(false);

      if (hasJoinedRef.current) {
        if (disconnectedAtRef.current === null) {
          disconnectedAtRef.current = Date.now();
        }
        setIsReconnecting(true);
        const delay = nextDelay(reconnectAttemptRef.current);
        reconnectAttemptRef.current += 1;
        reconnectTimeoutRef.current = window.setTimeout(() => {
          connect();
        }, delay);
      }
    };

    ws.onerror = () => {
      setIsConnected(false);
    };
  }, [code, name]);

  useEffect(() => {
    unmountedRef.current = false;
    connect();

    const pingInterval = setInterval(() => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;

      // Zombie-connection detection: if we sent a ping previously and haven't
      // received ANY message since then, the connection is a dead-send — pings
      // go out but nothing comes back. Force-close so onclose fires and the
      // exponential-backoff reconnect logic kicks in.
      if (
        lastPingSentAtRef.current > 0 &&
        lastMessageAtRef.current < lastPingSentAtRef.current
      ) {
        ws.close();
        return;
      }

      lastPingSentAtRef.current = Date.now();
      ws.send(JSON.stringify({ type: "ping" }));
    }, 15000);

    return () => {
      unmountedRef.current = true;
      clearInterval(pingInterval);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connect]);

  const setLatestText = useCallback((text: string, netWordCount?: number) => {
    latestTextRef.current = text;
    if (netWordCount !== undefined) latestNetWordCountRef.current = netWordCount;
  }, []);

  const updateLocalWordCount = useCallback((participantId: string, wordCount: number) => {
    setRoom((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        participants: prev.participants.map((p) =>
          p.id === participantId ? { ...p, wordCount } : p
        ),
      };
    });
  }, []);

  const sendTextUpdate = useCallback((text: string, netWordCount: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "text_update", text, netWordCount }));
    }
  }, []);

  const startSprint = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "start_sprint" }));
    }
  }, []);

  const restartSprint = useCallback((durationMinutes: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "restart_sprint", durationMinutes }));
    }
  }, []);

  const endSprint = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "end_sprint" }));
    }
  }, []);

  const sendUseItem = useCallback((item: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      setKartState((prev) => {
        const idx = prev.items.indexOf(item);
        if (idx === -1) return prev;
        const items = [...prev.items];
        items.splice(idx, 1);
        return { ...prev, items };
      });
      wsRef.current.send(JSON.stringify({ type: "use_item", item }));
    }
  }, []);

  return {
    room,
    participantId,
    isConnected,
    isReconnecting,
    error,
    participantTexts,
    restoredWordCount,
    setLatestText,
    sendTextUpdate,
    updateLocalWordCount,
    startSprint,
    restartSprint,
    endSprint,
    kartState,
    sendUseItem,
    gladiatorState,
  };
}
