import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { pool } from "@workspace/db";

const router: IRouter = Router();

const DEFAULT_BAG_SLOTS = 20;

/**
 * Ensures an equipped_storage row exists for the user.
 * Returns the current row (item_id may be null = Cloth Bag).
 */
async function ensureEquippedStorage(client: import("pg").PoolClient, userId: string) {
  await client.query(
    `INSERT INTO equipped_storage (user_id, item_id, slot_count)
     VALUES ($1, NULL, 20)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId],
  );
  const { rows } = await client.query(
    `SELECT es.id, es.user_id, es.item_id, es.slot_count, es.equipped_at,
            im.name AS item_name, im.icon AS item_icon, im.rarity AS item_rarity
     FROM equipped_storage es
     LEFT JOIN items_master im ON im.id = es.item_id
     WHERE es.user_id = $1`,
    [userId],
  );
  return rows[0];
}

// ── GET /api/storage/equipped ─────────────────────────────────────────────────

router.get("/storage/equipped", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const client = await pool.connect();
  try {
    const equipped = await ensureEquippedStorage(client, userId);
    const { rows: countRows } = await client.query(
      `SELECT COUNT(*) AS cnt FROM user_inventory WHERE user_id = $1`,
      [userId],
    );
    const itemsUsed = Number((countRows[0] as { cnt: string }).cnt);

    res.json({ ...equipped, items_used: itemsUsed });
  } finally {
    client.release();
  }
});

// ── POST /api/storage/equip ───────────────────────────────────────────────────
// Body: { inventory_id: number }

router.post("/storage/equip", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { inventory_id } = req.body ?? {};
  if (!inventory_id) { res.status(400).json({ error: "inventory_id required" }); return; }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Step 1: Validate inventory row
    const { rows: invRows } = await client.query(
      `SELECT ui.id, ui.item_id,
              im.name, im.is_storage_item, im.storage_slot_count, im.rarity
       FROM user_inventory ui
       JOIN items_master im ON im.id = ui.item_id
       WHERE ui.id = $1 AND ui.user_id = $2`,
      [inventory_id, userId],
    );
    if (invRows.length === 0) {
      await client.query("ROLLBACK");
      res.status(404).json({ error: "Item not found in your bag" });
      return;
    }
    const inv = invRows[0] as {
      id: number; item_id: number;
      name: string; is_storage_item: boolean; storage_slot_count: number; rarity: string;
    };
    if (!inv.is_storage_item) {
      await client.query("ROLLBACK");
      res.status(400).json({ error: "This item cannot be equipped as storage" });
      return;
    }

    // Step 2: Get current equipped storage
    const equipped = await ensureEquippedStorage(client, userId) as {
      item_id: number | null; slot_count: number;
    };
    if (equipped.item_id === inv.item_id) {
      await client.query("ROLLBACK");
      res.status(400).json({ error: "This item is already equipped" });
      return;
    }

    // Step 3: Compute total slots (base bag + ring bonus, additive)
    const newSlots = DEFAULT_BAG_SLOTS + inv.storage_slot_count;
    const { rows: countRows } = await client.query(
      `SELECT COUNT(*) AS cnt FROM user_inventory WHERE user_id = $1`,
      [userId],
    );
    const currentItemCount = Number((countRows[0] as { cnt: string }).cnt);

    // The new item will leave inventory (freeing 1 slot), but the old item may come back (+1).
    // Net: current_item_count - 1 (removing new item) + (equipped.item_id != null ? 1 : 0) (returning old).
    const netAfterSwap = currentItemCount - 1 + (equipped.item_id !== null ? 1 : 0);

    if (netAfterSwap > newSlots) {
      await client.query("ROLLBACK");
      res.status(400).json({
        error: `You have ${netAfterSwap} items but ${inv.name} only holds ${newSlots} slots. Clear ${netAfterSwap - newSlots} item(s) before equipping.`,
      });
      return;
    }

    // Step 4: Return currently equipped item to bag (if not default)
    let previouslyEquipped: { name: string; item_id: number } | null = null;
    if (equipped.item_id !== null) {
      const { rows: prevRows } = await client.query(
        `SELECT im.name FROM items_master im WHERE im.id = $1`,
        [equipped.item_id],
      );
      previouslyEquipped = { name: (prevRows[0] as { name: string })?.name, item_id: equipped.item_id };
      // Return to bag (ingredient-style upsert)
      const { rows: existingInv } = await client.query(
        `SELECT id FROM user_inventory WHERE user_id = $1 AND item_id = $2 LIMIT 1`,
        [userId, equipped.item_id],
      );
      if (existingInv.length > 0) {
        await client.query(
          `UPDATE user_inventory SET quantity = quantity + 1 WHERE id = $1`,
          [existingInv[0].id],
        );
      } else {
        await client.query(
          `INSERT INTO user_inventory (user_id, item_id, quantity) VALUES ($1, $2, 1)`,
          [userId, equipped.item_id],
        );
      }
    }

    // Step 5: Update equipped_storage
    await client.query(
      `UPDATE equipped_storage SET item_id = $1, slot_count = $2, equipped_at = NOW()
       WHERE user_id = $3`,
      [inv.item_id, newSlots, userId],
    );

    // Step 6: Remove new item from bag
    const { rows: invCheck } = await client.query(
      `SELECT id, quantity FROM user_inventory WHERE id = $1`,
      [inventory_id],
    );
    if (invCheck.length > 0) {
      if ((invCheck[0] as { quantity: number }).quantity <= 1) {
        await client.query(`DELETE FROM user_inventory WHERE id = $1`, [inventory_id]);
      } else {
        await client.query(
          `UPDATE user_inventory SET quantity = quantity - 1 WHERE id = $1`,
          [inventory_id],
        );
      }
    }

    await client.query("COMMIT");
    res.json({
      new_slot_count: newSlots,
      previously_equipped_item: previouslyEquipped,
      equipped_item: { item_id: inv.item_id, name: inv.name, storage_slot_count: newSlots, rarity: inv.rarity },
    });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
});

// ── POST /api/storage/unequip ─────────────────────────────────────────────────
// Reverts to Cloth Bag (slot_count = 20, item_id = null).

router.post("/storage/unequip", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const equipped = await ensureEquippedStorage(client, userId) as {
      item_id: number | null; slot_count: number;
    };
    if (equipped.item_id === null) {
      await client.query("ROLLBACK");
      res.status(400).json({ error: "No storage item is currently equipped" });
      return;
    }

    const { rows: prevRows } = await client.query(
      `SELECT im.name, im.storage_slot_count FROM items_master im WHERE im.id = $1`,
      [equipped.item_id],
    );
    const prevItem = prevRows[0] as { name: string; storage_slot_count: number };

    // Check bag count vs Cloth Bag capacity (20)
    const { rows: countRows } = await client.query(
      `SELECT COUNT(*) AS cnt FROM user_inventory WHERE user_id = $1`,
      [userId],
    );
    const currentItemCount = Number((countRows[0] as { cnt: string }).cnt);
    // After unequip, old item goes back to bag: net = currentItemCount + 1
    const netAfterUnequip = currentItemCount + 1;
    if (netAfterUnequip > 20) {
      await client.query("ROLLBACK");
      res.status(400).json({
        error: `You have ${netAfterUnequip} items but your Cloth Bag only holds 20 slots. Clear ${netAfterUnequip - 20} item(s) first.`,
      });
      return;
    }

    // Return item to bag
    const { rows: existingInv } = await client.query(
      `SELECT id FROM user_inventory WHERE user_id = $1 AND item_id = $2 LIMIT 1`,
      [userId, equipped.item_id],
    );
    if (existingInv.length > 0) {
      await client.query(
        `UPDATE user_inventory SET quantity = quantity + 1 WHERE id = $1`,
        [existingInv[0].id],
      );
    } else {
      await client.query(
        `INSERT INTO user_inventory (user_id, item_id, quantity) VALUES ($1, $2, 1)`,
        [userId, equipped.item_id],
      );
    }

    // Reset to Cloth Bag
    await client.query(
      `UPDATE equipped_storage SET item_id = NULL, slot_count = 20, equipped_at = NOW()
       WHERE user_id = $1`,
      [userId],
    );

    await client.query("COMMIT");
    res.json({
      new_slot_count: 20,
      returned_item: { item_id: equipped.item_id, name: prevItem.name },
    });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
});

export default router;
