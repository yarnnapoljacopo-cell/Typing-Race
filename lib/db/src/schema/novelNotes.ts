import { pgTable, varchar, timestamp, jsonb } from "drizzle-orm/pg-core";

export const novelNotesStateTable = pgTable("novel_notes_state", {
  userId: varchar("user_id", { length: 100 }).primaryKey(),
  nnData: jsonb("nn_data").notNull().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type NovelNotesStateRow = typeof novelNotesStateTable.$inferSelect;
