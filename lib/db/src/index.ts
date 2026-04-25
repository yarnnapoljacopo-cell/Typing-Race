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
      max: 15,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      allowExitOnIdle: false,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10_000,
      query_timeout: 5_000,
      statement_timeout: 5_000,
    });

    // Swallow idle-client errors — pg-pool removes the dead client and creates
    // a fresh one on the next acquire, so the pool self-heals.
    _pool.on("error", (err) => {
      console.error("[db-pool] idle client error — will be replaced:", err.message);
    });

    // Set statement_timeout on every new connection so the DB kills any query
    // that hangs longer than 20 s, freeing the pool slot automatically.
    _pool.on("connect", (client) => {
      client.query("SET statement_timeout = 5000").catch((err) => {
        console.error("[db-pool] could not set statement_timeout:", err.message);
      });
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
