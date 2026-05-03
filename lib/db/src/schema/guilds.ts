import { pgTable, serial, varchar, text, timestamp, integer, primaryKey, uniqueIndex } from "drizzle-orm/pg-core";
import { userProfilesTable } from "./userProfiles";

export const guildsTable = pgTable("guilds", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 40 }).notNull().unique(),
  tag: varchar("tag", { length: 6 }).notNull(),
  leaderId: varchar("leader_id", { length: 100 })
    .notNull()
    .references(() => userProfilesTable.clerkUserId, { onDelete: "cascade" }),
  description: text("description").notNull().default(""),
  crest: varchar("crest", { length: 20 }).notNull().default("swords"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const guildMembersTable = pgTable(
  "guild_members",
  {
    guildId: integer("guild_id")
      .notNull()
      .references(() => guildsTable.id, { onDelete: "cascade" }),
    userId: varchar("user_id", { length: 100 })
      .notNull()
      .references(() => userProfilesTable.clerkUserId, { onDelete: "cascade" }),
    role: varchar("role", { length: 10 }).notNull().default("member"),
    joinedAt: timestamp("joined_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.guildId, t.userId] }),
    uniqueIndex("guild_members_user_idx").on(t.userId),
  ],
);

export const guildMessagesTable = pgTable("guild_messages", {
  id: serial("id").primaryKey(),
  guildId: integer("guild_id")
    .notNull()
    .references(() => guildsTable.id, { onDelete: "cascade" }),
  userId: varchar("user_id", { length: 100 }).notNull(),
  writerName: varchar("writer_name", { length: 50 }).notNull(),
  content: text("content").notNull(),
  type: varchar("type", { length: 10 }).notNull().default("chat"),
  sentAt: timestamp("sent_at").notNull().defaultNow(),
});

export const guildInvitesTable = pgTable("guild_invites", {
  id: serial("id").primaryKey(),
  guildId: integer("guild_id")
    .notNull()
    .references(() => guildsTable.id, { onDelete: "cascade" }),
  inviteeId: varchar("invitee_id", { length: 100 }).notNull(),
  invitedBy: varchar("invited_by", { length: 100 }).notNull(),
  status: varchar("status", { length: 10 }).notNull().default("pending"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Guild = typeof guildsTable.$inferSelect;
export type GuildMember = typeof guildMembersTable.$inferSelect;
export type GuildMessage = typeof guildMessagesTable.$inferSelect;
export type GuildInvite = typeof guildInvitesTable.$inferSelect;
