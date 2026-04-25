import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { pool } from "@workspace/db";
import { grantXp } from "./bag";

const router: IRouter = Router();

const RARITY_ORDER = ["common", "uncommon", "rare", "epic", "mythic", "legendary"];

// Cauldron success rate bonuses
const CAULDRON_BONUS: Record<string, number> = {
  cauldron_bronze: 20,
  cauldron_spirit: 35,
  cauldron_heaven: 40,   // results in 100% when added to base 60%
  cauldron_chaos: 40,
};

// ── GET /api/user/crafting/recipes ────────────────────────────────────────────

router.get("/user/crafting/recipes", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const client = await pool.connect();
  try {
    const { rows: known } = await client.query(
      `SELECT kr.recipe_id, kr.discovered_at,
              cr.result_item_id, cr.ingredient_1_id, cr.ingredient_2_id,
              cr.ingredient_3_id, cr.ingredient_4_id,
              cr.required_cauldron, cr.base_success_rate, cr.recipe_type,
              ri.name AS result_name, ri.icon AS result_icon, ri.rarity AS result_rarity,
              i1.name AS ing1_name, i1.icon AS ing1_icon,
              i2.name AS ing2_name, i2.icon AS ing2_icon,
              i3.name AS ing3_name, i3.icon AS ing3_icon,
              i4.name AS ing4_name, i4.icon AS ing4_icon
       FROM known_recipes kr
       JOIN crafting_recipes cr ON cr.id = kr.recipe_id
       JOIN items_master ri ON ri.id = cr.result_item_id
       LEFT JOIN items_master i1 ON i1.id = cr.ingredient_1_id
       LEFT JOIN items_master i2 ON i2.id = cr.ingredient_2_id
       LEFT JOIN items_master i3 ON i3.id = cr.ingredient_3_id
       LEFT JOIN items_master i4 ON i4.id = cr.ingredient_4_id
       WHERE kr.user_id = $1
       ORDER BY ri.rarity DESC, ri.name`,
      [userId],
    );

    res.json(known);
  } finally {
    client.release();
  }
});

// ── GET /api/user/crafting/all-recipes ────────────────────────────────────────
// Returns all recipes for display in the recipe book

router.get("/user/crafting/all-recipes", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT cr.id,
              cr.result_item_id, cr.ingredient_1_id, cr.ingredient_2_id,
              cr.ingredient_3_id, cr.ingredient_4_id,
              cr.required_cauldron, cr.base_success_rate, cr.recipe_type,
              ri.name AS result_name, ri.icon AS result_icon, ri.rarity AS result_rarity,
              ri.description AS result_description,
              i1.name AS ing1_name, i1.icon AS ing1_icon, i1.rarity AS ing1_rarity,
              i2.name AS ing2_name, i2.icon AS ing2_icon, i2.rarity AS ing2_rarity,
              i3.name AS ing3_name, i3.icon AS ing3_icon, i3.rarity AS ing3_rarity,
              i4.name AS ing4_name, i4.icon AS ing4_icon, i4.rarity AS ing4_rarity,
              EXISTS(
                SELECT 1 FROM known_recipes kr
                WHERE kr.user_id = $1 AND kr.recipe_id = cr.id
              ) AS is_known
       FROM crafting_recipes cr
       JOIN items_master ri ON ri.id = cr.result_item_id
       LEFT JOIN items_master i1 ON i1.id = cr.ingredient_1_id
       LEFT JOIN items_master i2 ON i2.id = cr.ingredient_2_id
       LEFT JOIN items_master i3 ON i3.id = cr.ingredient_3_id
       LEFT JOIN items_master i4 ON i4.id = cr.ingredient_4_id
       ORDER BY cr.recipe_type, ri.rarity DESC, ri.name`,
      [userId],
    );

    res.json(rows);
  } finally {
    client.release();
  }
});

// ── POST /api/user/crafting/fusion ────────────────────────────────────────────

router.post("/user/crafting/fusion", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { inventoryIds } = req.body ?? {};
  if (!Array.isArray(inventoryIds) || inventoryIds.length !== 3) {
    res.status(400).json({ error: "Select exactly 3 identical items" }); return;
  }

  const client = await pool.connect();
  try {
    // Fetch all 3 inventory records
    const { rows: invRows } = await client.query(
      `SELECT ui.id, ui.item_id, ui.quantity,
              im.name, im.rarity, im.category, im.icon
       FROM user_inventory ui
       JOIN items_master im ON im.id = ui.item_id
       WHERE ui.id = ANY($1::int[]) AND ui.user_id = $2`,
      [inventoryIds, userId],
    );

    if (invRows.length !== 3) {
      res.status(400).json({ error: "Items not found in your bag" }); return;
    }

    // All must be the same item
    const uniqueNames = new Set(invRows.map(r => r.name));
    if (uniqueNames.size !== 1) {
      res.status(400).json({ error: "All 3 items must be identical" }); return;
    }

    const item = invRows[0];
    const rarityIdx = RARITY_ORDER.indexOf(item.rarity);

    // Fusion only works up to Epic → cannot produce Mythic or Legendary
    if (rarityIdx < 0 || rarityIdx >= RARITY_ORDER.indexOf("epic")) {
      res.status(400).json({ error: "Fusion cannot produce Mythic or Legendary items" }); return;
    }

    const targetRarity = RARITY_ORDER[rarityIdx + 1];

    // Find a random item of the next rarity in the same category
    const { rows: resultCandidates } = await client.query(
      `SELECT id, name, icon, rarity FROM items_master
       WHERE category = $1 AND rarity = $2 AND is_chest_obtainable = TRUE
       ORDER BY RANDOM() LIMIT 1`,
      [item.category, targetRarity],
    );

    if (resultCandidates.length === 0) {
      res.status(400).json({ error: "No items of the next rarity exist in this category" }); return;
    }

    const result = resultCandidates[0];

    // Consume 3 items (deduct quantity or delete)
    for (const inv of invRows) {
      if (inv.quantity > 1) {
        await client.query(
          `UPDATE user_inventory SET quantity = quantity - 1 WHERE id = $1`,
          [inv.id],
        );
      } else {
        await client.query(`DELETE FROM user_inventory WHERE id = $1`, [inv.id]);
      }
    }

    // Grant result item
    await client.query(
      `INSERT INTO user_inventory (user_id, item_id, quantity) VALUES ($1,$2,1)`,
      [userId, result.id],
    );

    res.json({
      ok: true,
      result: { id: result.id, name: result.name, icon: result.icon, rarity: result.rarity },
      message: `Fusion successful! 3× ${item.name} → ${result.name} (${result.rarity})`,
    });
  } finally {
    client.release();
  }
});

// ── POST /api/user/crafting/alchemy ──────────────────────────────────────────

router.post("/user/crafting/alchemy", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { recipeId, inventoryIds } = req.body ?? {};
  if (typeof recipeId !== "number" || !Array.isArray(inventoryIds)) {
    res.status(400).json({ error: "recipeId and inventoryIds required" }); return;
  }

  const client = await pool.connect();
  try {
    // Check known recipe
    const { rows: knownRows } = await client.query(
      `SELECT 1 FROM known_recipes WHERE user_id = $1 AND recipe_id = $2`,
      [userId, recipeId],
    );
    if (knownRows.length === 0) {
      res.status(403).json({ error: "Recipe not known" }); return;
    }

    // Fetch recipe
    const { rows: recipeRows } = await client.query(
      `SELECT cr.*, ri.name AS result_name, ri.icon AS result_icon, ri.rarity AS result_rarity
       FROM crafting_recipes cr
       JOIN items_master ri ON ri.id = cr.result_item_id
       WHERE cr.id = $1 AND cr.recipe_type = 'alchemy'`,
      [recipeId],
    );
    if (recipeRows.length === 0) {
      res.status(404).json({ error: "Recipe not found" }); return;
    }

    const recipe = recipeRows[0];

    // Check alchemy cooldown (1 hour, unless Immortal Alchemy or Jade Emperor active)
    const { rows: noCooldown } = await client.query(
      `SELECT 1 FROM permanent_modifiers WHERE user_id = $1 AND modifier_type = 'alchemy_no_cooldown' LIMIT 1
       UNION ALL
       SELECT 1 FROM active_effects WHERE user_id = $1 AND effect_type = 'jade_emperor' AND expires_at > NOW() LIMIT 1`,
      [userId],
    );

    if (noCooldown.length === 0) {
      const { rows: cdRows } = await client.query(
        `SELECT used_at FROM item_use_log
         WHERE user_id = $1 AND metadata = 'alchemy_attempt'
           AND used_at > NOW() - INTERVAL '1 hour'
         ORDER BY used_at DESC LIMIT 1`,
        [userId],
      );

      // Check alchemy mastery (50% reduction)
      if (cdRows.length > 0) {
        const { rows: masteryRows } = await client.query(
          `SELECT 1 FROM permanent_modifiers WHERE user_id = $1 AND modifier_type = 'alchemy_cooldown_reduction' LIMIT 1`,
          [userId],
        );
        const cooldownMs = masteryRows.length > 0 ? 30 * 60_000 : 60 * 60_000;
        const lastUsed: Date = cdRows[0].used_at;
        const cooldownEnds = new Date(lastUsed.getTime() + cooldownMs);
        if (cooldownEnds > new Date()) {
          const remaining = Math.ceil((cooldownEnds.getTime() - Date.now()) / 60_000);
          res.status(429).json({ error: `Alchemy on cooldown — ${remaining} minutes remaining` }); return;
        }
      }
    }

    // Compute success rate
    let successRate = recipe.base_success_rate;

    // Add cauldron bonus
    const { rows: cauldronRows } = await client.query(
      `SELECT effect_value, metadata FROM active_effects
       WHERE user_id = $1 AND effect_type = 'cauldron' AND expires_at > NOW() LIMIT 1`,
      [userId],
    );
    if (cauldronRows.length > 0) {
      const meta = cauldronRows[0].metadata ? JSON.parse(cauldronRows[0].metadata) : {};
      const cauldronType: string = meta.cauldronType ?? "";
      successRate += CAULDRON_BONUS[cauldronType] ?? 0;
    }
    successRate = Math.min(100, successRate);

    // Log the attempt
    await client.query(
      `INSERT INTO item_use_log (user_id, item_id, metadata) VALUES ($1,$2,'alchemy_attempt')`,
      [userId, recipe.ingredient_1_id ?? recipe.result_item_id],
    );

    const success = Math.random() * 100 < successRate;

    if (success) {
      // Consume ingredients
      for (const invId of inventoryIds) {
        const { rows: invRows } = await client.query(
          `SELECT id, quantity FROM user_inventory WHERE id = $1 AND user_id = $2`,
          [invId, userId],
        );
        if (invRows.length > 0) {
          if (invRows[0].quantity > 1) {
            await client.query(`UPDATE user_inventory SET quantity = quantity - 1 WHERE id = $1`, [invId]);
          } else {
            await client.query(`DELETE FROM user_inventory WHERE id = $1`, [invId]);
          }
        }
      }

      // Grant result item
      await client.query(
        `INSERT INTO user_inventory (user_id, item_id, quantity) VALUES ($1,$2,1)`,
        [userId, recipe.result_item_id],
      );

      res.json({
        ok: true,
        success: true,
        result: { id: recipe.result_item_id, name: recipe.result_name, icon: recipe.result_icon, rarity: recipe.result_rarity },
        message: `Alchemy succeeded! You crafted ${recipe.result_name}!`,
      });
    } else {
      // Failed — destroy ingredients, give 1 Failure Ash, log XP loss to karma_pill_log
      for (const invId of inventoryIds) {
        const { rows: invRows } = await client.query(
          `SELECT ui.id, ui.quantity, ui.item_id, im.effect_value
           FROM user_inventory ui
           JOIN items_master im ON im.id = ui.item_id
           WHERE ui.id = $1 AND ui.user_id = $2`,
          [invId, userId],
        );
        if (invRows.length > 0) {
          const xpLoss = invRows[0].effect_value ?? 0;
          if (xpLoss > 0) {
            await client.query(
              `INSERT INTO karma_pill_log (user_id, xp_lost) VALUES ($1,$2)`,
              [userId, xpLoss],
            );
          }
          if (invRows[0].quantity > 1) {
            await client.query(`UPDATE user_inventory SET quantity = quantity - 1 WHERE id = $1`, [invId]);
          } else {
            await client.query(`DELETE FROM user_inventory WHERE id = $1`, [invId]);
          }
        }
      }

      // Grant 1 Failure Ash
      await client.query(
        `INSERT INTO failure_ashes (user_id, count) VALUES ($1, 1)
         ON CONFLICT (user_id) DO UPDATE SET count = failure_ashes.count + 1`,
        [userId],
      );

      res.json({
        ok: true,
        success: false,
        message: "Alchemy failed — ingredients destroyed. You received 1 Failure Ash.",
      });
    }
  } finally {
    client.release();
  }
});

// ── POST /api/user/crafting/tribulation ──────────────────────────────────────

router.post("/user/crafting/tribulation", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { recipeId, inventoryIds } = req.body ?? {};
  if (typeof recipeId !== "number" || !Array.isArray(inventoryIds)) {
    res.status(400).json({ error: "recipeId and inventoryIds required" }); return;
  }

  const client = await pool.connect();
  try {
    // Check known recipe
    const { rows: knownRows } = await client.query(
      `SELECT 1 FROM known_recipes WHERE user_id = $1 AND recipe_id = $2`,
      [userId, recipeId],
    );
    if (knownRows.length === 0) {
      res.status(403).json({ error: "Recipe not known" }); return;
    }

    // Fetch recipe
    const { rows: recipeRows } = await client.query(
      `SELECT cr.*, ri.name AS result_name, ri.icon AS result_icon, ri.rarity AS result_rarity
       FROM crafting_recipes cr
       JOIN items_master ri ON ri.id = cr.result_item_id
       WHERE cr.id = $1 AND cr.recipe_type = 'tribulation'`,
      [recipeId],
    );
    if (recipeRows.length === 0) {
      res.status(404).json({ error: "Tribulation recipe not found" }); return;
    }

    const recipe = recipeRows[0];

    // Check 24-hour cooldown (unless Jade Emperor active)
    const { rows: noCooldown } = await client.query(
      `SELECT 1 FROM active_effects
       WHERE user_id = $1 AND effect_type = 'jade_emperor' AND expires_at > NOW() LIMIT 1`,
      [userId],
    );

    if (noCooldown.length === 0) {
      const { rows: cdRows } = await client.query(
        `SELECT used_at FROM item_use_log
         WHERE user_id = $1 AND metadata = 'tribulation_attempt'
           AND used_at > NOW() - INTERVAL '24 hours'
         ORDER BY used_at DESC LIMIT 1`,
        [userId],
      );
      if (cdRows.length > 0) {
        const remaining = Math.ceil((new Date(cdRows[0].used_at).getTime() + 24 * 3600_000 - Date.now()) / 60_000);
        res.status(429).json({ error: `Tribulation on cooldown — ${remaining} minutes remaining` }); return;
      }
    }

    // Compute success rate
    let successRate = 30; // base

    const { rows: cauldronRows } = await client.query(
      `SELECT metadata FROM active_effects
       WHERE user_id = $1 AND effect_type = 'cauldron' AND expires_at > NOW() LIMIT 1`,
      [userId],
    );
    if (cauldronRows.length > 0) {
      const meta = cauldronRows[0].metadata ? JSON.parse(cauldronRows[0].metadata) : {};
      if (meta.cauldronType === "cauldron_heaven") successRate = 50;
      if (meta.cauldronType === "cauldron_chaos") successRate = 70;
    }

    const { rows: jadeRows } = await client.query(
      `SELECT 1 FROM active_effects WHERE user_id = $1 AND effect_type = 'jade_emperor' AND expires_at > NOW() LIMIT 1`,
      [userId],
    );
    if (jadeRows.length > 0) successRate = 100;

    // Log attempt
    await client.query(
      `INSERT INTO item_use_log (user_id, item_id, metadata) VALUES ($1,$2,'tribulation_attempt')`,
      [userId, recipe.result_item_id],
    );

    const roll = Math.random() * 100;
    const success = roll < successRate;

    if (success) {
      for (const invId of inventoryIds) {
        const { rows: invRows } = await client.query(
          `SELECT id, quantity FROM user_inventory WHERE id = $1 AND user_id = $2`,
          [invId, userId],
        );
        if (invRows.length > 0) {
          if (invRows[0].quantity > 1) {
            await client.query(`UPDATE user_inventory SET quantity = quantity - 1 WHERE id = $1`, [invId]);
          } else {
            await client.query(`DELETE FROM user_inventory WHERE id = $1`, [invId]);
          }
        }
      }
      await client.query(
        `INSERT INTO user_inventory (user_id, item_id, quantity) VALUES ($1,$2,1)`,
        [userId, recipe.result_item_id],
      );
      res.json({
        ok: true, success: true,
        result: { name: recipe.result_name, icon: recipe.result_icon, rarity: recipe.result_rarity },
        message: `Tribulation overcome! You forged ${recipe.result_name}!`,
      });
      return;
    }

    // Failed — three possible outcomes
    const failRoll = Math.random();

    if (failRoll < 0.40) {
      // 40% — ingredients lost, nothing
      for (const invId of inventoryIds) {
        await client.query(`DELETE FROM user_inventory WHERE id = $1 AND user_id = $2`, [invId, userId]);
      }
      res.json({ ok: true, success: false, outcome: "destroyed", message: "The tribulation backlash destroyed all ingredients. Nothing was gained." });

    } else if (failRoll < 0.70) {
      // 30% — ingredients lost, random Epic consolation
      for (const invId of inventoryIds) {
        await client.query(`DELETE FROM user_inventory WHERE id = $1 AND user_id = $2`, [invId, userId]);
      }
      const { rows: epicRows } = await client.query(
        `SELECT id, name, icon, rarity FROM items_master
         WHERE rarity = 'epic' AND is_chest_obtainable = TRUE ORDER BY RANDOM() LIMIT 1`,
      );
      let consolationMsg = "ingredients lost";
      if (epicRows.length > 0) {
        await client.query(
          `INSERT INTO user_inventory (user_id, item_id, quantity) VALUES ($1,$2,1)`,
          [userId, epicRows[0].id],
        );
        consolationMsg = `You received ${epicRows[0].icon} ${epicRows[0].name} as consolation.`;
      }
      res.json({ ok: true, success: false, outcome: "consolation", message: `Tribulation failed — ${consolationMsg}` });

    } else {
      // 30% — Tribulation Backlash — keep ingredients, lose 10% of current XP
      const { rows: profRows } = await client.query(
        `SELECT xp FROM user_profiles WHERE clerk_user_id = $1`,
        [userId],
      );
      const currentXp = profRows[0]?.xp ?? 0;
      const xpLoss = Math.floor(currentXp * 0.10);

      // Check xp_penalty_immune
      const { rows: immuneRows } = await client.query(
        `SELECT 1 FROM active_effects WHERE user_id = $1 AND effect_type = 'xp_penalty_immune' AND expires_at > NOW() LIMIT 1`,
        [userId],
      );

      let lossMsg = "";
      if (immuneRows.length > 0) {
        lossMsg = "Heaven Locking Seal blocked the XP loss!";
      } else if (xpLoss > 0) {
        await client.query(
          `UPDATE user_profiles SET xp = GREATEST(0, xp - $1), updated_at = NOW()
           WHERE clerk_user_id = $2`,
          [xpLoss, userId],
        );
        await client.query(
          `INSERT INTO karma_pill_log (user_id, xp_lost) VALUES ($1,$2)`,
          [userId, xpLoss],
        );
        lossMsg = `-${xpLoss} XP (10% backlash)`;
      }

      res.json({
        ok: true, success: false, outcome: "backlash",
        message: `Tribulation Backlash! Ingredients preserved but ${lossMsg}. You may retry.`,
        xpLost: immuneRows.length > 0 ? 0 : xpLoss,
      });
    }
  } finally {
    client.release();
  }
});

export default router;
