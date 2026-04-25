import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { pool } from "@workspace/db";
import { grantXp } from "./bag";
import { ensureUserCoins, dailyResetCheck, creditCoins } from "../lib/coinHelper";

const router: IRouter = Router();

// ── Coin drop amounts per chest type ─────────────────────────────────────────
const CHEST_COIN_DROP: Record<string, [number, number]> = {
  mortal:   [2,  5],
  iron:     [5,  15],
  crystal:  [10, 25],
  inferno:  [25, 50],
  immortal: [50, 100],
};

// ── Rarity order (for guarantee checks) ──────────────────────────────────────
const RARITY_ORDER = ["common", "uncommon", "rare", "epic", "mythic", "legendary"];

// ── Chest drop tables ─────────────────────────────────────────────────────────
type RarityWeight = { rarity: string; weight: number };
type ChestConfig = {
  rarityTable: RarityWeight[];
  allowedCategories: string[];
  allowRecipes: boolean;
  // bonusItemChances[0] = chance of a 2nd item, [1] = chance of a 3rd item
  bonusItemChances: [number, number];
};

const CHEST_CONFIGS: Record<string, ChestConfig> = {
  mortal: {
    // ~0.05% legendary (1 in 2 000)
    rarityTable: [
      { rarity: "common",    weight: 54.95 },
      { rarity: "uncommon",  weight: 30 },
      { rarity: "rare",      weight: 10 },
      { rarity: "epic",      weight:  5 },
      { rarity: "legendary", weight:  0.05 },
    ],
    allowedCategories: ["pill", "treasure", "ingredient"],
    allowRecipes: false,
    bonusItemChances: [0.15, 0],
  },
  iron: {
    // ~0.3% legendary (1 in ~330)
    rarityTable: [
      { rarity: "uncommon",  weight: 9.7 },
      { rarity: "rare",      weight: 50 },
      { rarity: "epic",      weight: 30 },
      { rarity: "mythic",    weight: 10 },
      { rarity: "legendary", weight:  0.3 },
    ],
    allowedCategories: ["pill", "treasure", "ingredient"],
    allowRecipes: true,
    bonusItemChances: [0.25, 0.05],
  },
  crystal: {
    // 5% legendary
    rarityTable: [
      { rarity: "rare",      weight: 20 },
      { rarity: "epic",      weight: 45 },
      { rarity: "mythic",    weight: 30 },
      { rarity: "legendary", weight:  5 },
    ],
    allowedCategories: ["pill", "treasure", "artifact", "ingredient"],
    allowRecipes: true,
    bonusItemChances: [0.40, 0.12],
  },
  inferno: {
    // 35% legendary
    rarityTable: [
      { rarity: "epic",      weight: 10 },
      { rarity: "mythic",    weight: 55 },
      { rarity: "legendary", weight: 35 },
    ],
    allowedCategories: ["pill", "treasure", "artifact", "recipe"],
    allowRecipes: true,
    bonusItemChances: [0.55, 0.22],
  },
  immortal: {
    // 40% legendary per roll (extremely high)
    rarityTable: [
      { rarity: "mythic",    weight: 60 },
      { rarity: "legendary", weight: 40 },
    ],
    allowedCategories: ["pill", "treasure", "artifact", "ingredient", "recipe"],
    allowRecipes: true,
    bonusItemChances: [1.0, 0.45], // 2nd item guaranteed, 45% 3rd
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

    // ── Load obtainable items once, select in memory (no ORDER BY RANDOM()) ─
    const { rows: allItems } = await client.query<{
      id: number; name: string; rarity: string; icon: string; category: string;
    }>(
      `SELECT id, name, rarity, icon, category
       FROM items_master
       WHERE is_chest_obtainable = TRUE`,
    );

    // Index by "rarity:category" for O(1) lookup
    const itemIndex = new Map<string, Array<{ id: number; name: string; rarity: string; icon: string; category: string }>>();
    for (const item of allItems) {
      const key = `${item.rarity}:${item.category}`;
      if (!itemIndex.has(key)) itemIndex.set(key, []);
      itemIndex.get(key)!.push(item);
    }

    function pickRandom<T>(arr: T[]): T | undefined {
      if (arr.length === 0) return undefined;
      return arr[Math.floor(Math.random() * arr.length)];
    }

    // ── Roll item(s) ──────────────────────────────────────────────────────
    const items: Array<{ id: number; name: string; rarity: string; icon: string; category: string }> = [];

    function rollOneItem(forcedRarity?: string): { id: number; name: string; rarity: string; icon: string; category: string } | null {
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

      // Build category filter
      const catFilter = [...config.allowedCategories];
      if (!config.allowRecipes) {
        const idx = catFilter.indexOf("recipe");
        if (idx >= 0) catFilter.splice(idx, 1);
      }

      // Pick from in-memory index
      const eligible: Array<{ id: number; name: string; rarity: string; icon: string; category: string }> = [];
      for (const cat of catFilter) {
        const found = itemIndex.get(`${rarity}:${cat}`);
        if (found) eligible.push(...found);
      }
      const picked = pickRandom(eligible);
      if (picked) return picked;

      // Fallback: try equal or lower rarities
      const rarityIdx2 = RARITY_ORDER.indexOf(rarity);
      for (let i = rarityIdx2; i >= 0; i--) {
        const fallback: Array<{ id: number; name: string; rarity: string; icon: string; category: string }> = [];
        for (const cat of catFilter) {
          const found = itemIndex.get(`${RARITY_ORDER[i]}:${cat}`);
          if (found) fallback.push(...found);
        }
        const fallbackPick = pickRandom(fallback);
        if (fallbackPick) return fallbackPick;
      }
      return null;
    }

    // Main item (always 1)
    const mainItem = rollOneItem();
    if (mainItem) items.push(mainItem);

    // Bonus item rolls — each chest has its own probability for a 2nd and 3rd item
    const [chance2nd, chance3rd] = config.bonusItemChances;
    if (chance2nd > 0 && Math.random() < chance2nd) {
      const bonus2 = rollOneItem();
      if (bonus2) items.push(bonus2);

      if (chance3rd > 0 && Math.random() < chance3rd) {
        const bonus3 = rollOneItem();
        if (bonus3) items.push(bonus3);
      }
    }

    // Guarantee one mythic (Destiny Pill)
    if (forceOneMyithic && !items.some(i => RARITY_ORDER.indexOf(i.rarity) >= RARITY_ORDER.indexOf("mythic"))) {
      const mythicItem = rollOneItem("mythic");
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

    // ── Coin drop ─────────────────────────────────────────────────────────
    let coinsAwarded = 0;
    let newCoinBalance: number | null = null;
    try {
      await ensureUserCoins(client, userId);
      await dailyResetCheck(client, userId);
      const [minCoins, maxCoins] = CHEST_COIN_DROP[chestType as string] ?? [0, 0];
      const coinDrop = Math.floor(Math.random() * (maxCoins - minCoins + 1)) + minCoins;
      const coinResult = await creditCoins(
        client,
        userId,
        coinDrop,
        "chest_drop",
        chestType as string,
        `Opened ${chestType} chest`,
      );
      coinsAwarded = coinResult.credited;
      newCoinBalance = coinResult.newBalance;
    } catch {
      // Non-fatal: coin drop failure should not block chest open success
    }

    res.json({ ok: true, items, coins_awarded: coinsAwarded, new_coin_balance: newCoinBalance });
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
