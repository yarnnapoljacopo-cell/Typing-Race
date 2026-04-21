import { pgTable, serial, varchar, text, integer, timestamp, boolean } from "drizzle-orm/pg-core";

export const sprintWritingTable = pgTable("sprint_writing", {
  id: serial("id").primaryKey(),
  roomCode: varchar("room_code", { length: 20 }).notNull(),
  participantName: varchar("participant_name", { length: 100 }).notNull(),
  clerkUserId: varchar("clerk_user_id", { length: 100 }),
  text: text("text").notNull().default(""),
  wordCount: integer("word_count").notNull().default(0),
  savedToFiles: boolean("saved_to_files").notNull().default(false),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type SprintWriting = typeof sprintWritingTable.$inferSelect;
