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
  mode: "regular" | "open" | "goal";
  wordGoal: number | null;
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

export function useSprintRoom({ code, name, isCreator = false }: UseSprintRoomProps) {
  const [room, setRoom] = useState<RoomState | null>(null);
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [restoredWordCount, setRestoredWordCount] = useState<number | null>(null);
  // Live map of writer texts received by spectators
  const [participantTexts, setParticipantTexts] = useState<Record<string, ParticipantText>>({});

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  // Track the latest text so we can resend it after reconnect
  const latestTextRef = useRef<string>("");
  const latestNetWordCountRef = useRef<number>(0);
  // Whether we've joined at least once (i.e., future opens are reconnects)
  const hasJoinedRef = useRef(false);

  const connect = useCallback(() => {
    if (!code || !name) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      setError(null);
      ws.send(JSON.stringify({ type: "join_room", code, name }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case "joined": {
            const isReconnect = hasJoinedRef.current;
            setParticipantId(data.participantId);
            setRoom({ mode: "regular", countdownDelayMinutes: 0, countdownTimeLeft: null, wordGoal: null, deathModeWpm: null, ...data.room, participants: data.room.participants ?? [] });
            // On reconnect, resend the latest text so the server has current count
            if (isReconnect && latestTextRef.current) {
              ws.send(JSON.stringify({
                type: "text_update",
                text: latestTextRef.current,
                netWordCount: latestNetWordCountRef.current,
              }));
            }
            hasJoinedRef.current = true;
            // Only show "progress restored" toast on first page load — not on
            // mid-sprint reconnects (would be noisy and interrupt writing)
            if (!isReconnect && typeof data.restoredWordCount === "number" && data.restoredWordCount > 0) {
              setRestoredWordCount(data.restoredWordCount);
            }
            break;
          }

          case "room_state":
            setRoom({ mode: "regular", countdownDelayMinutes: 0, countdownTimeLeft: null, wordGoal: null, deathModeWpm: null, ...data.room, participants: data.room.participants ?? [] });
            break;

          case "participant_update":
            setRoom((prev) => {
              if (!prev) return prev;
              const exists = prev.participants.some((p) => p.id === data.participant.id);
              const participants = exists
                ? prev.participants.map((p) =>
                    p.id === data.participant.id ? data.participant : p
                  )
                : [...prev.participants, data.participant];
              return { ...prev, participants };
            });
            break;

          case "participant_text":
            // Spectators receive live text from writers
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

          case "error":
            setError(data.message);
            // For fatal room errors, stop the reconnect loop
            if (
              data.message === "Room not found" ||
              data.message === "Sprint already finished"
            ) {
              hasJoinedRef.current = false;
              ws.close();
            }
            break;

          case "pong":
            break;
        }
      } catch (err) {
        console.error("Failed to parse websocket message", err);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      // Only retry if we previously joined (not on a fatal error)
      if (hasJoinedRef.current) {
        reconnectTimeoutRef.current = window.setTimeout(() => {
          connect();
        }, 500);
      }
    };

    ws.onerror = () => {
      setIsConnected(false);
    };
  }, [code, name]);

  useEffect(() => {
    connect();

    const pingInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "ping" }));
      }
    }, 15000);

    return () => {
      clearInterval(pingInterval);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connect]);

  // Called by Room.tsx on every text change to keep the ref current
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
