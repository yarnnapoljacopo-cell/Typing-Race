import { pgTable, serial, varchar, text, integer, timestamp, boolean, uniqueIndex } from "drizzle-orm/pg-core";

export const sprintWritingTable = pgTable("sprint_writing", {
  id: serial("id").primaryKey(),
  roomCode: varchar("room_code", { length: 20 }).notNull(),
  participantName: varchar("participant_name", { length: 100 }).notNull(),
  clerkUserId: varchar("clerk_user_id", { length: 100 }),
  text: text("text").notNull().default(""),
  wordCount: integer("word_count").notNull().default(0),
  savedToFiles: boolean("saved_to_files").notNull().default(false),
  xpAwarded: boolean("xp_awarded").notNull().default(false),
  roomMode: varchar("room_mode", { length: 20 }).notNull().default("regular"),
  wordGoal: integer("word_goal"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("sprint_writing_room_participant_idx").on(t.roomCode, t.participantName),
]);

export type SprintWriting = typeof sprintWritingTable.$inferSelect;
