import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import {
  db,
  guildsTable,
  guildMembersTable,
  guildMessagesTable,
  guildInvitesTable,
  userProfilesTable,
} from "@workspace/db";
import { eq, and, or, desc, gte, sql, inArray } from "drizzle-orm";
import {
  createGuild,
  inviteMember,
  acceptInvite,
  declineInvite,
  kickMember,
  leaveGuild,
  transferLeadership,
  disbandGuild,
  pruneOldMessages,
  GuildError,
} from "../lib/guildManager";
import { getOnlineMembers } from "../lib/guildPresence";
import { createRoom, type RoomMode } from "../lib/roomManager";
import bcrypt from "bcrypt";

const router: IRouter = Router();

function requireAuth(req: Parameters<typeof getAuth>[0]): string | null {
  return getAuth(req)?.userId ?? null;
}

async function getMyMembership(
  userId: string,
): Promise<{ guildId: number; role: string } | null> {
  const rows = await db
    .select({ guildId: guildMembersTable.guildId, role: guildMembersTable.role })
    .from(guildMembersTable)
    .where(eq(guildMembersTable.userId, userId))
    .limit(1);
  return rows[0] ?? null;
}

async function getWriterName(userId: string): Promise<string> {
  const rows = await db
    .select({ writerName: userProfilesTable.writerName })
    .from(userProfilesTable)
    .where(eq(userProfilesTable.clerkUserId, userId))
    .limit(1);
  return rows[0]?.writerName ?? "Unknown";
}

function handleError(err: unknown, res: Parameters<typeof router.post>[1] extends (req: infer _R, res: infer S) => unknown ? S : never): void {
  if (err instanceof GuildError) {
    (res as { status: (n: number) => { json: (b: unknown) => void } })
      .status(err.status).json({ error: err.message });
  } else {
    console.error("[guilds]", err);
    (res as { status: (n: number) => { json: (b: unknown) => void } })
      .status(500).json({ error: "Internal error" });
  }
}

// ── GET /api/guilds/me — current guild + members + role ───────────────────
router.get("/guilds/me", async (req, res): Promise<void> => {
  const userId = requireAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  try {
    const membership = await getMyMembership(userId);
    if (!membership) { res.json({ guild: null }); return; }

    const guildRows = await db
      .select()
      .from(guildsTable)
      .where(eq(guildsTable.id, membership.guildId))
      .limit(1);
    const guild = guildRows[0];
    if (!guild) { res.json({ guild: null }); return; }

    const members = await db
      .select({
        userId: guildMembersTable.userId,
        role: guildMembersTable.role,
        joinedAt: guildMembersTable.joinedAt,
        writerName: userProfilesTable.writerName,
        xp: userProfilesTable.xp,
        nameplate: userProfilesTable.activeNameplate,
      })
      .from(guildMembersTable)
      .leftJoin(userProfilesTable, eq(guildMembersTable.userId, userProfilesTable.clerkUserId))
      .where(eq(guildMembersTable.guildId, guild.id));

    const onlineSet = new Set(getOnlineMembers(guild.id));

    res.json({
      guild: {
        id: guild.id,
        name: guild.name,
        tag: guild.tag,
        description: guild.description,
        leaderId: guild.leaderId,
        createdAt: guild.createdAt,
      },
      role: membership.role,
      members: members.map((m) => ({
        userId: m.userId,
        writerName: m.writerName ?? "Unknown",
        role: m.role,
        xp: m.xp ?? 0,
        nameplate: m.nameplate ?? "default",
        joinedAt: m.joinedAt,
        online: onlineSet.has(m.userId),
      })),
    });
  } catch (err) { handleError(err, res); }
});

// ── POST /api/guilds — create guild ───────────────────────────────────────
router.post("/guilds", async (req, res): Promise<void> => {
  const userId = requireAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { name, tag, description } = req.body ?? {};
  if (typeof name !== "string" || typeof tag !== "string") {
    res.status(400).json({ error: "name and tag required" }); return;
  }
  try {
    const guild = await createGuild(userId, name, tag, typeof description === "string" ? description : "");
    res.status(201).json(guild);
  } catch (err) { handleError(err, res); }
});

// ── POST /api/guilds/:id/invite — invite a writer by writerName ───────────
router.post("/guilds/:id/invite", async (req, res): Promise<void> => {
  const userId = requireAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const guildId = parseInt(req.params.id, 10);
  if (isNaN(guildId)) { res.status(400).json({ error: "Invalid guild id" }); return; }

  const { writerName } = req.body ?? {};
  if (typeof writerName !== "string" || !writerName.trim()) {
    res.status(400).json({ error: "writerName required" }); return;
  }
  try {
    const target = await db
      .select({ clerkUserId: userProfilesTable.clerkUserId })
      .from(userProfilesTable)
      .where(eq(userProfilesTable.writerName, writerName.trim()))
      .limit(1);
    if (!target[0]) { res.status(404).json({ error: "No writer with that name" }); return; }
    if (target[0].clerkUserId === userId) {
      res.status(400).json({ error: "You cannot invite yourself" }); return;
    }
    const result = await inviteMember(guildId, userId, target[0].clerkUserId);
    res.json({ ok: true, inviteId: result.inviteId });
  } catch (err) { handleError(err, res); }
});

// ── GET /api/guilds/me/invites — my pending invites ───────────────────────
router.get("/guilds/me/invites", async (req, res): Promise<void> => {
  const userId = requireAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  try {
    const rows = await db
      .select({
        id: guildInvitesTable.id,
        guildId: guildInvitesTable.guildId,
        invitedBy: guildInvitesTable.invitedBy,
        expiresAt: guildInvitesTable.expiresAt,
        guildName: guildsTable.name,
        guildTag: guildsTable.tag,
        leaderId: guildsTable.leaderId,
      })
      .from(guildInvitesTable)
      .innerJoin(guildsTable, eq(guildInvitesTable.guildId, guildsTable.id))
      .where(
        and(
          eq(guildInvitesTable.inviteeId, userId),
          eq(guildInvitesTable.status, "pending"),
          gte(guildInvitesTable.expiresAt, new Date()),
        ),
      )
      .orderBy(desc(guildInvitesTable.createdAt));

    // Resolve inviter names in one query
    const inviterIds = Array.from(new Set(rows.map((r) => r.invitedBy)));
    const inviterRows = inviterIds.length > 0
      ? await db
          .select({ clerkUserId: userProfilesTable.clerkUserId, writerName: userProfilesTable.writerName })
          .from(userProfilesTable)
          .where(inArray(userProfilesTable.clerkUserId, inviterIds))
      : [];
    const inviterMap = new Map(inviterRows.map((r) => [r.clerkUserId, r.writerName]));

    res.json(rows.map((r) => ({
      id: r.id,
      guildId: r.guildId,
      guildName: r.guildName,
      guildTag: r.guildTag,
      invitedByName: inviterMap.get(r.invitedBy) ?? "Unknown",
      expiresAt: r.expiresAt,
    })));
  } catch (err) { handleError(err, res); }
});

// ── POST /api/guilds/invites/:id/accept ──────────────────────────────────
router.post("/guilds/invites/:id/accept", async (req, res): Promise<void> => {
  const userId = requireAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const inviteId = parseInt(req.params.id, 10);
  if (isNaN(inviteId)) { res.status(400).json({ error: "Invalid invite id" }); return; }

  try {
    const result = await acceptInvite(inviteId, userId);
    // Post a system message
    const writerName = await getWriterName(userId);
    await db.insert(guildMessagesTable).values({
      guildId: result.guildId,
      userId,
      writerName,
      content: `${writerName} joined the guild.`,
      type: "system",
    });
    res.json({ ok: true, guildId: result.guildId });
  } catch (err) { handleError(err, res); }
});

// ── POST /api/guilds/invites/:id/decline ─────────────────────────────────
router.post("/guilds/invites/:id/decline", async (req, res): Promise<void> => {
  const userId = requireAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const inviteId = parseInt(req.params.id, 10);
  if (isNaN(inviteId)) { res.status(400).json({ error: "Invalid invite id" }); return; }

  try {
    await declineInvite(inviteId, userId);
    res.json({ ok: true });
  } catch (err) { handleError(err, res); }
});

// ── POST /api/guilds/:id/kick ────────────────────────────────────────────
router.post("/guilds/:id/kick", async (req, res): Promise<void> => {
  const userId = requireAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const guildId = parseInt(req.params.id, 10);
  if (isNaN(guildId)) { res.status(400).json({ error: "Invalid guild id" }); return; }

  const { targetId } = req.body ?? {};
  if (typeof targetId !== "string") { res.status(400).json({ error: "targetId required" }); return; }

  try {
    const leaderName = await getWriterName(userId);
    const targetName = await getWriterName(targetId);
    await kickMember(guildId, userId, targetId, leaderName, targetName);
    res.json({ ok: true });
  } catch (err) { handleError(err, res); }
});

// ── POST /api/guilds/:id/leave ───────────────────────────────────────────
router.post("/guilds/:id/leave", async (req, res): Promise<void> => {
  const userId = requireAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const guildId = parseInt(req.params.id, 10);
  if (isNaN(guildId)) { res.status(400).json({ error: "Invalid guild id" }); return; }

  try {
    const writerName = await getWriterName(userId);
    await leaveGuild(guildId, userId);
    await db.insert(guildMessagesTable).values({
      guildId, userId, writerName,
      content: `${writerName} left the guild.`,
      type: "system",
    });
    res.json({ ok: true });
  } catch (err) { handleError(err, res); }
});

// ── POST /api/guilds/:id/transfer ────────────────────────────────────────
router.post("/guilds/:id/transfer", async (req, res): Promise<void> => {
  const userId = requireAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const guildId = parseInt(req.params.id, 10);
  if (isNaN(guildId)) { res.status(400).json({ error: "Invalid guild id" }); return; }

  const { newLeaderId } = req.body ?? {};
  if (typeof newLeaderId !== "string") { res.status(400).json({ error: "newLeaderId required" }); return; }

  try {
    await transferLeadership(guildId, userId, newLeaderId);
    const oldName = await getWriterName(userId);
    const newName = await getWriterName(newLeaderId);
    await db.insert(guildMessagesTable).values({
      guildId, userId, writerName: oldName,
      content: `${oldName} transferred leadership to ${newName}.`,
      type: "system",
    });
    res.json({ ok: true });
  } catch (err) { handleError(err, res); }
});

// ── DELETE /api/guilds/:id — disband ─────────────────────────────────────
router.delete("/guilds/:id", async (req, res): Promise<void> => {
  const userId = requireAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const guildId = parseInt(req.params.id, 10);
  if (isNaN(guildId)) { res.status(400).json({ error: "Invalid guild id" }); return; }

  try {
    await disbandGuild(guildId, userId);
    res.json({ ok: true });
  } catch (err) { handleError(err, res); }
});

// ── GET /api/guilds/:id/messages — chat history (latest 200) ─────────────
router.get("/guilds/:id/messages", async (req, res): Promise<void> => {
  const userId = requireAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const guildId = parseInt(req.params.id, 10);
  if (isNaN(guildId)) { res.status(400).json({ error: "Invalid guild id" }); return; }

  try {
    // Membership check
    const membership = await db
      .select({ userId: guildMembersTable.userId })
      .from(guildMembersTable)
      .where(and(eq(guildMembersTable.guildId, guildId), eq(guildMembersTable.userId, userId)))
      .limit(1);
    if (!membership[0]) { res.status(403).json({ error: "Not a member of this guild" }); return; }

    const rows = await db
      .select()
      .from(guildMessagesTable)
      .where(eq(guildMessagesTable.guildId, guildId))
      .orderBy(desc(guildMessagesTable.sentAt))
      .limit(200);
    res.json(rows.reverse());
  } catch (err) { handleError(err, res); }
});

// ── POST /api/guilds/:id/messages — send chat ────────────────────────────
router.post("/guilds/:id/messages", async (req, res): Promise<void> => {
  const userId = requireAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const guildId = parseInt(req.params.id, 10);
  if (isNaN(guildId)) { res.status(400).json({ error: "Invalid guild id" }); return; }

  const { content } = req.body ?? {};
  if (typeof content !== "string" || !content.trim()) {
    res.status(400).json({ error: "content required" }); return;
  }
  const trimmed = content.trim().slice(0, 1000);

  try {
    const membership = await db
      .select({ userId: guildMembersTable.userId })
      .from(guildMembersTable)
      .where(and(eq(guildMembersTable.guildId, guildId), eq(guildMembersTable.userId, userId)))
      .limit(1);
    if (!membership[0]) { res.status(403).json({ error: "Not a member of this guild" }); return; }

    const writerName = await getWriterName(userId);
    const inserted = await db
      .insert(guildMessagesTable)
      .values({ guildId, userId, writerName, content: trimmed, type: "chat" })
      .returning();

    // Prune in background
    void pruneOldMessages(guildId, 200).catch(() => { /* ignore */ });

    res.status(201).json(inserted[0]);
  } catch (err) { handleError(err, res); }
});

// ── POST /api/guilds/:id/sprint — leader starts a guild sprint ───────────
router.post("/guilds/:id/sprint", async (req, res): Promise<void> => {
  const userId = requireAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const guildId = parseInt(req.params.id, 10);
  if (isNaN(guildId)) { res.status(400).json({ error: "Invalid guild id" }); return; }

  const {
    durationMinutes,
    mode,
    countdownDelayMinutes,
    wordGoal,
    bossWordGoal,
    gladiatorDeathGap,
    deathModeWpm,
    roomPassword,
  } = req.body ?? {};
  if (typeof durationMinutes !== "number" || durationMinutes <= 0) {
    res.status(400).json({ error: "durationMinutes required" }); return;
  }

  try {
    const guild = await db
      .select({ leaderId: guildsTable.leaderId, name: guildsTable.name, tag: guildsTable.tag })
      .from(guildsTable)
      .where(eq(guildsTable.id, guildId))
      .limit(1);
    if (!guild[0]) { res.status(404).json({ error: "Guild not found" }); return; }
    if (guild[0].leaderId !== userId) {
      res.status(403).json({ error: "Only the leader can start a guild sprint" }); return;
    }

    const writerName = await getWriterName(userId);
    const ALLOWED_MODES: RoomMode[] = ["regular", "open", "goal", "boss", "kart", "gladiator"];
    const requestedMode: RoomMode = (typeof mode === "string" && (ALLOWED_MODES as string[]).includes(mode))
      ? (mode as RoomMode)
      : "regular";
    const safeDelay = typeof countdownDelayMinutes === "number"
      ? Math.min(30, Math.max(0, Math.floor(countdownDelayMinutes)))
      : 0;
    const safeGoal = typeof wordGoal === "number" && wordGoal > 0 ? Math.floor(wordGoal) : null;
    const safeBossGoal = typeof bossWordGoal === "number" && bossWordGoal > 0 ? Math.floor(bossWordGoal) : null;
    const safeGladiatorGap = typeof gladiatorDeathGap === "number" && gladiatorDeathGap > 0 ? Math.floor(gladiatorDeathGap) : null;
    const safeDeathWpm = typeof deathModeWpm === "number" && deathModeWpm > 0 ? Math.floor(deathModeWpm) : null;
    const passwordHash = (typeof roomPassword === "string" && roomPassword.trim().length > 0)
      ? await bcrypt.hash(roomPassword.trim(), 10)
      : null;

    // Mirror /api/rooms normalization: a non-null bossWordGoal forces boss mode.
    // SprintPopup sends boss as { mode: "regular", bossWordGoal: 5000 } and relies
    // on the server to upgrade it.
    const effectiveMode: RoomMode = safeBossGoal ? "boss" : requestedMode;

    const room = createRoom(
      writerName,
      Math.floor(durationMinutes),
      effectiveMode,
      safeDelay,
      safeGoal,
      safeDeathWpm,
      safeBossGoal,
      passwordHash,
      safeGladiatorGap,
    );

    // Post a sprint announcement message that members can see in the panel.
    const payload = JSON.stringify({
      roomCode: room.code,
      durationMinutes: room.durationMinutes,
      mode: effectiveMode,
      wordGoal: safeGoal,
      startsInMinutes: safeDelay,
      startedAt: Date.now(),
    });
    await db.insert(guildMessagesTable).values({
      guildId,
      userId,
      writerName,
      content: payload,
      type: "sprint",
    });

    res.status(201).json({ roomCode: room.code, ...JSON.parse(payload) });
  } catch (err) { handleError(err, res); }
});

// ── GET /api/guilds/me/active-sprint — most recent sprint announcement ───
router.get("/guilds/me/active-sprint", async (req, res): Promise<void> => {
  const userId = requireAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  try {
    const membership = await getMyMembership(userId);
    if (!membership) { res.json({ sprint: null }); return; }

    const fiveMinAgo = new Date(Date.now() - 5 * 60_000);
    const rows = await db
      .select()
      .from(guildMessagesTable)
      .where(and(
        eq(guildMessagesTable.guildId, membership.guildId),
        eq(guildMessagesTable.type, "sprint"),
        gte(guildMessagesTable.sentAt, fiveMinAgo),
      ))
      .orderBy(desc(guildMessagesTable.sentAt))
      .limit(1);
    const row = rows[0];
    if (!row) { res.json({ sprint: null }); return; }
    let parsed: Record<string, unknown> = {};
    try { parsed = JSON.parse(row.content); } catch { /* ignore */ }
    res.json({
      sprint: {
        ...parsed,
        startedBy: row.writerName,
        sentAt: row.sentAt,
      },
    });
  } catch (err) { handleError(err, res); }
});

export default router;
