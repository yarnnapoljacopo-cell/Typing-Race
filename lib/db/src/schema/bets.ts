import { pgTable, varchar, integer, timestamp, primaryKey } from "drizzle-orm/pg-core";

export const roomBetsTable = pgTable(
  "room_bets",
  {
    roomCode: varchar("room_code", { length: 20 }).notNull(),
    userId: varchar("user_id", { length: 100 }).notNull(),
    writerName: varchar("writer_name", { length: 50 }).notNull(),
    amount: integer("amount").notNull(),
    status: varchar("status", { length: 12 }).notNull().default("active"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    settledAt: timestamp("settled_at"),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.roomCode, t.userId] }),
  }),
);
