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
      max: 50,
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

    // Long-held-connection detector + forced-release watchdog.
    //
    // The most common cause of pool exhaustion is a route handler that awaits
    // something slow (a helper that itself acquires a client, an external HTTP
    // call, etc.) while still holding its own client. The WARN timer at 5 s
    // logs a stack trace so we can spot the leak in code review.
    //
    // The KILL timer at 25 s force-destroys the underlying connection if it
    // is still checked out. pg-pool treats a destroyed client as dead and
    // creates a fresh one on the next acquire — so even if a handler somewhere
    // forgets to release (or hangs forever on an external call), the pool
    // self-heals within 25 s instead of staying permanently saturated until
    // the process is restarted. This is what allowed our previous outages
    // ("high pressure" for hours) to keep happening: once a slot was lost,
    // it never came back. With this watchdog, the worst case is a 25 s
    // disruption, not an indefinite outage.
    const WARN_HELD_MS  = 5_000;
    const FORCE_KILL_MS = 25_000;
    type HeldEntry = { warnTimer: NodeJS.Timeout; killTimer: NodeJS.Timeout };
    const heldTimers = new WeakMap<object, HeldEntry>();
    _pool.on("acquire", (client) => {
      const acquiredAt = Date.now();
      const stack = new Error("acquired here").stack?.split("\n").slice(2, 8).join("\n");
      const warnTimer = setTimeout(() => {
        console.warn(
          `[db-pool] client held > ${WARN_HELD_MS}ms — possible leak or slow handler`,
          { heldMs: Date.now() - acquiredAt, stack },
        );
      }, WARN_HELD_MS);
      warnTimer.unref?.();
      const killTimer = setTimeout(() => {
        console.error(
          `[db-pool] client held > ${FORCE_KILL_MS}ms — force-destroying to free pool slot`,
          { heldMs: Date.now() - acquiredAt, stack },
        );
        // Destroy the underlying connection. Passing an Error to release tells
        // pg-pool to discard this client rather than return it to the idle
        // bucket, so the slot is freed and the next acquire gets a fresh one.
        try {
          const c = client as unknown as {
            release?: (err?: Error) => void;
            connection?: { stream?: { destroy?: () => void } };
          };
          if (typeof c.release === "function") {
            c.release(new Error("[db-pool] force-released after 25s held timeout"));
          } else {
            c.connection?.stream?.destroy?.();
          }
        } catch (e) {
          console.error("[db-pool] force-release failed:", (e as Error).message);
        }
      }, FORCE_KILL_MS);
      killTimer.unref?.();
      heldTimers.set(client, { warnTimer, killTimer });
    });
    _pool.on("release", (_err, client) => {
      const t = heldTimers.get(client);
      if (t) {
        clearTimeout(t.warnTimer);
        clearTimeout(t.killTimer);
        heldTimers.delete(client);
      }
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
