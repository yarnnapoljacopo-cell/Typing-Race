import { pgTable, varchar, timestamp, jsonb, serial } from "drizzle-orm/pg-core";

export const folioStateTable = pgTable("folio_state", {
  userId: varchar("user_id", { length: 100 }).primaryKey(),
  state: jsonb("state").notNull().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type FolioStateRow = typeof folioStateTable.$inferSelect;

/** Versioned backup snapshots — one row every ~5 minutes of active writing. */
export const folioSnapshotsTable = pgTable("folio_snapshots", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 100 }).notNull(),
  savedAt: timestamp("saved_at", { withTimezone: true }).notNull().defaultNow(),
  state: jsonb("state").notNull(),
});

export type FolioSnapshotRow = typeof folioSnapshotsTable.$inferSelect;
