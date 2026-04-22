import { pgTable, varchar, integer, bigint, timestamp } from "drizzle-orm/pg-core";

export const roomsTable = pgTable("rooms", {
  code: varchar("code", { length: 20 }).primaryKey(),
  creatorName: varchar("creator_name", { length: 100 }).notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  countdownDelayMinutes: integer("countdown_delay_minutes").notNull().default(0),
  mode: varchar("mode", { length: 20 }).notNull().default("regular"),
  wordGoal: integer("word_goal"),
  bossWordGoal: integer("boss_word_goal"),
  deathModeWpm: integer("death_mode_wpm"),
  status: varchar("status", { length: 20 }).notNull().default("waiting"),
  startTime: bigint("start_time", { mode: "number" }),
  endTime: bigint("end_time", { mode: "number" }),
  countdownEndsAt: bigint("countdown_ends_at", { mode: "number" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Room = typeof roomsTable.$inferSelect;
