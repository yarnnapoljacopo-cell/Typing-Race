import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

type Schema = typeof schema;

let _pool: pg.Pool | undefined;
let _db: NodePgDatabase<Schema> | undefined;

const WARN_HELD_MS = 5_000;
const FORCE_KILL_MS = 8_000;
const SWEEP_INTERVAL_MS = 2_000;

const checkedOut = new Map<
  object,
  { acquiredAt: number; warned: boolean; stack: string }
>();

function getPool(): pg.Pool {
  if (!_pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error(
        "DATABASE_URL must be set. Did you forget to provision a database?",
      );
    }
    _pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 30,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 2_000,
      allowExitOnIdle: false,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10_000,
      query_timeout: 3_000,
      statement_timeout: 3_000,
      options: "-c idle_in_transaction_session_timeout=10000",
    });

    _pool.on("error", (err) => {
      console.error("[db-pool] idle client error — will be replaced:", err.message);
    });

    _pool.on("connect", (client) => {
      client.query("SET statement_timeout = 3000").catch((err: Error) => {
        console.error("[db-pool] could not set statement_timeout:", err.message);
      });
    });

    _pool.on("acquire", (client) => {
      const stack =
        new Error("acquired here").stack?.split("\n").slice(2, 8).join("\n") ??
        "(no stack)";
      checkedOut.set(client, { acquiredAt: Date.now(), warned: false, stack });
    });

    _pool.on("release", (_err, client) => {
      checkedOut.delete(client);
    });

    const sweepRef = setInterval(() => {
      const now = Date.now();
      const p = _pool!;
      const total = p.totalCount;
      const idle = p.idleCount;
      const waiting = p.waitingCount;
      const tracked = checkedOut.size;
      // When under any pressure, log the snapshot so we can correlate with
      // the held-stack warnings below in the next outage report.
      if (waiting > 0 || (total - idle) >= 20 || tracked >= 20) {
        console.warn(
          `[db-pool] sweep snapshot total=${total} idle=${idle} active=${total - idle} waiting=${waiting} tracked=${tracked}`,
        );
      }

      for (const [client, info] of checkedOut) {
        const heldMs = now - info.acquiredAt;

        if (heldMs > FORCE_KILL_MS) {
          console.error(
            `[db-pool] LEAK client held ${heldMs}ms — force-destroying\n${info.stack}`,
          );
          checkedOut.delete(client);
          try {
            const c = client as unknown as {
              release?: (err?: Error) => void;
              connection?: { stream?: { destroy?: () => void } };
            };
            c.connection?.stream?.destroy?.();
            if (typeof c.release === "function") {
              c.release(new Error("[db-pool] force-killed after held timeout"));
            }
          } catch (e) {
            console.error("[db-pool] force-destroy failed:", (e as Error).message);
          }
        } else if (heldMs > WARN_HELD_MS && !info.warned) {
          info.warned = true;
          console.warn(
            `[db-pool] WARN client held ${heldMs}ms — possible leak\n${info.stack}`,
          );
        }
      }
    }, SWEEP_INTERVAL_MS);
    sweepRef.unref();
  }
  return _pool;
}

function getDb(): NodePgDatabase<Schema> {
  if (!_db) {
    _db = drizzle(getPool(), { schema });
  }
  return _db;
}

export const pool: pg.Pool = new Proxy({} as pg.Pool, {
  get(_target, prop) {
    return (getPool() as unknown as Record<string | symbol, unknown>)[prop];
  },
  apply(_target, thisArg, args) {
    return Reflect.apply(getPool() as unknown as (...a: unknown[]) => unknown, thisArg, args);
  },
});

export const db: NodePgDatabase<Schema> = new Proxy({} as NodePgDatabase<Schema>, {
  get(_target, prop) {
    return (getDb() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export * from "./schema";
