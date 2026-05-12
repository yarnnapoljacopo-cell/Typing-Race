import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

type Schema = typeof schema;

// Why zombies form (pg-pool 3.13.0 + Railway):
//
// pg-pool's newClient() sets a JS timer at connectionTimeoutMillis (5 s).
// When it fires it calls: client.connection.stream.destroy()  ← NO error arg
//
// For SSL connections (Railway uses SSL), connection.js replaces this.stream
// with a TLS socket mid-auth (getSecureStream). destroy() without an error
// fires the TLS socket's 'close' event but NOT 'error'. pg routes 'close' →
// Connection 'end' → _connectionCallback — but on Railway, when PG is hung
// mid-auth, the OS TCP layer holds the socket in CLOSE_WAIT/FIN_WAIT for
// *minutes* before 'close' fires. During that window: client is stuck in
// pool._clients (total↑) but acquire never fires (tracked=0). Zombie.
//
// The fix — use pg.Client's own timer instead of pg-pool's:
//
// pg.Client._connect() sets its own JS timer at this._connectionTimeoutMillis.
// When it fires it calls: con.stream.destroy(new Error('timeout expired'))
// WITH an error, reading con.stream at fire-time (= TLS socket for SSL).
// destroy(err) fires the TLS socket's 'error' event immediately — no OS wait.
// pg routes 'error' → Connection 'error' → _handleErrorWhileConnecting(err) →
// _connectionCallback(err) → pg-pool's connect callback → _clients.filter()
// (total--) runs immediately. No zombie.
//
// pg.Client also clears its own timer in _handleReadyForQuery() when auth
// succeeds, so no valid connection is ever affected.
//
// By setting _connectionTimeoutMillis = 4 s (< pg-pool's 5 s), pg.Client's
// timer wins the race: it fires at 4 s with an error before pg-pool's 5 s
// destroy()-without-error can fire.
//
// Previous approach (stream.setTimeout on TCP socket) was wrong: for SSL,
// this.connection.stream is the TCP socket at connect() time but is replaced
// with the TLS socket during SSL negotiation. The TCP socket timeout was never
// cleared (pool.on('connect') cleared the TLS socket by mistake) and fired
// ~4 s after auth completed for every successful connection, destroying valid
// idle connections. That caused the 6 simultaneous zombies after HTTP requests.
class AuthTimeoutClient extends pg.Client {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(config: any) {
    super(config);
    // Override pg.Client's own connectionTimeoutMillis to 4 s so its timer
    // fires before pg-pool's 5 s timer. pg.Client reads this field in
    // _connect() to set up the timer; overwriting it here is the only way
    // to set a different value without changing the pool config (which also
    // controls queue-waiting timeouts that we want to keep at 5 s).
    (
      this as unknown as { _connectionTimeoutMillis: number }
    )._connectionTimeoutMillis = 4_000;
    console.info("[auth-timeout] new client — 4 s auth timeout armed");
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
      // AuthTimeoutClient overrides _connectionTimeoutMillis to 4 s so
      // pg.Client's own timer wins the race against pg-pool's 5 s destroy()
      // — see class comment above for full explanation.
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
      `[db-pool] initialized max=10 connectionTimeoutMillis=5000 clientAuthTimeout=4000 idleTimeoutMillis=30000 sweep=${SWEEP_INTERVAL_MS}ms watchdog=${WATCHDOG_STUCK_MS}ms@${WATCHDOG_ACTIVE_THRESHOLD}`,
    );

    _pool.on("error", (err) => {
      console.error(
        "[db-pool] idle client error — will be replaced:",
        err.message,
      );
    });

    // Fires once per physical connection after auth completes (isNew=true path
    // in _acquireClient). Stack trace shows which code path triggered the new
    // connection — if zombies appear without a preceding 'connect' log they
    // never completed auth, confirming auth-phase origin.
    _pool.on("connect", (_client) => {
      const p = _pool!;
      const stack = new Error().stack?.split("\n").slice(2, 10).join("\n") ?? "(no stack)";
      console.info(
        `[db-pool] CONNECT total=${p.totalCount} idle=${p.idleCount} waiting=${p.waitingCount}\n${stack}`,
      );
    });

    // Fires when a connection is ejected from the pool (_remove is called).
    // Stack trace shows what triggered the removal (idle timeout, error release, etc.).
    _pool.on("remove", (_client) => {
      const p = _pool!;
      const stack = new Error().stack?.split("\n").slice(2, 10).join("\n") ?? "(no stack)";
      console.info(
        `[db-pool] REMOVE total=${p.totalCount} idle=${p.idleCount} waiting=${p.waitingCount}\n${stack}`,
      );
    });

    _pool.on("acquire", (client) => {
      const stack =
        new Error("acquired here").stack?.split("\n").slice(2, 10).join("\n") ??
        "(no stack)";
      checkedOut.set(client, { acquiredAt: Date.now(), warned: false, stack });
      const p = _pool!;
      console.info(
        `[db-pool] ACQUIRE total=${p.totalCount} idle=${p.idleCount} waiting=${p.waitingCount}\n${stack}`,
      );
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
