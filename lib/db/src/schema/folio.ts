import { pgTable, varchar, timestamp, jsonb } from "drizzle-orm/pg-core";

export const folioStateTable = pgTable("folio_state", {
  userId: varchar("user_id", { length: 100 }).primaryKey(),
  state: jsonb("state").notNull().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type FolioStateRow = typeof folioStateTable.$inferSelect;
