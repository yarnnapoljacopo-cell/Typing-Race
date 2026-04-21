import { db, sprintWritingTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "./logger";

export async function saveWriting(
  roomCode: string,
  participantName: string,
  text: string,
  wordCount: number,
): Promise<void> {
  try {
    await db
      .insert(sprintWritingTable)
      .values({ roomCode, participantName, text, wordCount })
      .onConflictDoUpdate({
        target: [sprintWritingTable.roomCode, sprintWritingTable.participantName],
        set: { text, wordCount, updatedAt: new Date() },
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
