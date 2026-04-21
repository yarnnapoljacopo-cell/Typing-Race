import { db, sprintWritingTable } from "@workspace/db";
import { eq, and, desc, inArray } from "drizzle-orm";
import { logger } from "./logger";

export async function saveWriting(
  roomCode: string,
  participantName: string,
  text: string,
  wordCount: number,
  clerkUserId?: string | null,
  roomMode?: string | null,
  wordGoal?: number | null,
): Promise<void> {
  try {
    await db
      .insert(sprintWritingTable)
      .values({
        roomCode,
        participantName,
        clerkUserId: clerkUserId ?? null,
        text,
        wordCount,
        roomMode: roomMode ?? "regular",
        wordGoal: wordGoal ?? null,
      })
      .onConflictDoUpdate({
        target: [sprintWritingTable.roomCode, sprintWritingTable.participantName],
        set: {
          text,
          wordCount,
          updatedAt: new Date(),
          ...(clerkUserId ? { clerkUserId } : {}),
          ...(roomMode ? { roomMode } : {}),
          ...(wordGoal != null ? { wordGoal } : {}),
        },
      });
  } catch (err) {
    logger.error({ err, roomCode, participantName }, "Failed to save writing to DB");
  }
}

export async function getWriting(
  roomCode: string,
  participantName: string,
): Promise<{ text: string; wordCount: number } | null> {
  try {
    const rows = await db
      .select()
      .from(sprintWritingTable)
      .where(
        and(
          eq(sprintWritingTable.roomCode, roomCode),
          eq(sprintWritingTable.participantName, participantName),
        ),
      )
      .limit(1);

    if (rows.length === 0) return null;
    return { text: rows[0].text, wordCount: rows[0].wordCount };
  } catch (err) {
    logger.error({ err, roomCode, participantName }, "Failed to fetch writing from DB");
    return null;
  }
}

export async function getUserSprints(clerkUserId: string): Promise<Array<{
  id: number;
  roomCode: string;
  participantName: string;
  wordCount: number;
  rank: number;
  totalParticipants: number;
  updatedAt: Date;
  excerpt: string;
  roomMode: string;
  wordGoal: number | null;
}>> {
  try {
    const rows = await db
      .select()
      .from(sprintWritingTable)
      .where(eq(sprintWritingTable.clerkUserId, clerkUserId))
      .orderBy(desc(sprintWritingTable.updatedAt));

    if (rows.length === 0) return [];

    const roomCodes = [...new Set(rows.map((r) => r.roomCode))];
    const allRoomRows = await db
      .select({ roomCode: sprintWritingTable.roomCode, wordCount: sprintWritingTable.wordCount })
      .from(sprintWritingTable)
      .where(inArray(sprintWritingTable.roomCode, roomCodes));

    const roomMap = new Map<string, number[]>();
    for (const r of allRoomRows) {
      if (!roomMap.has(r.roomCode)) roomMap.set(r.roomCode, []);
      roomMap.get(r.roomCode)!.push(r.wordCount);
    }

    return rows.map((r) => {
      const counts = (roomMap.get(r.roomCode) ?? []).slice().sort((a, b) => b - a);
      const rank = counts.findIndex((wc) => wc <= r.wordCount) + 1 || counts.length;
      return {
        id: r.id,
        roomCode: r.roomCode,
        participantName: r.participantName,
        wordCount: r.wordCount,
        rank,
        totalParticipants: counts.length,
        updatedAt: r.updatedAt,
        excerpt: r.text.slice(0, 200),
        roomMode: r.roomMode,
        wordGoal: r.wordGoal ?? null,
      };
    });
  } catch (err) {
    logger.error({ err, clerkUserId }, "Failed to fetch user sprints");
    return [];
  }
}
