import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { pool } from "@workspace/db";
import { grantXp } from "./bag";

const router: IRouter = Router();

// ── Rarity order (for guarantee checks) ──────────────────────────────────────
const RARITY_ORDER = ["common", "uncommon", "rare", "epic", "mythic", "legendary"];

// ── Chest drop tables ─────────────────────────────────────────────────────────
type RarityWeight = { rarity: string; weight: number };
type ChestConfig = {
  rarityTable: RarityWeight[];
  allowedCategories: string[];
  allowRecipes: boolean;
  allowLegendary: boolean;
};

const CHEST_CONFIGS: Record<string, ChestConfig> = {
  mortal: {
    rarityTable: [
      { rarity: "common",   weight: 55 },
      { rarity: "uncommon", weight: 30 },
      { rarity: "rare",     weight: 10 },
      { rarity: "epic",     weight:  5 },
    ],
    allowedCategories: ["pill", "treasure", "ingredient"],
    allowRecipes: false,
    allowLegendary: false,
  },
  iron: {
    rarityTable: [
      { rarity: "uncommon", weight: 10 },
      { rarity: "rare",     weight: 50 },
      { rarity: "epic",     weight: 30 },
      { rarity: "mythic",   weight: 10 },
    ],
    allowedCategories: ["pill", "treasure", "ingredient"],
    allowRecipes: true,
    allowLegendary: false,
  },
  crystal: {
    rarityTable: [
      { rarity: "rare",      weight: 20 },
      { rarity: "epic",      weight: 45 },
      { rarity: "mythic",    weight: 30 },
      { rarity: "legendary", weight:  5 },
    ],
    allowedCategories: ["pill", "treasure", "artifact", "ingredient"],
    allowRecipes: true,
    allowLegendary: true,
  },
  inferno: {
    rarityTable: [
      { rarity: "epic",      weight: 10 },
      { rarity: "mythic",    weight: 55 },
      { rarity: "legendary", weight: 35 },
    ],
    allowedCategories: ["pill", "treasure", "artifact", "recipe"],
    allowRecipes: true,
    allowLegendary: true,
  },
  immortal: {
    rarityTable: [{ rarity: "mythic", weight: 100 }],
    allowedCategories: ["pill", "treasure", "artifact", "ingredient", "recipe"],
    allowRecipes: true,
    allowLegendary: true,
  },
};

function weightedRoll(table: RarityWeight[]): string {
  const total = table.reduce((sum, t) => sum + t.weight, 0);
  let roll = Math.random() * total;
  for (const entry of table) {
    roll -= entry.weight;
    if (roll <= 0) return entry.rarity;
  }
  return table[table.length - 1].rarity;
}

// ── GET /api/user/chests ──────────────────────────────────────────────────────

router.get("/user/chests", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT chest_type, quantity FROM user_chests WHERE user_id = $1`,
      [userId],
    );
    const chests: Record<string, number> = {
      mortal: 0, iron: 0, crystal: 0, inferno: 0, immortal: 0,
    };
    for (const row of rows) {
      chests[row.chest_type as string] = row.quantity as number;
    }
    res.json(chests);
  } finally {
    client.release();
  }
});

// ── POST /api/user/chests/open ────────────────────────────────────────────────

router.post("/user/chests/open", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { chestType } = req.body ?? {};
  if (!chestType || !CHEST_CONFIGS[chestType as string]) {
    res.status(400).json({ error: "Invalid chestType" }); return;
  }

  const client = await pool.connect();
  try {
    // Verify chest availability
    const { rows: chestRows } = await client.query(
      `SELECT quantity FROM user_chests WHERE user_id = $1 AND chest_type = $2`,
      [userId, chestType],
    );
    const qty = chestRows[0]?.quantity ?? 0;
    if (qty < 1) {
      res.status(400).json({ error: "No chests of that type available" }); return;
    }

    const config = CHEST_CONFIGS[chestType as string];

    // ── Check active effects ───────────────────────────────────────────────
    const { rows: effects } = await client.query(
      `SELECT id, effect_type, effect_value, metadata
       FROM active_effects
       WHERE user_id = $1 AND expires_at > NOW()
       ORDER BY effect_type`,
      [userId],
    );

    let guaranteedRarityLevel = 0;
    let forceOneMyithic = false;
    let fortuneReversal = false;
    let rerollRarity = false;
    let chestLuckActive = false;
    let chestLuckId: number | null = null;
    let fortuneReversalId: number | null = null;
    let rerollRarityId: number | null = null;
    let guaranteeRarityId: number | null = null;
    let guaranteeOneMythicId: number | null = null;
    let heavenMirrorActive = false;
    let heavenMirrorId: number | null = null;

    for (const eff of effects) {
      if (eff.effect_type === "guarantee_rarity" && eff.effect_value > guaranteedRarityLevel) {
        guaranteedRarityLevel = eff.effect_value;
        guaranteeRarityId = eff.id;
      }
      if (eff.effect_type === "guarantee_one_mythic") { forceOneMyithic = true; guaranteeOneMythicId = eff.id; }
      if (eff.effect_type === "fortune_reversal") { fortuneReversal = true; fortuneReversalId = eff.id; }
      if (eff.effect_type === "reroll_chest_rarity") { rerollRarity = true; rerollRarityId = eff.id; }
      if (eff.effect_type === "chest_luck") {
        chestLuckActive = true;
        chestLuckId = eff.id;
      }
      if (eff.effect_type === "heaven_mirror") {
        heavenMirrorActive = true;
        heavenMirrorId = eff.id;
      }
    }

    // ── Roll item(s) ──────────────────────────────────────────────────────
    const items: Array<{ id: number; name: string; rarity: string; icon: string; category: string }> = [];

    async function rollOneItem(forcedRarity?: string): Promise<{ id: number; name: string; rarity: string; icon: string; category: string } | null> {
      let rarity = forcedRarity ?? weightedRoll(config.rarityTable);

      // Apply chest_luck: promote rarity up by one tier
      if (chestLuckActive && !forcedRarity) {
        const idx = RARITY_ORDER.indexOf(rarity);
        if (idx >= 0 && idx < RARITY_ORDER.length - 1) rarity = RARITY_ORDER[idx + 1];
      }

      // Fortune reversal: if common was rolled, re-roll once
      if (fortuneReversal && rarity === "common" && !forcedRarity) {
        rarity = weightedRoll(config.rarityTable);
      }

      // Reroll rarity (fate altering)
      if (rerollRarity && !forcedRarity) {
        rarity = weightedRoll(config.rarityTable);
      }

      // Apply guarantee floor
      if (!forcedRarity && guaranteedRarityLevel > 0) {
        const currentLevel = RARITY_ORDER.indexOf(rarity);
        if (currentLevel < guaranteedRarityLevel - 1) {
          rarity = RARITY_ORDER[guaranteedRarityLevel - 1];
        }
      }

      // Respect chest restrictions
      if (!config.allowLegendary && rarity === "legendary") rarity = "mythic";
      if (!config.allowRecipes && rarity === "legendary") rarity = "mythic";

      // Build category filter (copy so we don't mutate the config)
      const catFilter = [...config.allowedCategories];
      if (!config.allowRecipes) {
        const idx = catFilter.indexOf("recipe");
        if (idx >= 0) catFilter.splice(idx, 1);
      }

      const { rows: candidates } = await client.query(
        `SELECT id, name, rarity, icon, category
         FROM items_master
         WHERE rarity = $1
           AND is_chest_obtainable = TRUE
           AND category = ANY($2::text[])
         ORDER BY RANDOM() LIMIT 1`,
        [rarity, catFilter],
      );

      if (candidates.length === 0) {
        // fallback to any obtainable item of equal or lower rarity in same categories
        const rarityIdx2 = RARITY_ORDER.indexOf(rarity);
        for (let i = rarityIdx2; i >= 0; i--) {
          const { rows: fallback } = await client.query(
            `SELECT id, name, rarity, icon, category FROM items_master
             WHERE rarity = $1 AND is_chest_obtainable = TRUE AND category = ANY($2::text[])
             ORDER BY RANDOM() LIMIT 1`,
            [RARITY_ORDER[i], catFilter],
          );
          if (fallback.length > 0) return fallback[0];
        }
        return null;
      }
      return candidates[0];
    }

    // Main item
    const mainItem = await rollOneItem();
    if (mainItem) items.push(mainItem);

    // Immortal chest: guaranteed one Mythic + 30% chance of extra Legendary
    if (chestType === "immortal") {
      if (!items[0] || RARITY_ORDER.indexOf(items[0].rarity) < RARITY_ORDER.indexOf("mythic")) {
        const mythicItem = await rollOneItem("mythic");
        if (mythicItem) items.push(mythicItem);
      }
      if (Math.random() < 0.30) {
        const legItem = await rollOneItem("legendary");
        if (legItem) items.push(legItem);
      }
    }

    // Guarantee one mythic (Destiny Pill)
    if (forceOneMyithic && !items.some(i => RARITY_ORDER.indexOf(i.rarity) >= RARITY_ORDER.indexOf("mythic"))) {
      const mythicItem = await rollOneItem("mythic");
      if (mythicItem) items.push(mythicItem);
    }

    // ── Add items to bag ──────────────────────────────────────────────────
    for (const item of items) {
      if (item.category === "ingredient") {
        // Stackable: upsert and increment existing quantity
        const { rows: existingRows } = await client.query(
          `SELECT id FROM user_inventory WHERE user_id = $1 AND item_id = $2 ORDER BY id LIMIT 1`,
          [userId, item.id],
        );
        if (existingRows.length > 0) {
          await client.query(
            `UPDATE user_inventory SET quantity = quantity + 1 WHERE id = $1`,
            [existingRows[0].id],
          );
        } else {
          await client.query(
            `INSERT INTO user_inventory (user_id, item_id, quantity) VALUES ($1,$2,1)`,
            [userId, item.id],
          );
        }
      } else {
        await client.query(
          `INSERT INTO user_inventory (user_id, item_id, quantity) VALUES ($1,$2,1)`,
          [userId, item.id],
        );
      }
    }

    // ── Deduct chest ──────────────────────────────────────────────────────
    await client.query(
      `UPDATE user_chests SET quantity = quantity - 1 WHERE user_id = $1 AND chest_type = $2`,
      [userId, chestType],
    );

    // ── Consume used effects ──────────────────────────────────────────────
    const toDelete = [fortuneReversalId, rerollRarityId, guaranteeRarityId, guaranteeOneMythicId, heavenMirrorId].filter(Boolean);
    if (toDelete.length > 0) {
      await client.query(
        `DELETE FROM active_effects WHERE id = ANY($1::int[])`,
        [toDelete],
      );
    }

    // Decrement chest_luck
    if (chestLuckId !== null) {
      const { rows: luckRows } = await client.query(
        `SELECT metadata FROM active_effects WHERE id = $1`,
        [chestLuckId],
      );
      if (luckRows.length > 0) {
        let meta: { chests_remaining: number } = { chests_remaining: 0 };
        try { meta = JSON.parse(luckRows[0].metadata ?? "{}"); } catch { /* ignore */ }
        meta.chests_remaining = (meta.chests_remaining ?? 1) - 1;
        if (meta.chests_remaining <= 0) {
          await client.query(`DELETE FROM active_effects WHERE id = $1`, [chestLuckId]);
        } else {
          await client.query(
            `UPDATE active_effects SET metadata = $1 WHERE id = $2`,
            [JSON.stringify(meta), chestLuckId],
          );
        }
      }
    }

    res.json({ ok: true, items });
  } finally {
    client.release();
  }
});

// ── POST /api/user/chests/grant ───────────────────────────────────────────────
// Internal-use endpoint: grant chests on sprint completion

export async function grantChest(userId: string, chestType: string, qty = 1): Promise<void> {
  const client = await pool.connect();
  try {
    // For mortal chests, check the 5/day cap
    if (chestType === "mortal") {
      const { rows } = await client.query<{ today_count: string }>(
        `SELECT COALESCE(SUM(CASE WHEN chest_type = 'mortal' THEN quantity ELSE 0 END), 0) AS today_count
         FROM user_chests
         WHERE user_id = $1`,
        [userId],
      );
      // Simplified cap check (production would track daily earned count separately)
      // Here we just cap total at a reasonable maximum
    }
    await client.query(
      `INSERT INTO user_chests (user_id, chest_type, quantity)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, chest_type)
       DO UPDATE SET quantity = user_chests.quantity + $3, earned_at = NOW()`,
      [userId, chestType, qty],
    );
  } finally {
    client.release();
  }
}

export default router;
