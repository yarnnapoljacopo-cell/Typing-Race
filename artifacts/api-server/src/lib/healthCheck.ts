import { pool } from "@workspace/db";

const PING_TIMEOUT_MS = 1500;

export interface DeepHealth {
  status: "ok" | "degraded";
  db: { ok: boolean; latencyMs?: number; error?: string };
  pool: { total: number; idle: number; active: number; waiting: number };
}

export async function checkDb(): Promise<DeepHealth["db"]> {
  const start = Date.now();
  try {
    const result = await Promise.race([
      pool.query("SELECT 1"),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("db ping timed out")), PING_TIMEOUT_MS),
      ),
    ]);
    void result;
    return { ok: true, latencyMs: Date.now() - start };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function deepHealth(): Promise<DeepHealth> {
  const db = await checkDb();
  const total = pool.totalCount;
  const idle = pool.idleCount;
  return {
    status: db.ok ? "ok" : "degraded",
    db,
    pool: { total, idle, active: total - idle, waiting: pool.waitingCount },
  };
}
