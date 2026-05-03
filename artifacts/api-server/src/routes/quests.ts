import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { listUserQuests, claimQuest, describeReward } from "../lib/quests";

const router: IRouter = Router();

// ── GET /api/user/quests ─────────────────────────────────────────────────────
//
// Returns the player's currently rolled daily + weekly quests (3 of each).
// Quests are auto-rolled the first time the user hits this endpoint in any
// new period (UTC day for daily, ISO week for weekly).
router.get("/user/quests", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  try {
    const quests = await listUserQuests(userId);
    res.json({
      quests: quests.map((q) => ({ ...q, rewardLabel: describeReward(q.reward) })),
    });
  } catch (err) {
    req.log.error({ err }, "GET /user/quests failed");
    res.status(500).json({ error: "Failed to load quests" });
  }
});

// ── POST /api/user/quests/:questId/claim ─────────────────────────────────────
router.post("/user/quests/:questId/claim", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const questId = req.params.questId;
  if (!questId || typeof questId !== "string") {
    res.status(400).json({ error: "Missing questId" }); return;
  }

  const result = await claimQuest(userId, questId);
  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  res.json({
    ok: true,
    reward: result.reward,
    rewardLabel: describeReward(result.reward),
    newCoinBalance: result.newCoinBalance,
    newXp: result.newXp,
  });
});

export default router;
