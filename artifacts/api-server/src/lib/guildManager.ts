import {
  db,
  guildsTable,
  guildMembersTable,
  guildMessagesTable,
  guildInvitesTable,
} from "@workspace/db";
import { eq, and, count, sql } from "drizzle-orm";

const MAX_MEMBERS = 20;
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export class GuildError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function createGuild(
  leaderId: string,
  name: string,
  tag: string,
  description: string,
): Promise<{ id: number; name: string; tag: string }> {
  const trimmedName = (name ?? "").trim();
  const trimmedTag = (tag ?? "").trim().toUpperCase();
  if (trimmedName.length < 2 || trimmedName.length > 40) {
    throw new GuildError("Guild name must be 2–40 characters");
  }
  if (trimmedTag.length < 2 || trimmedTag.length > 6) {
    throw new GuildError("Guild tag must be 2–6 characters");
  }

  // Block creating a guild if the user is already in one
  const existing = await db
    .select({ guildId: guildMembersTable.guildId })
    .from(guildMembersTable)
    .where(eq(guildMembersTable.userId, leaderId))
    .limit(1);
  if (existing.length > 0) {
    throw new GuildError("You are already in a guild", 409);
  }

  // Check name uniqueness up front to give a friendly error
  const dupe = await db
    .select({ id: guildsTable.id })
    .from(guildsTable)
    .where(eq(guildsTable.name, trimmedName))
    .limit(1);
  if (dupe.length > 0) {
    throw new GuildError("A guild with that name already exists", 409);
  }

  return await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(guildsTable)
      .values({
        name: trimmedName,
        tag: trimmedTag,
        leaderId,
        description: (description ?? "").slice(0, 1000),
      })
      .returning({ id: guildsTable.id, name: guildsTable.name, tag: guildsTable.tag });

    const guild = inserted[0];
    await tx.insert(guildMembersTable).values({
      guildId: guild.id,
      userId: leaderId,
      role: "leader",
    });

    return { id: guild.id, name: guild.name, tag: guild.tag };
  });
}

export async function inviteMember(
  guildId: number,
  inviterId: string,
  inviteeId: string,
): Promise<{ inviteId: number }> {
  // Verify caller is the leader
  const guild = await db
    .select({ leaderId: guildsTable.leaderId })
    .from(guildsTable)
    .where(eq(guildsTable.id, guildId))
    .limit(1);
  if (!guild[0]) throw new GuildError("Guild not found", 404);
  if (guild[0].leaderId !== inviterId) {
    throw new GuildError("Only the leader can invite members", 403);
  }

  // Capacity check
  const memberCount = await db
    .select({ c: count() })
    .from(guildMembersTable)
    .where(eq(guildMembersTable.guildId, guildId));
  if ((memberCount[0]?.c ?? 0) >= MAX_MEMBERS) {
    throw new GuildError(`Guild is full (max ${MAX_MEMBERS} members)`, 409);
  }

  // Invitee must not already be in any guild
  const inGuild = await db
    .select({ guildId: guildMembersTable.guildId })
    .from(guildMembersTable)
    .where(eq(guildMembersTable.userId, inviteeId))
    .limit(1);
  if (inGuild.length > 0) {
    throw new GuildError("That writer is already in a guild", 409);
  }

  // Avoid duplicate pending invites
  const existing = await db
    .select({ id: guildInvitesTable.id })
    .from(guildInvitesTable)
    .where(
      and(
        eq(guildInvitesTable.guildId, guildId),
        eq(guildInvitesTable.inviteeId, inviteeId),
        eq(guildInvitesTable.status, "pending"),
      ),
    )
    .limit(1);
  if (existing.length > 0) {
    return { inviteId: existing[0].id };
  }

  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
  const inserted = await db
    .insert(guildInvitesTable)
    .values({ guildId, inviteeId, invitedBy: inviterId, expiresAt })
    .returning({ id: guildInvitesTable.id });
  return { inviteId: inserted[0].id };
}

export async function acceptInvite(
  inviteId: number,
  userId: string,
): Promise<{ guildId: number }> {
  return await db.transaction(async (tx) => {
    // Atomically claim the invite: succeeds only if it's still pending.
    const claimed = await tx
      .update(guildInvitesTable)
      .set({ status: "accepted" })
      .where(
        and(
          eq(guildInvitesTable.id, inviteId),
          eq(guildInvitesTable.status, "pending"),
        ),
      )
      .returning({
        guildId: guildInvitesTable.guildId,
        inviteeId: guildInvitesTable.inviteeId,
        expiresAt: guildInvitesTable.expiresAt,
      });
    const invite = claimed[0];
    if (!invite) throw new GuildError("Invite is no longer pending", 410);
    if (invite.inviteeId !== userId) throw new GuildError("Not your invite", 403);
    if (invite.expiresAt.getTime() < Date.now()) {
      throw new GuildError("Invite has expired", 410);
    }

    // User must not already belong to a guild
    const existing = await tx
      .select({ guildId: guildMembersTable.guildId })
      .from(guildMembersTable)
      .where(eq(guildMembersTable.userId, userId))
      .limit(1);
    if (existing.length > 0) {
      throw new GuildError("You are already in a guild", 409);
    }

    // Capacity re-check at accept time
    const memberCount = await tx
      .select({ c: count() })
      .from(guildMembersTable)
      .where(eq(guildMembersTable.guildId, invite.guildId));
    if ((memberCount[0]?.c ?? 0) >= MAX_MEMBERS) {
      throw new GuildError(`Guild is full (max ${MAX_MEMBERS} members)`, 409);
    }

    await tx.insert(guildMembersTable).values({
      guildId: invite.guildId,
      userId,
      role: "member",
    });

    return { guildId: invite.guildId };
  });
}

export async function declineInvite(inviteId: number, userId: string): Promise<void> {
  const rows = await db
    .select({ inviteeId: guildInvitesTable.inviteeId, status: guildInvitesTable.status })
    .from(guildInvitesTable)
    .where(eq(guildInvitesTable.id, inviteId))
    .limit(1);
  const invite = rows[0];
  if (!invite) throw new GuildError("Invite not found", 404);
  if (invite.inviteeId !== userId) throw new GuildError("Not your invite", 403);
  if (invite.status !== "pending") throw new GuildError("Invite is no longer pending", 410);

  await db
    .update(guildInvitesTable)
    .set({ status: "declined" })
    .where(eq(guildInvitesTable.id, inviteId));
}

export async function kickMember(
  guildId: number,
  leaderId: string,
  targetId: string,
  leaderName: string,
  targetName: string,
): Promise<void> {
  if (leaderId === targetId) {
    throw new GuildError("Use 'leave' to remove yourself", 400);
  }
  const guild = await db
    .select({ leaderId: guildsTable.leaderId })
    .from(guildsTable)
    .where(eq(guildsTable.id, guildId))
    .limit(1);
  if (!guild[0]) throw new GuildError("Guild not found", 404);
  if (guild[0].leaderId !== leaderId) {
    throw new GuildError("Only the leader can kick members", 403);
  }

  await db
    .delete(guildMembersTable)
    .where(and(eq(guildMembersTable.guildId, guildId), eq(guildMembersTable.userId, targetId)));

  await db.insert(guildMessagesTable).values({
    guildId,
    userId: leaderId,
    writerName: leaderName,
    content: `${targetName} was removed from the guild by ${leaderName}.`,
    type: "system",
  });
}

export async function leaveGuild(guildId: number, userId: string): Promise<void> {
  const guild = await db
    .select({ leaderId: guildsTable.leaderId })
    .from(guildsTable)
    .where(eq(guildsTable.id, guildId))
    .limit(1);
  if (!guild[0]) throw new GuildError("Guild not found", 404);
  if (guild[0].leaderId === userId) {
    throw new GuildError(
      "Leaders must transfer leadership before leaving",
      409,
    );
  }
  // Verify membership first so non-members can't trigger side effects
  // (e.g., chat system messages) on guilds they don't belong to.
  const member = await db
    .select({ userId: guildMembersTable.userId })
    .from(guildMembersTable)
    .where(and(eq(guildMembersTable.guildId, guildId), eq(guildMembersTable.userId, userId)))
    .limit(1);
  if (!member[0]) throw new GuildError("You are not in this guild", 403);

  await db
    .delete(guildMembersTable)
    .where(and(eq(guildMembersTable.guildId, guildId), eq(guildMembersTable.userId, userId)));
}

export async function transferLeadership(
  guildId: number,
  currentLeaderId: string,
  newLeaderId: string,
): Promise<void> {
  if (currentLeaderId === newLeaderId) {
    throw new GuildError("You are already the leader", 400);
  }
  const guild = await db
    .select({ leaderId: guildsTable.leaderId })
    .from(guildsTable)
    .where(eq(guildsTable.id, guildId))
    .limit(1);
  if (!guild[0]) throw new GuildError("Guild not found", 404);
  if (guild[0].leaderId !== currentLeaderId) {
    throw new GuildError("Only the leader can transfer leadership", 403);
  }
  // Verify new leader is a member
  const newMember = await db
    .select({ userId: guildMembersTable.userId })
    .from(guildMembersTable)
    .where(and(eq(guildMembersTable.guildId, guildId), eq(guildMembersTable.userId, newLeaderId)))
    .limit(1);
  if (!newMember[0]) throw new GuildError("That writer is not in the guild", 404);

  await db.transaction(async (tx) => {
    await tx
      .update(guildMembersTable)
      .set({ role: "member" })
      .where(and(eq(guildMembersTable.guildId, guildId), eq(guildMembersTable.userId, currentLeaderId)));
    await tx
      .update(guildMembersTable)
      .set({ role: "leader" })
      .where(and(eq(guildMembersTable.guildId, guildId), eq(guildMembersTable.userId, newLeaderId)));
    await tx
      .update(guildsTable)
      .set({ leaderId: newLeaderId })
      .where(eq(guildsTable.id, guildId));
  });
}

export async function disbandGuild(guildId: number, leaderId: string): Promise<void> {
  const guild = await db
    .select({ leaderId: guildsTable.leaderId })
    .from(guildsTable)
    .where(eq(guildsTable.id, guildId))
    .limit(1);
  if (!guild[0]) throw new GuildError("Guild not found", 404);
  if (guild[0].leaderId !== leaderId) {
    throw new GuildError("Only the leader can disband the guild", 403);
  }
  await db.delete(guildsTable).where(eq(guildsTable.id, guildId));
}

export async function pruneOldMessages(guildId: number, keep = 200): Promise<void> {
  // Keep only the newest `keep` messages — delete everything older.
  await db.execute(sql`
    DELETE FROM guild_messages
    WHERE guild_id = ${guildId}
      AND id NOT IN (
        SELECT id FROM guild_messages
        WHERE guild_id = ${guildId}
        ORDER BY sent_at DESC
        LIMIT ${keep}
      )
  `);
}
