import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

type Schema = typeof schema;

let _pool: pg.Pool | undefined;
let _db: NodePgDatabase<Schema> | undefined;

const WARN_HELD_MS = 8_000;
const FORCE_KILL_MS = 20_000;
const SWEEP_INTERVAL_MS = 5_000;

// Watchdog: if the pool shows active connections but zero tracked (meaning
// connections are stuck before PostgreSQL auth completes and acquire never
// fires), the pool is in an unrecoverable zombie state. Exiting lets Railway
// restart the process with a clean pool.
const WATCHDOG_STUCK_MS = 60_000;
let _watchdogStuckSince: number | null = null;

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
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      allowExitOnIdle: false,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10_000,
      query_timeout: 5_000,
      // statement_timeout and idle_in_transaction_session_timeout are set via
      // PostgreSQL GUC startup parameters in the 'options' string. This avoids
      // the double-query race that occurs when using pool.on('connect') to run
      // "SET statement_timeout = N" — that SET query takes 9+ seconds on slow
      // Railway PG connections and corrupts pg-pool's idle-client accounting.
      options:
        "-c statement_timeout=5000 -c idle_in_transaction_session_timeout=10000",
    });

    console.info(
      `[db-pool] initialized max=10 connectionTimeoutMillis=5000 sweepMs=${SWEEP_INTERVAL_MS} watchdogMs=${WATCHDOG_STUCK_MS}`,
    );

    _pool.on("error", (err) => {
      console.error(
        "[db-pool] idle client error — will be replaced:",
        err.message,
      );
    });

    // IMPORTANT: Do NOT run client.query() inside a 'connect' handler.
    // statement_timeout and idle_in_transaction_session_timeout are applied
    // via PostgreSQL startup GUCs in the 'options' string above, which
    // requires zero extra round-trips and cannot race with the first query.

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
      const active = total - idle;

      if (waiting > 0 || active >= 5 || tracked >= 3) {
        console.warn(
          `[db-pool] sweep snapshot total=${total} idle=${idle} active=${active} waiting=${waiting} tracked=${tracked}`,
        );
      }

      // Watchdog: active connections with zero tracked means all connections
      // are stuck before auth completes (zombie state). Force a clean restart.
      if (active >= 5 && tracked === 0) {
        if (_watchdogStuckSince === null) {
          _watchdogStuckSince = now;
          console.error(
            `[db-pool] WATCHDOG: pool zombie state detected (active=${active} tracked=0) — will exit in ${WATCHDOG_STUCK_MS / 1000}s if not resolved`,
          );
        } else {
          const stuckMs = now - _watchdogStuckSince;
          if (stuckMs >= WATCHDOG_STUCK_MS) {
            console.error(
              `[db-pool] WATCHDOG: pool stuck ${Math.round(stuckMs / 1000)}s — exiting for clean restart`,
            );
            process.exit(1);
          }
        }
      } else {
        _watchdogStuckSince = null;
      }

      for (const [client, info] of checkedOut) {
        const heldMs = now - info.acquiredAt;

        if (heldMs > FORCE_KILL_MS) {
          console.error(
            `[db-pool] LEAK client held ${heldMs}ms — force-releasing\n${info.stack}`,
          );
          checkedOut.delete(client);
          try {
            const c = client as unknown as {
              release?: (err?: Error) => void;
            };
            // Do NOT call stream.destroy() before release(). Destroying the
            // socket fires an async error event that causes pg-pool to remove
            // the client from _clients a second time, corrupting pool state.
            // Calling release(err) alone is sufficient — pg-pool will discard
            // the client and create a replacement on the next demand.
            if (typeof c.release === "function") {
              c.release(
                new Error("[db-pool] force-released after held timeout"),
              );
            }
          } catch (e) {
            console.error(
              "[db-pool] force-release failed:",
              (e as Error).message,
            );
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
    return Reflect.apply(
      getPool() as unknown as (...a: unknown[]) => unknown,
      thisArg,
      args,
    );
  },
});

export const db: NodePgDatabase<Schema> = new Proxy(
  {} as NodePgDatabase<Schema>,
  {
    get(_target, prop) {
      return (getDb() as unknown as Record<string | symbol, unknown>)[prop];
    },
  },
);

export * from "./schema";
