import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

type Schema = typeof schema;

// Auth-phase socket timeout: pg-pool's connectionTimeoutMillis calls
// stream.destroy() WITHOUT an error when its 5 s window expires. On Railway,
// destroy()-without-error fires the socket 'close' event but NOT 'error'.
// pg routes 'close' → Connection 'end' → connect callback, but when the PG
// process is hung mid-auth, Railway's TCP layer holds the socket in CLOSE_WAIT
// / FIN_WAIT for *minutes* before 'close' fires. During that window the client
// is stuck in pool._clients (total↑) but acquire never fires (tracked=0) —
// the zombie pattern observed as +1 per xpDecay scan.
//
// destroy(new Error(...)) WITH an error fires the socket 'error' event
// immediately. pg propagates 'error' directly to the connect callback without
// waiting for TCP teardown, so newClient() calls _clients.filter() (total--)
// right away. No zombie.
//
// 4 s < connectionTimeoutMillis=5 s so this fires first and wins the race.
// The timeout is cleared in pool.on('connect') once auth completes, so
// long-running queries are never affected.
//
// This is NOT the same as running SET queries in a connect hook (the original
// root cause). There is no DB round-trip here — pure socket configuration.
class AuthTimeoutClient extends pg.Client {
  // pg.Client.connect() is overloaded; spread args + any return avoids TS
  // overload-compatibility errors while preserving runtime behaviour.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  override connect(...args: any[]): any {
    const result = (super.connect as (...a: any[]) => any)(...args);
    // this.connection is created synchronously inside super.connect() so it
    // is accessible immediately on the next line.
    const stream = (
      this as unknown as {
        connection?: {
          stream?: {
            setTimeout(ms: number, fn?: () => void): void;
            destroy(err?: Error): void;
          };
        };
      }
    ).connection?.stream;
    if (stream && typeof stream.setTimeout === "function") {
      stream.setTimeout(4_000, () => {
        stream.destroy(new Error("[db-pool] auth-phase socket timeout"));
      });
    }
    return result;
  }
}

let _pool: pg.Pool | undefined;
let _db: NodePgDatabase<Schema> | undefined;

const WARN_HELD_MS = 8_000;
const FORCE_KILL_MS = 20_000;
const SWEEP_INTERVAL_MS = 5_000;

// Watchdog: detects zombie connections (stuck before PostgreSQL auth completes,
// so acquire never fires and tracked stays 0 while active is near-full).
// Threshold is set high (8 out of max=10) to avoid false-positives during
// normal startup bursts where a few connections are transiently pre-acquire.
// Only exits after 2 consecutive minutes in this state.
const WATCHDOG_ACTIVE_THRESHOLD = 8;
const WATCHDOG_STUCK_MS = 120_000;
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
      // AuthTimeoutClient instruments each new connection with a 4 s socket
      // timeout that calls stream.destroy(err) — see class comment above.
      Client: AuthTimeoutClient as unknown as typeof pg.Client,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      allowExitOnIdle: false,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10_000,
      // Client-side query timeout — aborts any query running longer than 5s
      // without requiring a server-side SET statement_timeout round-trip.
      // Do NOT add pool.on('connect') to run SET queries: that was the
      // original root cause (9-second SET query filling the pool with
      // frozen connections before the acquire event ever fired).
      query_timeout: 5_000,
    });

    console.info(
      `[db-pool] initialized max=10 connectionTimeoutMillis=5000 idleTimeoutMillis=30000 authSocketTimeout=4000 sweep=${SWEEP_INTERVAL_MS}ms watchdog=${WATCHDOG_STUCK_MS}ms@${WATCHDOG_ACTIVE_THRESHOLD}`,
    );

    _pool.on("error", (err) => {
      console.error(
        "[db-pool] idle client error — will be replaced:",
        err.message,
      );
    });

    // Auth completed — clear the 4 s pre-auth socket timeout so normal
    // queries are not affected. pool.on('connect') fires inside
    // _acquireClient() which is called after client.connect() succeeds, so
    // auth is fully done by this point.
    _pool.on("connect", (client) => {
      const stream = (
        client as unknown as {
          connection?: { stream?: { setTimeout(ms: number): void } };
        }
      ).connection?.stream;
      if (stream && typeof stream.setTimeout === "function") {
        stream.setTimeout(0);
      }
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
      if (!_pool) return;
      const now = Date.now();
      const p = _pool;
      const total = p.totalCount;
      const idle = p.idleCount;
      const waiting = p.waitingCount;
      const tracked = checkedOut.size;
      const active = total - idle;

      if (waiting > 0 || active >= 5 || tracked >= 3) {
        console.warn(
          `[db-pool] sweep total=${total} idle=${idle} active=${active} waiting=${waiting} tracked=${tracked}`,
        );
      }

      // Watchdog: if nearly all connections are in zombie state (active near
      // max but tracked=0), the pool cannot recover on its own. Exit so
      // Railway restarts with a clean pool. Threshold is set high to avoid
      // firing on normal startup bursts.
      if (active >= WATCHDOG_ACTIVE_THRESHOLD && tracked === 0) {
        if (_watchdogStuckSince === null) {
          _watchdogStuckSince = now;
          console.error(
            `[db-pool] WATCHDOG armed: active=${active} tracked=0 — will exit in ${WATCHDOG_STUCK_MS / 1000}s if unresolved`,
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
        if (_watchdogStuckSince !== null) {
          console.info("[db-pool] WATCHDOG disarmed: pool recovered");
        }
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
