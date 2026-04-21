import { db, sprintWritingTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { logger } from "./logger";

export async function saveWriting(
  roomCode: string,
  participantName: string,
  text: string,
  wordCount: number,
  clerkUserId?: string | null,
): Promise<void> {
  try {
    await db
      .insert(sprintWritingTable)
      .values({ roomCode, participantName, clerkUserId: clerkUserId ?? null, text, wordCount })
      .onConflictDoUpdate({
        target: [sprintWritingTable.roomCode, sprintWritingTable.participantName],
        set: {
          text,
          wordCount,
          updatedAt: new Date(),
          ...(clerkUserId ? { clerkUserId } : {}),
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
  updatedAt: Date;
  excerpt: string;
}>> {
  try {
    const rows = await db
      .select()
      .from(sprintWritingTable)
      .where(eq(sprintWritingTable.clerkUserId, clerkUserId))
      .orderBy(desc(sprintWritingTable.updatedAt));

    return rows.map((r) => ({
      id: r.id,
      roomCode: r.roomCode,
      participantName: r.participantName,
      wordCount: r.wordCount,
      updatedAt: r.updatedAt,
      excerpt: r.text.slice(0, 200),
    }));
  } catch (err) {
    logger.error({ err, clerkUserId }, "Failed to fetch user sprints");
    return [];
  }
}
