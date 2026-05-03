import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

type Schema = typeof schema;

let _pool: pg.Pool | undefined;
let _db: NodePgDatabase<Schema> | undefined;

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
      connectionTimeoutMillis: 10_000,
      allowExitOnIdle: false,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10_000,
      // Fail fast: any single query that takes longer than 3 s is cancelled
      // by the driver (query_timeout) and by Postgres itself
      // (statement_timeout). Either way, the pool slot is released
      // immediately instead of being held until the 10 s pool-acquire
      // timeout elapses for waiting callers.
      query_timeout: 3_000,
      statement_timeout: 3_000,
      // Server-side safety net: if a client hands out a client, BEGINs a
      // transaction, then never COMMITs/ROLLBACKs (e.g. an uncaught throw
      // before the finally{} release fires), Postgres will idle-kill the
      // session after 10 s. Without this, a leaked transaction holds its
      // pool slot AND its row locks forever.
      options: "-c idle_in_transaction_session_timeout=10000",
    });

    // Swallow idle-client errors — pg-pool removes the dead client and creates
    // a fresh one on the next acquire, so the pool self-heals.
    _pool.on("error", (err) => {
      console.error("[db-pool] idle client error — will be replaced:", err.message);
    });

    // Belt-and-braces: set statement_timeout on every new connection so even
    // a `client.query` that bypasses node-pg's query_timeout still has a
    // server-side cancel after 3 s.
    _pool.on("connect", (client) => {
      client.query("SET statement_timeout = 3000").catch((err) => {
        console.error("[db-pool] could not set statement_timeout:", err.message);
      });
    });

    // Long-held-connection detector. The most common cause of pool exhaustion
    // is a route handler that awaits something slow (a helper that itself
    // acquires a client, an external HTTP call, etc.) while still holding
    // its own client. This timer surfaces those spots BEFORE the pool runs
    // out, so we can fix them. Implemented via the pool's "acquire" event so
    // we don't have to monkey-patch connect() (which has multiple call signs).
    const HELD_TOO_LONG_MS = 5_000;
    const heldTimers = new WeakMap<object, NodeJS.Timeout>();
    _pool.on("acquire", (client) => {
      const acquiredAt = Date.now();
      const stack = new Error("acquired here").stack?.split("\n").slice(2, 6).join("\n");
      const timer = setTimeout(() => {
        console.warn(
          `[db-pool] client held > ${HELD_TOO_LONG_MS}ms — possible leak or slow handler`,
          { heldMs: Date.now() - acquiredAt, stack },
        );
      }, HELD_TOO_LONG_MS);
      timer.unref?.(); // don't hold the event loop
      heldTimers.set(client, timer);
    });
    _pool.on("release", (_err, client) => {
      const t = heldTimers.get(client);
      if (t) { clearTimeout(t); heldTimers.delete(client); }
    });
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
