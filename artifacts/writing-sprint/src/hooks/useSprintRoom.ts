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
  status: "waiting" | "running" | "finished";
  durationMinutes: number;
  timeLeft: number | null;
  participants: Participant[];
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
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

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
          case "joined":
            setParticipantId(data.participantId);
            setRoom(data.room);
            break;
            
          case "room_state":
            setRoom(data.room);
            break;
            
          case "participant_update":
            setRoom((prev) => {
              if (!prev) return prev;
              const participants = prev.participants.map((p) => 
                p.id === data.participant.id ? data.participant : p
              );
              return { ...prev, participants };
            });
            break;
            
          case "sprint_ended":
            setRoom((prev) => {
              if (!prev) return prev;
              return { ...prev, status: "finished", participants: data.results };
            });
            break;
            
          case "error":
            setError(data.message);
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
      reconnectTimeoutRef.current = window.setTimeout(() => {
        connect();
      }, 3000);
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
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  const sendTextUpdate = useCallback((text: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "text_update", text }));
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
    sendTextUpdate,
    startSprint,
    restartSprint,
    endSprint,
  };
}
