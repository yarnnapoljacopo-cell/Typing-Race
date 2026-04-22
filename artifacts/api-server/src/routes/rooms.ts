import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { createRoom, getRoom, getActiveRooms } from "../lib/roomManager";
import { saveWriting, getWriting, getUserSprints } from "../lib/writingStore";
import { CreateRoomBody, GetRoomParams } from "@workspace/api-zod";
import { db, userProfilesTable, sprintWritingTable } from "@workspace/db";
import { eq, and, desc, sql, max, sum, count } from "drizzle-orm";

const router: IRouter = Router();

router.get("/rooms", async (_req, res): Promise<void> => {
  res.json(getActiveRooms());
});

router.post("/rooms", async (req, res): Promise<void> => {
  const parsed = CreateRoomBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { creatorName, durationMinutes, mode } = parsed.data;
  const rawBody = req.body as Record<string, unknown>;
  const rawDelay = rawBody.countdownDelayMinutes;
  const countdownDelayMinutes = typeof rawDelay === "number"
    ? Math.min(30, Math.max(0, Math.floor(rawDelay)))
    : 0;
  const rawGoal = rawBody.wordGoal;
  const wordGoal = typeof rawGoal === "number" && rawGoal > 0 ? Math.floor(rawGoal) : null;
  const rawDeathWpm = rawBody.deathModeWpm;
  const deathModeWpm = typeof rawDeathWpm === "number" ? rawDeathWpm : null;
  const room = createRoom(creatorName, durationMinutes, mode ?? "regular", countdownDelayMinutes, wordGoal, deathModeWpm);

  res.status(201).json({
    code: room.code,
    creatorName: room.creatorName,
    durationMinutes: room.durationMinutes,
    status: room.status,
    participantCount: room.participants.size,
  });
});

router.get("/rooms/:code", async (req, res): Promise<void> => {
  const params = GetRoomParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const room = getRoom(params.data.code.toUpperCase());
  if (!room) {
    res.status(404).json({ error: "Room not found" });
    return;
  }

  res.json({
    code: room.code,
    creatorName: room.creatorName,
    durationMinutes: room.durationMinutes,
    status: room.status,
    participantCount: room.participants.size,
  });
});

router.put("/rooms/:code/writing", async (req, res): Promise<void> => {
  const code = req.params.code?.toUpperCase();
  if (!code) { res.status(400).json({ error: "Missing code" }); return; }

  const { participantName, text, wordCount } = req.body ?? {};
  if (typeof participantName !== "string" || !participantName.trim()) {
    res.status(400).json({ error: "participantName required" }); return;
  }
  if (typeof text !== "string") { res.status(400).json({ error: "text required" }); return; }
  const wc = typeof wordCount === "number" ? Math.max(0, Math.floor(wordCount)) : 0;

  const auth = getAuth(req);
  const clerkUserId = auth?.userId ?? null;

  const room = getRoom(code);
  await saveWriting(code, participantName.trim(), text, wc, clerkUserId, room?.mode ?? null, room?.wordGoal ?? null);
  res.json({ ok: true });
});

router.get("/rooms/:code/writing/:participantName", async (req, res): Promise<void> => {
  const code = req.params.code?.toUpperCase();
  const participantName = req.params.participantName;
  if (!code || !participantName) { res.status(400).json({ error: "Missing params" }); return; }

  const result = await getWriting(code, participantName);
  if (!result) { res.status(404).json({ error: "Not found" }); return; }
  res.json(result);
});

router.get("/user/sprints", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const sprints = await getUserSprints(clerkUserId);
  res.json(sprints);
});

router.get("/user/sprints/:id/text", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const { db, sprintWritingTable } = await import("@workspace/db");
  const { eq, and } = await import("drizzle-orm");
  const rows = await db
    .select({ text: sprintWritingTable.text, clerkUserId: sprintWritingTable.clerkUserId })
    .from(sprintWritingTable)
    .where(and(eq(sprintWritingTable.id, id), eq(sprintWritingTable.clerkUserId, clerkUserId)))
    .limit(1);

  if (rows.length === 0) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  res.json({ text: rows[0].text });
});

function htmlToPlain(html: string): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

router.get("/user/files", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const rows = await db
    .select()
    .from(sprintWritingTable)
    .where(and(eq(sprintWritingTable.clerkUserId, clerkUserId), eq(sprintWritingTable.savedToFiles, true)))
    .orderBy(desc(sprintWritingTable.updatedAt));

  res.json(rows.map((r) => ({
    id: r.id,
    roomCode: r.roomCode,
    participantName: r.participantName,
    wordCount: r.wordCount,
    updatedAt: r.updatedAt,
    excerpt: htmlToPlain(r.text).slice(0, 200),
  })));
});

router.post("/user/files", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { roomCode, participantName, text, wordCount } = req.body ?? {};
  if (!roomCode || !participantName || typeof text !== "string") {
    res.status(400).json({ error: "roomCode, participantName, and text are required" }); return;
  }
  const wc = typeof wordCount === "number" ? Math.max(0, Math.floor(wordCount)) : 0;

  await db
    .insert(sprintWritingTable)
    .values({ roomCode, participantName, clerkUserId, text, wordCount: wc, savedToFiles: true })
    .onConflictDoUpdate({
      target: [sprintWritingTable.roomCode, sprintWritingTable.participantName],
      set: { savedToFiles: true, clerkUserId, text, wordCount: wc, updatedAt: new Date() },
    });

  res.json({ ok: true });
});

router.delete("/user/sprints/:id", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  await db
    .delete(sprintWritingTable)
    .where(and(eq(sprintWritingTable.id, id), eq(sprintWritingTable.clerkUserId, clerkUserId)));

  res.json({ ok: true });
});

router.delete("/user/files/:id", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  await db
    .update(sprintWritingTable)
    .set({ savedToFiles: false })
    .where(and(eq(sprintWritingTable.id, id), eq(sprintWritingTable.clerkUserId, clerkUserId)));

  res.json({ ok: true });
});

router.get("/user/profile", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  console.log("[auth-debug] getAuth result:", JSON.stringify({ userId: auth?.userId, sessionId: auth?.sessionId, hasClaims: !!auth?.sessionClaims, cookie: req.headers.cookie ? "present" : "absent", authorization: req.headers.authorization ? "present" : "absent" }));
  const clerkUserId = auth?.userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const rows = await db
    .select()
    .from(userProfilesTable)
    .where(eq(userProfilesTable.clerkUserId, clerkUserId))
    .limit(1);

  res.json({ writerName: rows[0]?.writerName ?? null });
});

router.put("/user/profile", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { writerName } = req.body ?? {};
  if (typeof writerName !== "string" || writerName.trim().length < 2 || writerName.trim().length > 40) {
    res.status(400).json({ error: "Writer name must be 2–40 characters." });
    return;
  }

  const name = writerName.trim();

  await db
    .insert(userProfilesTable)
    .values({ clerkUserId, writerName: name })
    .onConflictDoUpdate({
      target: [userProfilesTable.clerkUserId],
      set: { writerName: name, updatedAt: new Date() },
    });

  res.json({ writerName: name });
});

router.get("/users/by-name/:name/profile", async (req, res): Promise<void> => {
  const name = decodeURIComponent(req.params.name ?? "").trim();
  if (!name) { res.status(400).json({ error: "Missing name" }); return; }

  const [statsRow] = await db
    .select({
      totalWords: sum(sprintWritingTable.wordCount),
      highestWordCount: max(sprintWritingTable.wordCount),
      sprintCount: count(),
    })
    .from(sprintWritingTable)
    .where(eq(sprintWritingTable.participantName, name));

  const profileRows = await db
    .select()
    .from(userProfilesTable)
    .where(eq(userProfilesTable.writerName, name))
    .limit(1);

  res.json({
    name,
    writerName: profileRows[0]?.writerName ?? name,
    totalWords: Number(statsRow?.totalWords ?? 0),
    highestWordCount: Number(statsRow?.highestWordCount ?? 0),
    sprintCount: Number(statsRow?.sprintCount ?? 0),
  });
});

export default router;
