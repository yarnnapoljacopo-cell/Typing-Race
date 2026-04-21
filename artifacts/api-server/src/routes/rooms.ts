import { Router, type IRouter } from "express";
import { createRoom, getRoom } from "../lib/roomManager";
import { saveWriting, getWriting } from "../lib/writingStore";
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

  await saveWriting(code, participantName.trim(), text, wc);
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

export default router;
