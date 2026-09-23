// Controlled database boundary for real server/CRDT regression tests.
import { getTableName } from "drizzle-orm";
export * from "../../../lib/db/src/schema";

export const records = new Map<string, any[]>();
export const writes: Array<{ table: string; values: any }> = [];
export const control = {
  readGate: null as Promise<void> | null,
  writeGate: null as Promise<void> | null,
  failReads: false,
  failWrites: false,
  activeWrites: 0,
  maxWrites: 0,
  reads: 0,
};

function query(action: string, table?: any): any {
  let values: any;
  const chain: any = {
    from(t: any) { table = t; return chain; },
    values(v: any) { values = v; return chain; },
    set(v: any) { values = v; return chain; },
    where() { return chain; },
    limit() { return chain; },
    orderBy() { return chain; },
    onConflictDoUpdate() { return chain; },
    async execute() {
      const name = getTableName(table);
      if (action === "select") {
        control.reads++;
        if (control.readGate) await control.readGate;
        if (control.failReads) throw new Error("Database unavailable");
        return records.get(name) ?? [];
      }
      control.activeWrites++;
      control.maxWrites = Math.max(control.maxWrites, control.activeWrites);
      try {
        if (control.writeGate) await control.writeGate;
        if (control.failWrites) throw new Error("Database unavailable");
        writes.push({ table: name, values });
        if (action === "insert") records.set(name, [values]);
        return [];
      } finally { control.activeWrites--; }
    },
    then(resolve: any, reject: any) { return chain.execute().then(resolve, reject); },
  };
  return chain;
}
export const db: any = {
  select: () => query("select"),
  insert: (table: any) => query("insert", table),
  update: (table: any) => query("update", table),
  delete: (table: any) => query("delete", table),
};
export const pool: any = {
  query: async () => ({ rows: [] }),
  connect: async () => ({ query: async () => ({ rows: [] }), release() {} }),
};
