import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { createRoom, getRoom } from "../lib/roomManager";
import { saveWriting, getWriting, getUserSprints } from "../lib/writingStore";
import { CreateRoomBody, GetRoomParams } from "@workspace/api-zod";

const router: IRouter = Router();

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
  const room = createRoom(creatorName, durationMinutes, mode ?? "regular", countdownDelayMinutes, wordGoal);

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

  await saveWriting(code, participantName.trim(), text, wc, clerkUserId);
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

export default router;
