import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { pool, db, userProfilesTable, sprintWritingTable } from "@workspace/db";
import { eq, and, desc, sql, sum, lt } from "drizzle-orm";

const router: IRouter = Router();

const DEFAULT_BAG_SLOTS = 20;
const OVERFLOW_SLOTS = 5;

// ── Rank thresholds (duplicated from rooms.ts for XP queries) ─────────────────
const RANK_THRESHOLDS = [0, 250, 1000, 3500, 10000, 25000, 75000, 200000];

function getRankIndex(xp: number): number {
  for (let i = RANK_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= RANK_THRESHOLDS[i]) return i;
  }
  return 0;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getBagSlots(userId: string): Promise<number> {
  const client = await pool.connect();
  try {
    // Ensure row exists (default 20 slots = Cloth Bag)
    await client.query(
      `INSERT INTO equipped_storage (user_id, item_id, slot_count)
       VALUES ($1, NULL, 20) ON CONFLICT (user_id) DO NOTHING`,
      [userId],
    );
    const { rows } = await client.query<{ slot_count: number }>(
      `SELECT slot_count FROM equipped_storage WHERE user_id = $1`,
      [userId],
    );
    return rows[0]?.slot_count ?? DEFAULT_BAG_SLOTS;
  } finally {
    client.release();
  }
}

async function getActiveEffects(userId: string) {
  const client = await pool.connect();
  try {
    // Remove expired effects first
    await client.query(
      `DELETE FROM active_effects WHERE user_id = $1 AND expires_at < NOW()`,
      [userId],
    );
    const { rows } = await client.query(
      `SELECT ae.*, im.name AS item_name, im.icon, im.rarity
       FROM active_effects ae
       JOIN items_master im ON im.id = ae.item_id
       WHERE ae.user_id = $1
       ORDER BY ae.expires_at ASC`,
      [userId],
    );
    return rows;
  } finally {
    client.release();
  }
}

async function grantXp(userId: string, amount: number): Promise<number> {
  const client = await pool.connect();
  try {
    const { rows } = await client.query<{ xp: number }>(
      `UPDATE user_profiles SET xp = xp + $1, updated_at = NOW()
       WHERE clerk_user_id = $2
       RETURNING xp`,
      [amount, userId],
    );
    return rows[0]?.xp ?? 0;
  } finally {
    client.release();
  }
}

// ── GET /api/user/bag ─────────────────────────────────────────────────────────

router.get("/user/bag", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const client = await pool.connect();
  try {
    // ── Overflow management ───────────────────────────────────────────────
    // 1. Delete items that have been in overflow for 24+ hours
    await client.query(
      `DELETE FROM user_inventory
       WHERE user_id = $1
         AND overflow_since IS NOT NULL
         AND overflow_since < NOW() - INTERVAL '24 hours'`,
      [userId],
    );

    // Active effects (also prunes expired ones)
    const effects = await getActiveEffects(userId);

    // Bag slot total
    const totalSlots = await getBagSlots(userId);

    // 2. Recompute overflow markers: rank items worst-first (lowest rarity → oldest).
    //    Items beyond the slot limit get overflow_since set (preserving existing timestamp);
    //    items now within limit have overflow_since cleared.
    await client.query(
      `WITH ranked AS (
         SELECT ui.id,
           ROW_NUMBER() OVER (
             ORDER BY
               CASE im.rarity
                 WHEN 'common'    THEN 0
                 WHEN 'uncommon'  THEN 1
                 WHEN 'rare'      THEN 2
                 WHEN 'epic'      THEN 3
                 WHEN 'mythic'    THEN 4
                 WHEN 'legendary' THEN 5
                 ELSE 0
               END ASC,
               ui.acquired_at ASC
           ) AS rk
         FROM user_inventory ui
         JOIN items_master im ON im.id = ui.item_id
         WHERE ui.user_id = $1
       )
       UPDATE user_inventory
       SET overflow_since = CASE
         WHEN rk > $2 THEN COALESCE(user_inventory.overflow_since, NOW())
         ELSE NULL
       END
       FROM ranked
       WHERE user_inventory.id = ranked.id`,
      [userId, totalSlots],
    );

    // Inventory with item details (includes overflow_since)
    const { rows: inventory } = await client.query(
      `SELECT ui.id, ui.item_id, ui.quantity, ui.acquired_at, ui.overflow_since,
              im.name, im.description, im.category, im.rarity,
              im.effect_type, im.effect_value, im.effect_duration,
              im.is_craftable, im.is_tradeable, im.icon, im.stack_limit,
              im.sell_value, im.is_storage_item, im.storage_slot_count
       FROM user_inventory ui
       JOIN items_master im ON im.id = ui.item_id
       WHERE ui.user_id = $1
       ORDER BY ui.overflow_since DESC NULLS LAST, im.rarity DESC, im.category, im.name`,
      [userId],
    );

    // Failure ashes count
    const { rows: ashRows } = await client.query(
      `SELECT count FROM failure_ashes WHERE user_id = $1`,
      [userId],
    );
    const failureAshes = ashRows[0]?.count ?? 0;

    // Item cooldowns (items used within last 48 hours)
    const { rows: cooldownRows } = await client.query(
      `SELECT item_id, MAX(used_at) AS last_used,
              im.effect_duration
       FROM item_use_log iul
       JOIN items_master im ON im.id = iul.item_id
       WHERE iul.user_id = $1 AND iul.used_at > NOW() - INTERVAL '7 days'
       GROUP BY item_id, im.effect_duration`,
      [userId],
    );

    const cooldowns: Record<number, Date> = {};
    for (const row of cooldownRows) {
      if (row.effect_duration && row.effect_duration >= 60) {
        // Items with long effect_duration have matching cooldowns
        const cooldownEnd = new Date(row.last_used.getTime() + row.effect_duration * 60_000);
        if (cooldownEnd > new Date()) {
          cooldowns[row.item_id] = cooldownEnd;
        }
      }
    }

    res.json({
      inventory,
      activeEffects: effects,
      totalSlots,
      failureAshes,
      cooldowns,
    });
  } finally {
    client.release();
  }
});

// ── POST /api/user/bag/use ────────────────────────────────────────────────────

router.post("/user/bag/use", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { inventoryId } = req.body ?? {};
  if (typeof inventoryId !== "number") {
    res.status(400).json({ error: "inventoryId required" }); return;
  }

  const client = await pool.connect();
  try {
    // Fetch the inventory record + item details
    const { rows: invRows } = await client.query(
      `SELECT ui.id, ui.quantity, ui.item_id,
              im.name, im.effect_type, im.effect_value, im.effect_duration,
              im.rarity, im.category, im.icon, im.is_tradeable, im.stack_limit,
              im.is_storage_item
       FROM user_inventory ui
       JOIN items_master im ON im.id = ui.item_id
       WHERE ui.id = $1 AND ui.user_id = $2`,
      [inventoryId, userId],
    );

    if (invRows.length === 0) {
      res.status(404).json({ error: "Item not found in your bag" }); return;
    }

    const inv = invRows[0];
    const { item_id: itemId, effect_type: effectType, effect_value: effectValue,
            effect_duration: effectDuration, name, rarity, category } = inv;

    // Storage rings are equipped, not "used" — send caller to the storage route
    if (effectType === "storage_equip") {
      res.status(400).json({
        error: "This is a storage item. Equip it from the equipped storage section to expand your bag.",
      });
      return;
    }

    // Check if user profile exists
    const { rows: profileRows } = await client.query(
      `SELECT xp FROM user_profiles WHERE clerk_user_id = $1`,
      [userId],
    );
    if (profileRows.length === 0) {
      res.status(404).json({ error: "Profile not found" }); return;
    }
    const currentXp: number = profileRows[0].xp;

    let message = "";
    let xpGained = 0;
    let newXp = currentXp;

    // ── Effect handlers ────────────────────────────────────────────────────

    if (effectType === "xp_instant") {
      xpGained = effectValue ?? 0;
      newXp = await grantXp(userId, xpGained);
      message = `+${xpGained} XP`;

    } else if (effectType === "impure_pill") {
      if (Math.random() > 0.2) {
        xpGained = effectValue ?? 0;
        newXp = await grantXp(userId, xpGained);
        message = `+${xpGained} XP (refined successfully)`;
      } else {
        message = "The pill crumbled to ash... (20% failure — nothing gained)";
      }

    } else if (effectType === "chaos_random") {
      if (Math.random() < 0.70) {
        xpGained = 50000;
        newXp = await grantXp(userId, xpGained);
        message = `The chaos aligned in your favour! +50,000 XP`;
      } else {
        // Cancel all active effects
        await client.query(`DELETE FROM active_effects WHERE user_id = $1`, [userId]);
        message = "Chaos consumed your active effects — all timed effects cancelled!";
      }

    } else if (effectType === "xp_double_next_sprint") {
      const far = new Date(Date.now() + 365 * 24 * 60 * 60_000);
      await client.query(
        `INSERT INTO active_effects (user_id, item_id, effect_type, effect_value, expires_at, metadata)
         VALUES ($1,$2,'xp_sprint_multiplier',200,$3,'{"sprints_remaining":1}')`,
        [userId, itemId, far],
      );
      message = "Next sprint XP doubled!";

    } else if (effectType === "xp_triple_next_sprints") {
      const sprints = effectValue ?? 3;
      const far = new Date(Date.now() + 365 * 24 * 60 * 60_000);
      await client.query(
        `INSERT INTO active_effects (user_id, item_id, effect_type, effect_value, expires_at, metadata)
         VALUES ($1,$2,'xp_sprint_multiplier',300,$3,$4)`,
        [userId, itemId, far, JSON.stringify({ sprints_remaining: sprints })],
      );
      message = `XP tripled for next ${sprints} sprints!`;

    } else if (effectType === "xp_double_next_sprints") {
      const sprints = effectValue ?? 5;
      const far = new Date(Date.now() + 365 * 24 * 60 * 60_000);
      await client.query(
        `INSERT INTO active_effects (user_id, item_id, effect_type, effect_value, expires_at, metadata)
         VALUES ($1,$2,'xp_sprint_multiplier',200,$3,$4)`,
        [userId, itemId, far, JSON.stringify({ sprints_remaining: sprints })],
      );
      message = `XP doubled for next ${sprints} sprints!`;

    } else if (effectType === "xp_5x_next_sprint") {
      const far = new Date(Date.now() + 365 * 24 * 60 * 60_000);
      await client.query(
        `INSERT INTO active_effects (user_id, item_id, effect_type, effect_value, expires_at, metadata)
         VALUES ($1,$2,'xp_sprint_multiplier',500,$3,'{"sprints_remaining":1}')`,
        [userId, itemId, far],
      );
      message = "Next sprint XP multiplied by 5×!";

    } else if (effectType === "xp_timed_double") {
      const durationMs = (effectDuration ?? 60) * 60_000;
      const expires = new Date(Date.now() + durationMs);
      await client.query(
        `INSERT INTO active_effects (user_id, item_id, effect_type, effect_value, expires_at, metadata)
         VALUES ($1,$2,'xp_timed_multiplier',200,$3,'{"sprint_minutes_remaining":60}')`,
        [userId, itemId, expires],
      );
      message = `Sprint XP doubled for ${effectDuration ?? 60} minutes of writing time!`;

    } else if (effectType === "xp_timed_bonus") {
      const durationMs = (effectDuration ?? 1440) * 60_000;
      const expires = new Date(Date.now() + durationMs);
      await client.query(
        `INSERT INTO active_effects (user_id, item_id, effect_type, effect_value, expires_at)
         VALUES ($1,$2,'xp_sprint_bonus_pct',$3,$4)`,
        [userId, itemId, effectValue ?? 5, expires],
      );
      const hours = Math.round((effectDuration ?? 1440) / 60);
      message = `+${effectValue}% sprint XP for ${hours} hours!`;

    } else if (effectType === "chest_luck") {
      const far = new Date(Date.now() + 365 * 24 * 60 * 60_000);
      await client.query(
        `INSERT INTO active_effects (user_id, item_id, effect_type, effect_value, expires_at, metadata)
         VALUES ($1,$2,'chest_luck',$3,$4,$5)`,
        [userId, itemId, effectValue ?? 3, far, JSON.stringify({ chests_remaining: effectValue ?? 3 })],
      );
      message = `Rare drop chance increased for next ${effectValue ?? 3} chests!`;

    } else if (effectType === "bag_slots") {
      const slots = effectValue ?? 5;
      await client.query(
        `INSERT INTO permanent_modifiers (user_id, source_item_id, modifier_type, modifier_value)
         VALUES ($1,$2,'bag_slots',$3)`,
        [userId, itemId, slots],
      );
      const newTotal = await getBagSlots(userId);
      message = `Bag expanded! +${slots} slots (total: ${newTotal})`;

    } else if (effectType === "karma_xp") {
      const { rows: karmaRows } = await client.query<{ total: string }>(
        `SELECT COALESCE(SUM(xp_lost), 0) AS total FROM karma_pill_log WHERE user_id = $1`,
        [userId],
      );
      const karmaPayout = Math.min(effectValue ?? 10000, Number(karmaRows[0]?.total ?? 0));
      if (karmaPayout > 0) {
        xpGained = karmaPayout;
        newXp = await grantXp(userId, xpGained);
        await client.query(`DELETE FROM karma_pill_log WHERE user_id = $1`, [userId]);
        message = `Karma recovered! +${xpGained} XP (all crafting failures forgiven)`;
      } else {
        message = "No crafting losses on record — nothing to recover.";
      }

    } else if (effectType === "false_tribulation") {
      const rankIdx = getRankIndex(currentXp);
      const nextThreshold = RANK_THRESHOLDS[rankIdx + 1] ?? RANK_THRESHOLDS[RANK_THRESHOLDS.length - 1];
      const xpNeeded = Math.max(0, nextThreshold - currentXp);
      xpGained = Math.min(effectValue ?? 5000, Math.floor(xpNeeded * 0.2));
      if (xpGained > 0) {
        newXp = await grantXp(userId, xpGained);
        message = `False tribulation surge! +${xpGained} XP (20% of ${xpNeeded} needed for next rank)`;
      } else {
        message = "Already at max rank — no tribulation XP gained.";
      }

    } else if (effectType === "dao_fruit") {
      const rankIdx = getRankIndex(currentXp);
      xpGained = rankIdx * (effectValue ?? 200);
      if (xpGained > 0) {
        newXp = await grantXp(userId, xpGained);
        message = `Dao Fruit consumed! +${xpGained} XP (rank tier ${rankIdx} × ${effectValue ?? 200})`;
      } else {
        message = "Rank 0 — Dao Fruit grants no XP yet. Keep writing!";
      }

    } else if (effectType === "rank_breakthrough") {
      const rankIdx = getRankIndex(currentXp);
      const nextThreshold = RANK_THRESHOLDS[rankIdx + 1];
      if (!nextThreshold) {
        message = "Already at maximum rank — no breakthrough possible.";
      } else {
        const xpNeeded = nextThreshold - currentXp;
        const tenPct = nextThreshold * 0.10;
        if (xpNeeded <= tenPct) {
          xpGained = xpNeeded;
          newXp = await grantXp(userId, xpGained);
          message = `Tribulation passed! Rank breakthrough! +${xpGained} XP`;
        } else {
          message = `Too far from the next rank (${xpNeeded} XP away — need to be within ${Math.floor(tenPct)}).`;
        }
      }

    } else if (effectType === "heaven_destroying") {
      const rankIdx = getRankIndex(currentXp);
      const nextThreshold = RANK_THRESHOLDS[rankIdx + 1];
      if (!nextThreshold) {
        message = "Already at maximum rank.";
      } else {
        const target = Math.floor(nextThreshold * 0.9);
        if (target > currentXp) {
          xpGained = target - currentXp;
          newXp = await grantXp(userId, xpGained);
          message = `Heaven Destroying Talisman! +${xpGained} XP (filled to 90% of next rank)`;
        } else {
          message = "Already past 90% of the next rank threshold.";
        }
      }

    } else if (effectType === "permanent_sprint_xp") {
      // Check cap: total additive permanent bonus cannot exceed 60%
      const { rows: capRows } = await client.query<{ total: string }>(
        `SELECT COALESCE(SUM(modifier_value), 0) AS total
         FROM permanent_modifiers
         WHERE user_id = $1 AND modifier_type IN ('sprint_xp_pct','heaven_defying_constitution')`,
        [userId],
      );
      const existingTotal = Number(capRows[0]?.total ?? 0);
      const toAdd = Math.min(effectValue ?? 10, 60 - existingTotal);
      if (toAdd <= 0) {
        message = "Permanent bonus cap of +60% already reached — pill has no effect.";
      } else {
        await client.query(
          `INSERT INTO permanent_modifiers (user_id, source_item_id, modifier_type, modifier_value)
           VALUES ($1,$2,'sprint_xp_pct',$3)`,
          [userId, itemId, toAdd],
        );
        message = `Permanent sprint XP bonus increased by +${toAdd}%!`;
      }

    } else if (effectType === "heaven_defying_constitution") {
      const { rows: capRows } = await client.query<{ total: string }>(
        `SELECT COALESCE(SUM(modifier_value), 0) AS total
         FROM permanent_modifiers
         WHERE user_id = $1 AND modifier_type IN ('sprint_xp_pct','heaven_defying_constitution')`,
        [userId],
      );
      const existingTotal = Number(capRows[0]?.total ?? 0);
      const toAdd = Math.min(effectValue ?? 25, 60 - existingTotal);
      if (toAdd <= 0) {
        message = "Permanent bonus cap of +60% already reached.";
      } else {
        await client.query(
          `INSERT INTO permanent_modifiers (user_id, source_item_id, modifier_type, modifier_value)
           VALUES ($1,$2,'heaven_defying_constitution',$3)`,
          [userId, itemId, toAdd],
        );
        message = `Heaven Defying Constitution activated! Permanent +${toAdd}% sprint XP!`;
      }

    } else if (effectType === "wheel_of_reincarnation") {
      // Reset XP to 0, add ×2 permanent multiplier
      await client.query(
        `UPDATE user_profiles SET xp = 0, updated_at = NOW() WHERE clerk_user_id = $1`,
        [userId],
      );
      // Clear dao_of_writing stacks and all permanent modifiers
      await client.query(
        `DELETE FROM permanent_modifiers WHERE user_id = $1`,
        [userId],
      );
      await client.query(
        `INSERT INTO permanent_modifiers (user_id, source_item_id, modifier_type, modifier_value)
         VALUES ($1,$2,'sprint_xp_multiplier',200)`,
        [userId, itemId],
      );
      newXp = 0;
      message = "The Wheel turns... Your XP is reset to zero. All future sprint XP is permanently multiplied by ×2. (Hard cap: ×3 total)";

    } else if (effectType === "guarantee_rare_plus") {
      const far = new Date(Date.now() + 365 * 24 * 60 * 60_000);
      await client.query(
        `INSERT INTO active_effects (user_id, item_id, effect_type, effect_value, expires_at)
         VALUES ($1,$2,'guarantee_rarity',3,$3)`,
        [userId, itemId, far],
      );
      message = "Next chest guaranteed Rare or above!";

    } else if (effectType === "guarantee_mythic_plus") {
      const far = new Date(Date.now() + 365 * 24 * 60 * 60_000);
      await client.query(
        `INSERT INTO active_effects (user_id, item_id, effect_type, effect_value, expires_at)
         VALUES ($1,$2,'guarantee_rarity',5,$3)`,
        [userId, itemId, far],
      );
      message = "Next chest guaranteed Mythic or above!";

    } else if (effectType === "guarantee_one_mythic") {
      const far = new Date(Date.now() + 365 * 24 * 60 * 60_000);
      await client.query(
        `INSERT INTO active_effects (user_id, item_id, effect_type, effect_value, expires_at)
         VALUES ($1,$2,'guarantee_one_mythic',1,$3)`,
        [userId, itemId, far],
      );
      message = "Next chest guaranteed to include at least one Mythic item!";

    } else if (effectType === "guarantee_legendary") {
      // Check 30-day limit
      const { rows: limitRows } = await client.query(
        `SELECT used_at FROM item_use_log
         WHERE user_id = $1 AND item_id = $2 AND used_at > NOW() - INTERVAL '30 days'
         ORDER BY used_at DESC LIMIT 1`,
        [userId, itemId],
      );
      if (limitRows.length > 0) {
        res.json({ ok: false, message: "Immortal Luck Pill can only be used once every 30 days." });
        return;
      }
      const far = new Date(Date.now() + 365 * 24 * 60 * 60_000);
      await client.query(
        `INSERT INTO active_effects (user_id, item_id, effect_type, effect_value, expires_at)
         VALUES ($1,$2,'guarantee_rarity',6,$3)`,
        [userId, itemId, far],
      );
      message = "Next chest guaranteed Legendary!";

    } else if (effectType === "fortune_reversal") {
      const far = new Date(Date.now() + 365 * 24 * 60 * 60_000);
      await client.query(
        `INSERT INTO active_effects (user_id, item_id, effect_type, effect_value, expires_at)
         VALUES ($1,$2,'fortune_reversal',1,$3)`,
        [userId, itemId, far],
      );
      message = "If your next chest yields Common, it will be rerolled once.";

    } else if (effectType === "reroll_chest_rarity") {
      const far = new Date(Date.now() + 365 * 24 * 60 * 60_000);
      await client.query(
        `INSERT INTO active_effects (user_id, item_id, effect_type, effect_value, expires_at)
         VALUES ($1,$2,'reroll_chest_rarity',1,$3)`,
        [userId, itemId, far],
      );
      message = "Rarity of your next opened chest will be rerolled!";

    } else if (effectType?.startsWith("cauldron_")) {
      // Cauldrons persist until replaced — delete old cauldron effect, insert new one
      await client.query(
        `DELETE FROM active_effects WHERE user_id = $1 AND effect_type = 'cauldron'`,
        [userId],
      );
      const far = new Date(Date.now() + 365 * 24 * 60 * 60_000);
      await client.query(
        `INSERT INTO active_effects (user_id, item_id, effect_type, effect_value, expires_at, metadata)
         VALUES ($1,$2,'cauldron',$3,$4,$5)`,
        [userId, itemId, effectValue ?? 0, far, JSON.stringify({ cauldronType: effectType })],
      );
      message = `${name} is now your active alchemy cauldron!`;

    } else if (effectType === "recipe_scroll") {
      // Find the associated recipe by matching the scroll's name to recipe names
      // Scroll name: "Scroll: Foundation Building" → recipe result is Foundation Pill
      // We find the recipe by recipe_type='alchemy' and match via stored data
      const scrollTitle = name.replace(/^Scroll:\s*/i, "").trim();
      const { rows: recipeRows } = await client.query(
        `SELECT cr.id FROM crafting_recipes cr
         JOIN items_master im ON im.id = cr.result_item_id
         WHERE im.name ILIKE $1 LIMIT 1`,
        [`%${scrollTitle.replace("Building", "").replace("Formation", "Core").trim()}%`],
      );
      if (recipeRows.length === 0) {
        message = `${name} learned! Recipe recorded in your knowledge.`;
      } else {
        const recipeId = recipeRows[0].id;
        await client.query(
          `INSERT INTO known_recipes (user_id, recipe_id) VALUES ($1,$2)
           ON CONFLICT (user_id, recipe_id) DO NOTHING`,
          [userId, recipeId],
        );
        message = `Recipe learned: ${scrollTitle}!`;
      }

    } else if (effectType === "alchemy_mastery") {
      await client.query(
        `INSERT INTO permanent_modifiers (user_id, source_item_id, modifier_type, modifier_value)
         VALUES ($1,$2,'alchemy_cooldown_reduction',50)
         ON CONFLICT DO NOTHING`,
        [userId, itemId],
      );
      message = "Alchemy Mastery activated! All crafting cooldowns reduced by 50% permanently.";

    } else if (effectType === "immortal_alchemy") {
      await client.query(
        `INSERT INTO permanent_modifiers (user_id, source_item_id, modifier_type, modifier_value)
         VALUES ($1,$2,'alchemy_no_cooldown',1)`,
        [userId, itemId],
      );
      message = "Immortal Alchemy mastered! All crafting cooldowns permanently removed.";

    } else if (effectType === "refining_furnace") {
      const { rows: ashRows } = await client.query<{ count: number }>(
        `SELECT count FROM failure_ashes WHERE user_id = $1`,
        [userId],
      );
      const ashes = ashRows[0]?.count ?? 0;
      if (ashes < 5) {
        res.json({ ok: false, message: `Need 5 Failure Ashes. You have ${ashes}.` });
        return;
      }
      // Deduct 5 ashes
      await client.query(
        `UPDATE failure_ashes SET count = count - 5 WHERE user_id = $1`,
        [userId],
      );
      // Give 1 random common pill
      const { rows: commonPills } = await client.query(
        `SELECT id FROM items_master
         WHERE category = 'pill' AND rarity = 'common' AND is_chest_obtainable = TRUE
         ORDER BY RANDOM() LIMIT 1`,
      );
      if (commonPills.length > 0) {
        await client.query(
          `INSERT INTO user_inventory (user_id, item_id, quantity) VALUES ($1,$2,1)
           ON CONFLICT DO NOTHING`,
          [userId, commonPills[0].id],
        );
        message = "Refined 5 ashes into a Common pill! Check your bag.";
      } else {
        message = "5 ashes consumed but no pill could be refined (no common pills found).";
      }
      // Don't consume the Refining Furnace itself — it's reusable
      res.json({ ok: true, message, newXp, xpGained });
      return;

    } else if (effectType === "xp_release_7days") {
      // Sum sprint XP from last 7 days (approximated from sprint_writing xp awards)
      // We use XP granted from sprints: wordCount / 5 per sprint over last 7 days
      const { rows: sprintRows } = await client.query<{ total: string }>(
        `SELECT COALESCE(SUM(word_count), 0) AS total
         FROM sprint_writing
         WHERE clerk_user_id = $1 AND xp_awarded = TRUE
           AND updated_at > NOW() - INTERVAL '7 days'`,
        [userId],
      );
      const sprintXp = Math.ceil(Number(sprintRows[0]?.total ?? 0) / 5);
      xpGained = Math.floor(sprintXp * ((effectValue ?? 50) / 100));
      if (xpGained > 0) {
        newXp = await grantXp(userId, xpGained);
        message = `World Sealing Monument releases +${xpGained} XP (50% of your 7-day sprint XP)!`;
      } else {
        message = "No sprint XP recorded in the last 7 days.";
      }

    } else if (effectType === "xp_release_words") {
      // Get word count from last sprint
      const { rows: lastSprint } = await client.query<{ word_count: number }>(
        `SELECT word_count FROM sprint_writing
         WHERE clerk_user_id = $1 ORDER BY updated_at DESC LIMIT 1`,
        [userId],
      );
      xpGained = lastSprint[0]?.word_count ?? 0;
      if (xpGained > 0) {
        newXp = await grantXp(userId, xpGained);
        message = `Dao Carving Sword! +${xpGained} XP (equal to your last sprint's word count)!`;
      } else {
        message = "No sprint on record to draw from.";
      }

    } else if (effectType === "space_time_reversal") {
      await client.query(
        `DELETE FROM item_use_log WHERE user_id = $1 AND used_at > NOW() - INTERVAL '7 days'`,
        [userId],
      );
      message = "Space-Time Reversal Stone! All item cooldowns reset instantly!";

    } else if (effectType === "skip_cooldown") {
      // Clear all active cooldown logs
      await client.query(
        `DELETE FROM item_use_log WHERE user_id = $1 AND used_at > NOW() - INTERVAL '7 days'`,
        [userId],
      );
      message = "Cooldown skipped — all item cooldowns cleared!";

    } else if (effectType === "xp_penalty_immune") {
      const durationMs = (effectDuration ?? 2880) * 60_000;
      const expires = new Date(Date.now() + durationMs);
      await client.query(
        `INSERT INTO active_effects (user_id, item_id, effect_type, effect_value, expires_at)
         VALUES ($1,$2,'xp_penalty_immune',1,$3)`,
        [userId, itemId, expires],
      );
      const hours = Math.round((effectDuration ?? 2880) / 60);
      message = `XP penalties prevented for ${hours} hours!`;

    } else if (effectType === "jade_emperor") {
      const durationMs = (effectDuration ?? 60) * 60_000;
      const expires = new Date(Date.now() + durationMs);
      await client.query(
        `INSERT INTO active_effects (user_id, item_id, effect_type, effect_value, expires_at)
         VALUES ($1,$2,'jade_emperor',1,$3)`,
        [userId, itemId, expires],
      );
      message = "Jade Emperor's Decree active! All cooldowns and limits bypassed for 1 hour!";

    } else if (effectType === "world_destroying") {
      const far = new Date(Date.now() + 365 * 24 * 60 * 60_000);
      await client.query(
        `INSERT INTO active_effects (user_id, item_id, effect_type, effect_value, expires_at)
         VALUES ($1,$2,'world_destroying',$3,$4)`,
        [userId, itemId, effectValue ?? 8, far],
      );
      message = "World Destroying Pill consumed! Your next sprint XP will be multiplied by the number of your active timed effects (max ×8)!";

    } else if (effectType === "immortal_emperor_seal") {
      // Store cosmetic flag in permanent_modifiers
      await client.query(
        `INSERT INTO permanent_modifiers (user_id, source_item_id, modifier_type, modifier_value)
         VALUES ($1,$2,'immortal_emperor_seal',1)
         ON CONFLICT DO NOTHING`,
        [userId, itemId],
      );
      message = "Your name now glows gold in all sprint rooms. Forever.";

    } else if (effectType === "karmic_ring") {
      const far = new Date(Date.now() + 365 * 24 * 60 * 60_000);
      await client.query(
        `INSERT INTO active_effects (user_id, item_id, effect_type, effect_value, expires_at)
         VALUES ($1,$2,'karmic_ring',$3,$4)`,
        [userId, itemId, effectValue ?? 10, far],
      );
      message = "Karmic Ring equipped — each XP item you use returns 10% of its value as bonus!";

    } else if (effectType === "karma_beads") {
      const durationMs = (effectDuration ?? 1440) * 60_000;
      const expires = new Date(Date.now() + durationMs);
      await client.query(
        `INSERT INTO active_effects (user_id, item_id, effect_type, effect_value, expires_at, metadata)
         VALUES ($1,$2,'karma_beads',$3,$4,'{"sprint_xp_tracked":0}')`,
        [userId, itemId, effectValue ?? 20, expires],
      );
      message = "Karma Beads activated — tracking sprint XP for 24 hours. 20% bonus awaits!";

    } else if (effectType === "freeze_multiplier") {
      const durationMs = (effectDuration ?? 4320) * 60_000;
      const expires = new Date(Date.now() + durationMs);
      await client.query(
        `INSERT INTO active_effects (user_id, item_id, effect_type, effect_value, expires_at)
         VALUES ($1,$2,'freeze_multiplier',1,$3)`,
        [userId, itemId, expires],
      );
      message = "Immortal Sealing Talisman! Your current XP multiplier is frozen for 72 hours.";

    } else if (effectType === "heaven_mirror") {
      // Check cooldown — 48 hours
      const { rows: mirrorCd } = await client.query(
        `SELECT used_at FROM item_use_log
         WHERE user_id = $1 AND item_id = $2 AND used_at > NOW() - INTERVAL '48 hours'
         LIMIT 1`,
        [userId, itemId],
      );
      if (mirrorCd.length > 0) {
        res.json({ ok: false, message: "Heaven's Mirror is on a 48-hour cooldown." });
        return;
      }
      message = "Heaven's Mirror activated! Use the Chests page to preview your next chest before opening it.";
      const far = new Date(Date.now() + 365 * 24 * 60 * 60_000);
      await client.query(
        `INSERT INTO active_effects (user_id, item_id, effect_type, effect_value, expires_at)
         VALUES ($1,$2,'heaven_mirror',1,$3)`,
        [userId, itemId, far],
      );

    } else if (effectType === "nuwa_stone") {
      const far = new Date(Date.now() + 365 * 24 * 60 * 60_000);
      await client.query(
        `INSERT INTO active_effects (user_id, item_id, effect_type, effect_value, expires_at)
         VALUES ($1,$2,'nuwa_stone',1,$3)`,
        [userId, itemId, far],
      );
      message = "Nuwa's Stone activated — you'll receive 1 free Mortal Chest every 24 hours (subject to 5/day cap)!";

    } else if (effectType === "dao_of_writing") {
      const far = new Date(Date.now() + 365 * 24 * 60 * 60_000);
      await client.query(
        `INSERT INTO active_effects (user_id, item_id, effect_type, effect_value, expires_at, metadata)
         VALUES ($1,$2,'dao_of_writing',$3,$4,'{"stack":0,"last_sprint_date":null}')`,
        [userId, itemId, effectValue ?? 50, far],
      );
      message = "Dao of Writing awakened — earn +5% bonus XP per sprint, stacking up to +50%! Stack decays 1% per idle day.";

    } else if (effectType === "chronicle_of_heaven") {
      const far = new Date(Date.now() + 365 * 24 * 60 * 60_000);
      await client.query(
        `INSERT INTO active_effects (user_id, item_id, effect_type, effect_value, expires_at, metadata)
         VALUES ($1,$2,'chronicle_of_heaven',$3,$4,'{"best_sprint_xp":0,"last_replay":null}')`,
        [userId, itemId, effectValue ?? 5000, far],
      );
      message = "Chronicle of Heaven opened — it records your best sprint XP and replays it as a bonus every 7 days!";

    } else if (effectType === "mountain_seal") {
      const far = new Date(Date.now() + 365 * 24 * 60 * 60_000);
      await client.query(
        `INSERT INTO active_effects (user_id, item_id, effect_type, effect_value, expires_at, metadata)
         VALUES ($1,$2,'mountain_seal',$3,$4,'{"stored_xp":0,"sprints_remaining":3}')`,
        [userId, itemId, effectValue ?? 3, far],
      );
      message = "Mountain Suppressing Seal activated — XP from your next 3 sprints will be stored and released as a bonus!";

    } else if (effectType === "failure_ash") {
      // Failure Ash is a collectible — just increment the count, don't consume via normal use
      await client.query(
        `INSERT INTO failure_ashes (user_id, count) VALUES ($1, 1)
         ON CONFLICT (user_id) DO UPDATE SET count = failure_ashes.count + 1`,
        [userId],
      );
      message = "Failure Ash collected. Gather 5 and use the Refining Furnace to craft a Common pill.";

    } else {
      message = `${name} used.`;
    }

    // ── Consume 1 from inventory (skip for reusable items) ─────────────────
    const reusableEffects = new Set(["cauldron_bronze","cauldron_spirit","cauldron_heaven","cauldron_chaos",
      "refining_furnace","nuwa_stone","karmic_ring","karma_beads","freeze_multiplier",
      "immortal_emperor_seal","heaven_mirror","mountain_seal","dao_of_writing","chronicle_of_heaven"]);
    const isReusable = effectType ? reusableEffects.has(effectType) || effectType.startsWith("cauldron_") : false;

    if (!isReusable) {
      if (inv.quantity > 1) {
        await client.query(
          `UPDATE user_inventory SET quantity = quantity - 1 WHERE id = $1`,
          [inventoryId],
        );
      } else {
        await client.query(
          `DELETE FROM user_inventory WHERE id = $1`,
          [inventoryId],
        );
      }
    }

    // Log use
    await client.query(
      `INSERT INTO item_use_log (user_id, item_id, used_at) VALUES ($1,$2,NOW())`,
      [userId, itemId],
    );

    // Karmic ring bonus — if user has it active and this item grants XP
    if (xpGained > 0) {
      const { rows: karmicRows } = await client.query(
        `SELECT id, effect_value FROM active_effects
         WHERE user_id = $1 AND effect_type = 'karmic_ring' LIMIT 1`,
        [userId],
      );
      if (karmicRows.length > 0) {
        const bonusPct = karmicRows[0].effect_value ?? 10;
        const karmaBonus = Math.floor(xpGained * (bonusPct / 100));
        if (karmaBonus > 0) {
          newXp = await grantXp(userId, karmaBonus);
          xpGained += karmaBonus;
          message += ` (+${karmaBonus} Karmic Ring bonus)`;
        }
      }
    }

    res.json({ ok: true, message, newXp, xpGained });
  } finally {
    client.release();
  }
});

// ── DELETE /api/user/bag/discard ──────────────────────────────────────────────

router.delete("/user/bag/discard", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { inventoryId } = req.body ?? {};
  if (typeof inventoryId !== "number") {
    res.status(400).json({ error: "inventoryId required" }); return;
  }

  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT id FROM user_inventory WHERE id = $1 AND user_id = $2`,
      [inventoryId, userId],
    );
    if (rows.length === 0) {
      res.status(404).json({ error: "Item not found in your bag" }); return;
    }

    await client.query(`DELETE FROM user_inventory WHERE id = $1`, [inventoryId]);
    res.json({ ok: true });
  } finally {
    client.release();
  }
});

// ── GET /api/user/bag/slots ───────────────────────────────────────────────────

router.get("/user/bag/slots", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const slots = await getBagSlots(userId);
  res.json({ totalSlots: slots, defaultSlots: DEFAULT_BAG_SLOTS, overflowSlots: OVERFLOW_SLOTS });
});

export default router;
export { getBagSlots, getActiveEffects, grantXp };
