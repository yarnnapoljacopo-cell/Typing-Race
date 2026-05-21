import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { db, folioStateTable, folioSnapshotsTable } from "@workspace/db";
import { eq, desc, sql, and } from "drizzle-orm";

const router: IRouter = Router();

/** Max versioned snapshots kept per user. */
const MAX_SNAPSHOTS = 20;
/** Minimum gap between snapshots (ms). One snapshot per 5 minutes of writing. */
const SNAPSHOT_INTERVAL_MS = 5 * 60 * 1000;

router.get("/folio", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [row] = await db.select().from(folioStateTable).where(eq(folioStateTable.userId, userId));

  if (!row) {
    res.json({ state: null, updatedAt: null });
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

  // Save main state (upsert).
  await db.insert(folioStateTable)
    .values({ userId, state, updatedAt: now })
    .onConflictDoUpdate({
      target: [folioStateTable.userId],
      set: { state, updatedAt: now },
    });

  // Versioned snapshot — fire-and-forget, never blocks the response.
  // Writes one snapshot per SNAPSHOT_INTERVAL_MS and trims the oldest
  // rows beyond MAX_SNAPSHOTS so the table stays bounded.
  setImmediate(async () => {
    try {
      const [latest] = await db
        .select({ savedAt: folioSnapshotsTable.savedAt })
        .from(folioSnapshotsTable)
        .where(eq(folioSnapshotsTable.userId, userId))
        .orderBy(desc(folioSnapshotsTable.savedAt))
        .limit(1);

      const needsSnapshot =
        !latest || now.getTime() - latest.savedAt.getTime() >= SNAPSHOT_INTERVAL_MS;

      if (needsSnapshot) {
        await db.insert(folioSnapshotsTable).values({ userId, savedAt: now, state });

        // Prune: keep only the most recent MAX_SNAPSHOTS rows.
        await db.execute(sql`
          DELETE FROM folio_snapshots
          WHERE user_id = ${userId}
            AND id NOT IN (
              SELECT id FROM folio_snapshots
              WHERE user_id = ${userId}
              ORDER BY saved_at DESC
              LIMIT ${MAX_SNAPSHOTS}
            )
        `);
      }
    } catch (err) {
      req.log.warn({ userId, err }, "Folio snapshot write failed (non-fatal)");
    }
  });

  req.log.info({ userId }, "Folio state saved");
  res.json({ ok: true, updatedAt: now.toISOString() });
});

/** List the most recent snapshots (metadata only, no full state blob). */
router.get("/folio/snapshots", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const rows = await db
    .select({ id: folioSnapshotsTable.id, savedAt: folioSnapshotsTable.savedAt })
    .from(folioSnapshotsTable)
    .where(eq(folioSnapshotsTable.userId, userId))
    .orderBy(desc(folioSnapshotsTable.savedAt))
    .limit(MAX_SNAPSHOTS);

  res.json({ snapshots: rows.map((r) => ({ id: r.id, savedAt: r.savedAt.toISOString() })) });
});

/** Restore a specific snapshot — overwrites the current state. */
router.post("/folio/snapshots/:id/restore", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid snapshot id" }); return; }

  const [snap] = await db
    .select()
    .from(folioSnapshotsTable)
    .where(and(eq(folioSnapshotsTable.id, id), eq(folioSnapshotsTable.userId, userId)))
    .limit(1);

  if (!snap) { res.status(404).json({ error: "Snapshot not found" }); return; }

  // Write the snapshot state back as the live state.
  const now = new Date();
  await db.insert(folioStateTable)
    .values({ userId, state: snap.state, updatedAt: now })
    .onConflictDoUpdate({
      target: [folioStateTable.userId],
      set: { state: snap.state, updatedAt: now },
    });

  res.json({ ok: true, restoredAt: now.toISOString() });
});

export default router;
