import { pgTable, varchar, timestamp, integer } from "drizzle-orm/pg-core";

export const userProfilesTable = pgTable("user_profiles", {
  clerkUserId: varchar("clerk_user_id", { length: 100 }).primaryKey(),
  writerName: varchar("writer_name", { length: 50 }).notNull(),
  xp: integer("xp").notNull().default(0),
  lastSprintAt: timestamp("last_sprint_at"),
  decayCheckedAt: timestamp("decay_checked_at"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type UserProfile = typeof userProfilesTable.$inferSelect;
