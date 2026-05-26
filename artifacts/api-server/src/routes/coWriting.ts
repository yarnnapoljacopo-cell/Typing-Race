import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { getAuth } from "@clerk/express";
import {
  db,
  coWritingRoomsTable,
  coWritingMembersTable,
  coWritingDocsTable,
  coWritingDocStateTable,
  userProfilesTable,
} from "@workspace/db";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { logger } from "../lib/logger";
import { snapshotDoc } from "../lib/coWritingWs";

const router: IRouter = Router();

// Wrap each handler so any thrown error (e.g. missing-table) bubbles to a
// JSON response with the underlying message + logs the full stack — instead
// of Express's default opaque "500 Internal Server Error" with no body.
type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;
const wrap = (fn: AsyncHandler) => async (req: Request, res: Response, next: NextFunction) => {
  try { await fn(req, res, next); }
  catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err, path: req.path, method: req.method }, "co-writing route error");
    if (!res.headersSent) res.status(500).json({ error: msg });
  }
};

// ── Helpers ───────────────────────────────────────────────────────────────
// 6-char invite codes (uppercase letters + digits, no ambiguous chars).
function generateInviteCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

// Soft palette — first member of each room gets the next colour in line so
// people are distinguishable in the editor without manual config.
const MEMBER_COLORS = [
  "#3b6ea5", "#c0392b", "#15803d", "#7c5cbf", "#d97706",
  "#0891b2", "#be185d", "#65a30d", "#9333ea", "#dc2626",
];
async function nextColorForRoom(roomId: number): Promise<string> {
  const existing = await db.select({ color: coWritingMembersTable.color })
    .from(coWritingMembersTable)
    .where(eq(coWritingMembersTable.roomId, roomId));
  const used = new Set(existing.map((m) => m.color));
  // First unused colour, or wrap if everyone has one already.
  for (const c of MEMBER_COLORS) if (!used.has(c)) return c;
  return MEMBER_COLORS[existing.length % MEMBER_COLORS.length];
}

async function resolveDisplayName(userId: string, fallback: string): Promise<string> {
  try {
    const [p] = await db.select({ writerName: userProfilesTable.writerName })
      .from(userProfilesTable)
      .where(eq(userProfilesTable.clerkUserId, userId));
    return p?.writerName ?? fallback;
  } catch {
    return fallback;
  }
}

async function isMember(roomId: number, userId: string): Promise<boolean> {
  const [m] = await db.select({ id: coWritingMembersTable.id })
    .from(coWritingMembersTable)
    .where(and(eq(coWritingMembersTable.roomId, roomId), eq(coWritingMembersTable.userId, userId)));
  return !!m;
}

// ── Rooms ────────────────────────────────────────────────────────────────

/** List every room I'm a member of. */
router.get("/co-writing/rooms", wrap(async (req, res): Promise<void> => {
  const userId = getAuth(req)?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const myMemberships = await db.select({ roomId: coWritingMembersTable.roomId })
    .from(coWritingMembersTable)
    .where(eq(coWritingMembersTable.userId, userId));
  if (myMemberships.length === 0) { res.json({ rooms: [] }); return; }

  const roomIds = myMemberships.map((r) => r.roomId);
  const rooms = await db.select().from(coWritingRoomsTable)
    .where(inArray(coWritingRoomsTable.id, roomIds))
    .orderBy(desc(coWritingRoomsTable.updatedAt));

  // For each room, fetch a quick member count so the list page is useful.
  const allMembers = await db.select({ roomId: coWritingMembersTable.roomId })
    .from(coWritingMembersTable)
    .where(inArray(coWritingMembersTable.roomId, roomIds));
  const memberCount: Record<number, number> = {};
  for (const m of allMembers) memberCount[m.roomId] = (memberCount[m.roomId] ?? 0) + 1;

  res.json({
    rooms: rooms.map((r) => ({
      id: r.id, name: r.name, inviteCode: r.inviteCode,
      ownerUserId: r.ownerUserId, isOwner: r.ownerUserId === userId,
      memberCount: memberCount[r.id] ?? 0,
      createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
    })),
  });
}));

/** Create a new room. The creator is automatically added as the owner. */
router.post("/co-writing/rooms", wrap(async (req, res): Promise<void> => {
  const userId = getAuth(req)?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const name = String(req.body?.name ?? "").trim().slice(0, 120);
  if (!name) { res.status(400).json({ error: "name required" }); return; }

  // Generate a unique invite code — retry up to a few times on the (very
  // unlikely) collision; the alphabet gives ~10⁹ codes.
  let inviteCode = "";
  for (let attempt = 0; attempt < 5; attempt++) {
    inviteCode = generateInviteCode();
    const [existing] = await db.select({ id: coWritingRoomsTable.id })
      .from(coWritingRoomsTable)
      .where(eq(coWritingRoomsTable.inviteCode, inviteCode));
    if (!existing) break;
    inviteCode = "";
  }
  if (!inviteCode) { res.status(500).json({ error: "Could not allocate invite code" }); return; }

  const [room] = await db.insert(coWritingRoomsTable)
    .values({ name, ownerUserId: userId, inviteCode })
    .returning();

  const displayName = await resolveDisplayName(userId, "Writer");
  await db.insert(coWritingMembersTable).values({
    roomId: room.id,
    userId,
    displayName,
    color: MEMBER_COLORS[0],
    role: "owner",
  });

  res.json({ ok: true, room: { id: room.id, name: room.name, inviteCode: room.inviteCode, isOwner: true } });
}));

/** Look up a room by invite code (preview before joining). */
router.get("/co-writing/rooms/by-code/:code", wrap(async (req, res): Promise<void> => {
  const userId = getAuth(req)?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const code = String(req.params.code ?? "").toUpperCase().slice(0, 12);
  const [room] = await db.select().from(coWritingRoomsTable).where(eq(coWritingRoomsTable.inviteCode, code));
  if (!room) { res.status(404).json({ error: "No room with that invite code" }); return; }

  const members = await db.select().from(coWritingMembersTable).where(eq(coWritingMembersTable.roomId, room.id));
  const alreadyMember = members.some((m) => m.userId === userId);
  res.json({
    room: { id: room.id, name: room.name, memberCount: members.length, alreadyMember },
  });
}));

/** Join a room by invite code. Idempotent — if already a member, returns ok. */
router.post("/co-writing/rooms/join", wrap(async (req, res): Promise<void> => {
  const userId = getAuth(req)?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const code = String(req.body?.code ?? "").toUpperCase().slice(0, 12);
  if (!code) { res.status(400).json({ error: "code required" }); return; }

  const [room] = await db.select().from(coWritingRoomsTable).where(eq(coWritingRoomsTable.inviteCode, code));
  if (!room) { res.status(404).json({ error: "No room with that invite code" }); return; }

  if (await isMember(room.id, userId)) {
    res.json({ ok: true, room: { id: room.id, name: room.name }, joined: false });
    return;
  }

  const displayName = await resolveDisplayName(userId, "Writer");
  const color = await nextColorForRoom(room.id);
  await db.insert(coWritingMembersTable).values({
    roomId: room.id,
    userId,
    displayName,
    color,
    role: "editor",
  });
  await db.update(coWritingRoomsTable)
    .set({ updatedAt: new Date() })
    .where(eq(coWritingRoomsTable.id, room.id));

  res.json({ ok: true, room: { id: room.id, name: room.name }, joined: true });
}));

/** Get the full room details — members + docs. Members of the room only. */
router.get("/co-writing/rooms/:id", wrap(async (req, res): Promise<void> => {
  const userId = getAuth(req)?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const roomId = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(roomId)) { res.status(400).json({ error: "Invalid id" }); return; }
  if (!(await isMember(roomId, userId))) { res.status(403).json({ error: "Not a member" }); return; }

  const [room] = await db.select().from(coWritingRoomsTable).where(eq(coWritingRoomsTable.id, roomId));
  if (!room) { res.status(404).json({ error: "Room not found" }); return; }

  const members = await db.select().from(coWritingMembersTable)
    .where(eq(coWritingMembersTable.roomId, roomId))
    .orderBy(asc(coWritingMembersTable.joinedAt));
  const docs = await db.select({
    id: coWritingDocsTable.id,
    name: coWritingDocsTable.name,
    orderIndex: coWritingDocsTable.orderIndex,
    createdBy: coWritingDocsTable.createdBy,
    createdAt: coWritingDocsTable.createdAt,
    updatedAt: coWritingDocsTable.updatedAt,
  }).from(coWritingDocsTable)
    .where(eq(coWritingDocsTable.roomId, roomId))
    .orderBy(asc(coWritingDocsTable.orderIndex), asc(coWritingDocsTable.createdAt));

  res.json({
    room: {
      id: room.id, name: room.name, inviteCode: room.inviteCode,
      ownerUserId: room.ownerUserId, isOwner: room.ownerUserId === userId,
    },
    members: members.map((m) => ({
      userId: m.userId, displayName: m.displayName,
      color: m.color, role: m.role,
      joinedAt: m.joinedAt.toISOString(),
      lastSeenAt: m.lastSeenAt.toISOString(),
    })),
    docs: docs.map((d) => ({
      id: d.id, name: d.name, orderIndex: d.orderIndex,
      createdBy: d.createdBy,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    })),
  });
}));

/** Create a new document inside a room. */
router.post("/co-writing/rooms/:id/docs", wrap(async (req, res): Promise<void> => {
  const userId = getAuth(req)?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const roomId = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(roomId)) { res.status(400).json({ error: "Invalid id" }); return; }
  if (!(await isMember(roomId, userId))) { res.status(403).json({ error: "Not a member" }); return; }

  const name = String(req.body?.name ?? "Untitled").trim().slice(0, 200) || "Untitled";

  // Append after any existing docs.
  const existing = await db.select({ orderIndex: coWritingDocsTable.orderIndex })
    .from(coWritingDocsTable)
    .where(eq(coWritingDocsTable.roomId, roomId));
  const maxOrder = existing.reduce((m, d) => Math.max(m, d.orderIndex), -1);

  const [doc] = await db.insert(coWritingDocsTable)
    .values({ roomId, name, orderIndex: maxOrder + 1, createdBy: userId })
    .returning();

  res.json({ ok: true, doc: { id: doc.id, name: doc.name, orderIndex: doc.orderIndex } });
}));

/** Rename a doc. */
router.patch("/co-writing/rooms/:id/docs/:docId", wrap(async (req, res): Promise<void> => {
  const userId = getAuth(req)?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const roomId = parseInt(String(req.params.id), 10);
  const docId = parseInt(String(req.params.docId), 10);
  if (!Number.isFinite(roomId) || !Number.isFinite(docId)) { res.status(400).json({ error: "Invalid id" }); return; }
  if (!(await isMember(roomId, userId))) { res.status(403).json({ error: "Not a member" }); return; }

  const name = String(req.body?.name ?? "").trim().slice(0, 200);
  if (!name) { res.status(400).json({ error: "name required" }); return; }

  await db.update(coWritingDocsTable)
    .set({ name, updatedAt: new Date() })
    .where(and(eq(coWritingDocsTable.id, docId), eq(coWritingDocsTable.roomId, roomId)));
  res.json({ ok: true });
}));

/** Delete a doc (and its Yjs state via FK cascade). */
router.delete("/co-writing/rooms/:id/docs/:docId", wrap(async (req, res): Promise<void> => {
  const userId = getAuth(req)?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const roomId = parseInt(String(req.params.id), 10);
  const docId = parseInt(String(req.params.docId), 10);
  if (!Number.isFinite(roomId) || !Number.isFinite(docId)) { res.status(400).json({ error: "Invalid id" }); return; }
  if (!(await isMember(roomId, userId))) { res.status(403).json({ error: "Not a member" }); return; }

  await db.delete(coWritingDocsTable)
    .where(and(eq(coWritingDocsTable.id, docId), eq(coWritingDocsTable.roomId, roomId)));
  res.json({ ok: true });
}));

/** Delete a room (owner only). */
router.delete("/co-writing/rooms/:id", wrap(async (req, res): Promise<void> => {
  const userId = getAuth(req)?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const roomId = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(roomId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [room] = await db.select().from(coWritingRoomsTable).where(eq(coWritingRoomsTable.id, roomId));
  if (!room) { res.status(404).json({ error: "Room not found" }); return; }
  if (room.ownerUserId !== userId) { res.status(403).json({ error: "Only the owner can delete the room" }); return; }

  await db.delete(coWritingRoomsTable).where(eq(coWritingRoomsTable.id, roomId));
  res.json({ ok: true });
}));

/** Leave a room (any non-owner member). */
router.post("/co-writing/rooms/:id/leave", wrap(async (req, res): Promise<void> => {
  const userId = getAuth(req)?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const roomId = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(roomId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [room] = await db.select().from(coWritingRoomsTable).where(eq(coWritingRoomsTable.id, roomId));
  if (!room) { res.status(404).json({ error: "Room not found" }); return; }
  if (room.ownerUserId === userId) { res.status(400).json({ error: "Owner can't leave — delete the room instead" }); return; }

  await db.delete(coWritingMembersTable)
    .where(and(eq(coWritingMembersTable.roomId, roomId), eq(coWritingMembersTable.userId, userId)));
  res.json({ ok: true });
}));

/**
 * HTTP-only load path. The primary load path is the y-websocket sync
 * handshake — but if the WebSocket can't establish for ANY reason (proxy
 * not forwarding upgrades, server restart, mobile network blip, etc.)
 * the client is stuck staring at an empty editor even though the content
 * is safely in the DB. This route lets the client pull the saved HTML
 * straight from `co_writing_doc_state.text_preview` via plain HTTP, so
 * "Connecting…" no longer means "your work is gone."
 */
router.get("/co-writing/rooms/:id/docs/:docId/snapshot", wrap(async (req, res): Promise<void> => {
  const userId = getAuth(req)?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const roomId = parseInt(String(req.params.id), 10);
  const docId = parseInt(String(req.params.docId), 10);
  if (!Number.isFinite(roomId) || !Number.isFinite(docId)) { res.status(400).json({ error: "Invalid id" }); return; }
  if (!(await isMember(roomId, userId))) { res.status(403).json({ error: "Not a member" }); return; }

  const [doc] = await db.select({ id: coWritingDocsTable.id })
    .from(coWritingDocsTable)
    .where(and(eq(coWritingDocsTable.id, docId), eq(coWritingDocsTable.roomId, roomId)));
  if (!doc) { res.status(404).json({ error: "Doc not found in this room" }); return; }

  const [row] = await db.select({
    textPreview: coWritingDocStateTable.textPreview,
    updatedAt: coWritingDocStateTable.updatedAt,
  }).from(coWritingDocStateTable).where(eq(coWritingDocStateTable.docId, docId));

  res.json({
    html: row?.textPreview ?? "",
    updatedAt: row?.updatedAt ? row.updatedAt.toISOString() : null,
  });
}));

/**
 * Belt-and-suspenders save: clients push the current editor HTML here
 * periodically (and on beforeunload via sendBeacon) so content is durable
 * even when the WebSocket sync path is unavailable for some reason
 * (proxies, deploys, flaky connections, …).
 *
 * Auth: regular Clerk + membership check. Note that we ALSO accept a
 * fallback `userId` field in the body so sendBeacon paths still work when
 * Clerk hasn't injected the auth header (sendBeacon strips custom headers).
 * Membership check still runs against whichever userId is established.
 */
router.put("/co-writing/rooms/:id/docs/:docId/snapshot", wrap(async (req, res): Promise<void> => {
  let userId = getAuth(req)?.userId ?? null;
  // sendBeacon can't set Authorization, so allow body.userId as a fallback
  // — but ONLY when it matches a real member of the room (verified below).
  if (!userId && typeof req.body?.userId === "string") userId = req.body.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const roomId = parseInt(String(req.params.id), 10);
  const docId = parseInt(String(req.params.docId), 10);
  if (!Number.isFinite(roomId) || !Number.isFinite(docId)) { res.status(400).json({ error: "Invalid id" }); return; }
  if (!(await isMember(roomId, userId))) { res.status(403).json({ error: "Not a member" }); return; }

  // Make sure the doc actually belongs to this room — prevents a member
  // of room A from writing into room B's doc.
  const [doc] = await db.select({ id: coWritingDocsTable.id })
    .from(coWritingDocsTable)
    .where(and(eq(coWritingDocsTable.id, docId), eq(coWritingDocsTable.roomId, roomId)));
  if (!doc) { res.status(404).json({ error: "Doc not found in this room" }); return; }

  const html = typeof req.body?.html === "string" ? req.body.html : "";
  await snapshotDoc(roomId, docId, html);
  res.json({ ok: true });
}));

// Re-export shared helpers so the WebSocket auth path doesn't have to
// duplicate the membership check.
export { isMember as coWritingIsMember };
// Re-export doc state table for the WS persistence path.
export { coWritingDocStateTable as coWritingDocStateTableRef };

export default router;
