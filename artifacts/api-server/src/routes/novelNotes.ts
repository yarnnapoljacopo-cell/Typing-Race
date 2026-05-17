import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { db, novelNotesStateTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/novel-notes", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [row] = await db.select().from(novelNotesStateTable).where(eq(novelNotesStateTable.userId, userId));

  if (!row) {
    res.json({ nnData: null, updatedAt: null });
    return;
  }

  res.json({ nnData: row.nnData, updatedAt: row.updatedAt.toISOString() });
});

router.put("/novel-notes", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { nnData } = req.body ?? {};
  if (nnData == null) { res.status(400).json({ error: "nnData required" }); return; }

  const now = new Date();

  await db.insert(novelNotesStateTable)
    .values({ userId, nnData, updatedAt: now })
    .onConflictDoUpdate({
      target: [novelNotesStateTable.userId],
      set: { nnData, updatedAt: now },
    });

  req.log.info({ userId }, "Novel Notes state saved");
  res.json({ ok: true, updatedAt: now.toISOString() });
});

export default router;
