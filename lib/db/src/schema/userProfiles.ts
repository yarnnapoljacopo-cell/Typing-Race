import { pgTable, varchar, timestamp } from "drizzle-orm/pg-core";

export const userProfilesTable = pgTable("user_profiles", {
  clerkUserId: varchar("clerk_user_id", { length: 100 }).primaryKey(),
  writerName: varchar("writer_name", { length: 50 }).notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type UserProfile = typeof userProfilesTable.$inferSelect;
