import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { db, folioStateTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/folio", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [row] = await db.select().from(folioStateTable).where(eq(folioStateTable.userId, userId));

  if (!row) {
    res.json({ state: { projects: [] }, updatedAt: null });
    return;
  }

  res.json({ state: row.state, updatedAt: row.updatedAt.toISOString() });
});

router.put("/folio", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { state } = req.body ?? {};
  if (state == null) { res.status(400).json({ error: "state required" }); return; }

  const now = new Date();

  await db.insert(folioStateTable)
    .values({ userId, state, updatedAt: now })
    .onConflictDoUpdate({
      target: [folioStateTable.userId],
      set: { state, updatedAt: now },
    });

  req.log.info({ userId }, "Folio state saved");
  res.json({ ok: true, updatedAt: now.toISOString() });
});

export default router;
