const BASE = process.env.API_BASE_URL?.replace(/\/$/, "") ?? "";

export interface RoomCreated {
  code: string;
  creatorName: string;
  durationMinutes: number;
  status: string;
  participantCount: number;
}

export interface RoomInfo {
  code: string;
  creatorName: string;
  durationMinutes: number;
  status: string;
  participantCount: number;
}

export async function createRoom(opts: {
  durationMinutes: number;
  mode: "regular" | "open" | "goal";
  countdownDelayMinutes?: number;
  wordGoal?: number;
}): Promise<RoomCreated> {
  const res = await fetch(`${BASE}/api/rooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      creatorName: "DiscordBot",
      durationMinutes: opts.durationMinutes,
      mode: opts.mode,
      countdownDelayMinutes: opts.countdownDelayMinutes ?? 0,
      wordGoal: opts.wordGoal ?? null,
    }),
  });
  if (!res.ok) throw new Error(`createRoom failed: ${res.status}`);
  return res.json() as Promise<RoomCreated>;
}

export async function getRoom(code: string): Promise<RoomInfo | null> {
  const res = await fetch(`${BASE}/api/rooms/${code}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`getRoom failed: ${res.status}`);
  return res.json() as Promise<RoomInfo>;
}
