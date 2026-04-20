import { Router, type IRouter } from "express";
import { createRoom, getRoom } from "../lib/roomManager";
import { CreateRoomBody, GetRoomParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/rooms", async (req, res): Promise<void> => {
  const parsed = CreateRoomBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { creatorName, durationMinutes } = parsed.data;
  const room = createRoom(creatorName, durationMinutes);

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

export default router;
