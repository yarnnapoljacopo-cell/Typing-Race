import { pgTable, serial, varchar, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { userProfilesTable } from "./userProfiles";

export const friendshipsTable = pgTable("friendships", {
  id: serial("id").primaryKey(),
  requesterId: varchar("requester_id", { length: 100 }).notNull().references(() => userProfilesTable.clerkUserId, { onDelete: "cascade" }),
  addresseeId: varchar("addressee_id", { length: 100 }).notNull().references(() => userProfilesTable.clerkUserId, { onDelete: "cascade" }),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("friendships_pair_idx").on(t.requesterId, t.addresseeId),
]);

export type Friendship = typeof friendshipsTable.$inferSelect;
