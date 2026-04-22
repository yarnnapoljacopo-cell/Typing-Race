import { useState, useEffect, useRef, useCallback } from "react";

export interface Participant {
  id: string;
  name: string;
  wordCount: number;
  wpm: number;
  isCreator: boolean;
}

export interface RoomState {
  code: string;
  status: "waiting" | "countdown" | "running" | "finished";
  durationMinutes: number;
  countdownDelayMinutes: number;
  mode: "regular" | "open" | "goal" | "boss";
  wordGoal: number | null;
  bossWordGoal: number | null;
  bossTotalWords: number | null;
  deathModeWpm: number | null;
  timeLeft: number | null;
  countdownTimeLeft: number | null;
  participants: Participant[];
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
}

const ROOM_STATE_DEFAULTS = {
  mode: "regular" as const,
  countdownDelayMinutes: 0,
  countdownTimeLeft: null,
  wordGoal: null,
  bossWordGoal: null,
  bossTotalWords: null,
  deathModeWpm: null,
};

// Exponential backoff: 500ms, 1s, 2s, 4s, 8s, capped at 10s
function nextDelay(attempt: number): number {
  return Math.min(500 * Math.pow(2, attempt), 10_000);
}

// How long to keep retrying "Room not found" — covers server restart window
const ROOM_NOT_FOUND_RETRY_MS = 90_000;

export function useSprintRoom({ code, name }: UseSprintRoomProps) {
  const [room, setRoom] = useState<RoomState | null>(null);
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [restoredWordCount, setRestoredWordCount] = useState<number | null>(null);
  const [participantTexts, setParticipantTexts] = useState<Record<string, ParticipantText>>({});

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const latestTextRef = useRef<string>("");
  const latestNetWordCountRef = useRef<number>(0);
  const hasJoinedRef = useRef(false);
  const reconnectAttemptRef = useRef(0);
  // Tracks when we first lost connection (for the "Room not found" retry window)
  const disconnectedAtRef = useRef<number | null>(null);
  const unmountedRef = useRef(false);

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
      ws.send(JSON.stringify({ type: "join_room", code, name }));
    };

    ws.onmessage = (event) => {
      if (unmountedRef.current) return;
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
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "ping" }));
      }
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
  };
}
