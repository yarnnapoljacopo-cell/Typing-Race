import { pgTable, varchar, serial, integer, timestamp, text, customType, index } from "drizzle-orm/pg-core";

// PostgreSQL `bytea` column for Yjs binary state vectors. Drizzle doesn't ship
// a first-class bytea type so we declare one inline — the value at runtime is
// a Buffer in and a Buffer out.
const bytea = customType<{ data: Buffer; default: false }>({
  dataType() { return "bytea"; },
});

/**
 * A co-writing project. The invite_code is the public token someone receives
 * from the owner — anyone with the code can call /join to become a member.
 */
export const coWritingRoomsTable = pgTable("co_writing_rooms", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  ownerUserId: varchar("owner_user_id", { length: 100 }).notNull(),
  inviteCode: varchar("invite_code", { length: 12 }).notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
export type CoWritingRoomRow = typeof coWritingRoomsTable.$inferSelect;

/**
 * Membership row: each user that has access to a room. `color` is the
 * per-member tint used for their cursor / avatar across every client.
 * `role`: 'owner' | 'editor'. (No viewer role yet — keep MVP simple.)
 */
export const coWritingMembersTable = pgTable("co_writing_members", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").notNull(),
  userId: varchar("user_id", { length: 100 }).notNull(),
  displayName: varchar("display_name", { length: 80 }).notNull(),
  color: varchar("color", { length: 16 }).notNull(),
  role: varchar("role", { length: 16 }).notNull().default("editor"),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  byRoom: index("co_writing_members_room_idx").on(t.roomId),
  // Composite unique idx prevents duplicate memberships (room_id + user_id).
  // Created via raw SQL in ensureSchema so we don't depend on a Drizzle ext.
}));
export type CoWritingMemberRow = typeof coWritingMembersTable.$inferSelect;

/**
 * A document inside a co-writing room. Each doc has an associated Yjs state
 * binary blob stored in `co_writing_doc_state` (kept separate so the docs
 * table stays cheap to query for listing).
 */
export const coWritingDocsTable = pgTable("co_writing_docs", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  orderIndex: integer("order_index").notNull().default(0),
  createdBy: varchar("created_by", { length: 100 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  byRoom: index("co_writing_docs_room_idx").on(t.roomId),
}));
export type CoWritingDocRow = typeof coWritingDocsTable.$inferSelect;

/**
 * The actual Yjs binary state for each doc. Updated by the WebSocket sync
 * handler (debounced) every few seconds while clients are connected.
 *
 * NOTE: also stores a plain-text snapshot in `text_preview` so the room list
 * page can show a quick excerpt without having to load and decode every Y.Doc.
 */
export const coWritingDocStateTable = pgTable("co_writing_doc_state", {
  docId: integer("doc_id").primaryKey(),
  state: bytea("state"),
  textPreview: text("text_preview").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
export type CoWritingDocStateRow = typeof coWritingDocStateTable.$inferSelect;
