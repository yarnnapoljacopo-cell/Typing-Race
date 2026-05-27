import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { pool } from "@workspace/db";
import { ensureUserCoins, dailyResetCheck, deductCoins } from "../lib/coinHelper";
import { mutationLimiter } from "../lib/rateLimits";

const router: IRouter = Router();

// Maps shop item_type → user_chests chest_type for `listing_type='chest'` rows.
const ITEM_TYPE_TO_CHEST: Record<string, string> = {
  mortal_chest:   "mortal",
  iron_chest:     "iron",
  crystal_chest:  "crystal",
  inferno_chest:  "inferno",
  immortal_chest: "immortal",
};

// ── Daily-featured rotation ─────────────────────────────────────────────────
// Deterministic per-UTC-day pick from the pool of featured-eligible listings.
// The same hash is computed on the client UI (just for the countdown), but
// the SERVER is the source of truth — every buy verifies featured status
// here before applying the discount, so a client clock skew can't cheat.
const DAILY_DISCOUNT_PCT = 25; // headline % off

function utcDayIndex(now = new Date()): number {
  // Days since unix epoch, in UTC.
  return Math.floor(now.getTime() / 86400000);
}

function pickFeaturedListingId(eligibleIds: number[], now = new Date()): number | null {
  if (eligibleIds.length === 0) return null;
  const idx = utcDayIndex(now) % eligibleIds.length;
  return eligibleIds[idx];
}

function utcMidnightTomorrow(now = new Date()): Date {
  const next = new Date(now);
  next.setUTCDate(next.getUTCDate() + 1);
  next.setUTCHours(0, 0, 0, 0);
  return next;
}

function applyDiscount(price: number, pct: number): number {
  // Round DOWN to favour the buyer ever-so-slightly (and produce a clean int).
  return Math.max(1, Math.floor(price * (100 - pct) / 100));
}

// ── Mystery Crate roll weights ──────────────────────────────────────────────
// Server-side rarity weighting — feels generous on average, occasional
// jackpot. Sum doesn't need to be 100; weights are normalized by index.
const MYSTERY_CRATE_WEIGHTS: Array<{ chestType: string; weight: number }> = [
  { chestType: "mortal",   weight: 50 },
  { chestType: "iron",     weight: 26 },
  { chestType: "crystal",  weight: 14 },
  { chestType: "inferno",  weight: 7  },
  { chestType: "immortal", weight: 3  },
];

function rollMysteryChest(): string {
  const total = MYSTERY_CRATE_WEIGHTS.reduce((s, w) => s + w.weight, 0);
  let r = Math.random() * total;
  for (const w of MYSTERY_CRATE_WEIGHTS) {
    if ((r -= w.weight) < 0) return w.chestType;
  }
  return MYSTERY_CRATE_WEIGHTS[0].chestType;
}

// ── GET /api/shop ─────────────────────────────────────────────────────────────
// Returns all listings for all three merchants in a single payload plus the
// player's coin balance, today's featured listing (with discount + expiry),
// and the user's currently pinned wishlist target if any.

router.get("/shop", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const client = await pool.connect();
  try {
    await ensureUserCoins(client, userId);
    await dailyResetCheck(client, userId);

    const { rows: listings } = await client.query(
      `SELECT id, name, description, item_type, quantity, price, icon,
              is_available, display_order, daily_purchase_limit,
              merchant, listing_type, result_item_id, result_recipe_id,
              featured_eligible
       FROM shop_listings
       WHERE is_available = TRUE
       ORDER BY display_order`,
    );

    // Today's purchase counts (for per-listing daily limits + UX hints).
    const { rows: todayRows } = await client.query(
      `SELECT reference_id, COUNT(*) AS purchases
       FROM coin_transactions
       WHERE user_id = $1
         AND transaction_type = 'shop_purchase'
         AND created_at >= DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC')
       GROUP BY reference_id`,
      [userId],
    );
    const todayMap: Record<string, number> = {};
    for (const r of todayRows) {
      todayMap[r.reference_id as string] = Number(r.purchases);
    }

    const { rows: coinRows } = await client.query(
      `SELECT balance FROM user_coins WHERE user_id = $1`,
      [userId],
    );
    const balance = (coinRows[0] as { balance: number })?.balance ?? 0;

    // Daily featured pick — only featured_eligible rows participate.
    const eligibleIds = listings
      .filter((l: { featured_eligible: boolean }) => l.featured_eligible)
      .map((l: { id: number }) => l.id);
    const featuredId = pickFeaturedListingId(eligibleIds);
    const featured = featuredId !== null
      ? {
          listing_id: featuredId,
          discount_pct: DAILY_DISCOUNT_PCT,
          ends_at: utcMidnightTomorrow().toISOString(),
        }
      : null;

    // Wishlist pin.
    const { rows: wishRows } = await client.query(
      `SELECT listing_id, pinned_at FROM shop_wishlist WHERE user_id = $1`,
      [userId],
    );
    const wishlist = wishRows[0]
      ? {
          listing_id: wishRows[0].listing_id as number,
          pinned_at: (wishRows[0].pinned_at as Date).toISOString(),
        }
      : null;

    res.json({
      balance,
      listings: listings.map(l => ({
        ...l,
        purchases_today: todayMap[String(l.id)] ?? 0,
      })),
      featured,
      wishlist,
    });
  } finally {
    client.release();
  }
});

// ── POST /api/shop/buy ────────────────────────────────────────────────────────
// Body: { listing_id: number }
// Handles all four listing types: 'chest', 'item', 'recipe', 'mystery_crate'.
// Applies the daily-featured discount when listing_id matches today's pick.

router.post("/shop/buy", mutationLimiter, async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { listing_id } = req.body ?? {};
  if (!listing_id) { res.status(400).json({ error: "listing_id required" }); return; }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: listingRows } = await client.query(
      `SELECT id, name, item_type, quantity, price, daily_purchase_limit,
              is_available, listing_type, result_item_id, result_recipe_id,
              featured_eligible
       FROM shop_listings WHERE id = $1`,
      [listing_id],
    );
    if (listingRows.length === 0 || !listingRows[0].is_available) {
      await client.query("ROLLBACK");
      res.status(404).json({ error: "Listing not available" });
      return;
    }
    const listing = listingRows[0] as {
      id: number; name: string; item_type: string; quantity: number;
      price: number; daily_purchase_limit: number; is_available: boolean;
      listing_type: string;
      result_item_id: number | null;
      result_recipe_id: number | null;
      featured_eligible: boolean;
    };

    // Compute the effective price — featured discount applies if this is
    // today's pick AND the listing is in the featured-eligible pool.
    let effectivePrice = listing.price;
    let featuredDiscountApplied = false;
    if (listing.featured_eligible) {
      const { rows: allEligible } = await client.query(
        `SELECT id FROM shop_listings WHERE featured_eligible = TRUE AND is_available = TRUE ORDER BY display_order`,
      );
      const featuredId = pickFeaturedListingId(allEligible.map((r: { id: number }) => r.id));
      if (featuredId === listing.id) {
        effectivePrice = applyDiscount(listing.price, DAILY_DISCOUNT_PCT);
        featuredDiscountApplied = true;
      }
    }

    await ensureUserCoins(client, userId);
    await dailyResetCheck(client, userId);
    let newBalance: number;
    try {
      ({ newBalance } = await deductCoins(
        client,
        userId,
        effectivePrice,
        String(listing.id),
        `Shop: ${listing.name}${featuredDiscountApplied ? " (Daily Featured)" : ""}`,
      ));
    } catch {
      await client.query("ROLLBACK");
      res.status(400).json({ error: "Insufficient Spirit Coins" });
      return;
    }

    // Branch by listing_type. Each branch:
    //  - mutates the relevant grant table inside the same transaction
    //  - builds the response body so the client can show the right toast
    let response: Record<string, unknown> = {
      new_balance: newBalance,
      effective_price: effectivePrice,
      featured_discount_applied: featuredDiscountApplied,
    };

    switch (listing.listing_type) {
      case "chest": {
        const chestType = ITEM_TYPE_TO_CHEST[listing.item_type];
        if (!chestType) {
          await client.query("ROLLBACK");
          res.status(500).json({ error: "Invalid chest item_type" });
          return;
        }
        await client.query(
          `INSERT INTO user_chests (user_id, chest_type, quantity)
           VALUES ($1, $2, $3)
           ON CONFLICT (user_id, chest_type)
           DO UPDATE SET quantity = user_chests.quantity + $3, earned_at = NOW()`,
          [userId, chestType, listing.quantity],
        );
        response = { ...response, kind: "chest", chest_type: chestType, quantity_added: listing.quantity };
        break;
      }

      case "item": {
        if (!listing.result_item_id) {
          await client.query("ROLLBACK");
          res.status(500).json({ error: "Item listing missing result_item_id" });
          return;
        }
        await client.query(
          `INSERT INTO user_inventory (user_id, item_id, quantity, acquired_at)
           VALUES ($1, $2, $3, NOW())`,
          [userId, listing.result_item_id, listing.quantity],
        );
        const { rows: itemRows } = await client.query(
          `SELECT name, icon, rarity FROM items_master WHERE id = $1`,
          [listing.result_item_id],
        );
        response = {
          ...response,
          kind: "item",
          item_name: itemRows[0]?.name ?? listing.name,
          item_icon: itemRows[0]?.icon ?? "💊",
          item_rarity: itemRows[0]?.rarity ?? "common",
          quantity_added: listing.quantity,
        };
        break;
      }

      case "recipe": {
        if (!listing.result_recipe_id) {
          await client.query("ROLLBACK");
          res.status(500).json({ error: "Recipe listing missing result_recipe_id" });
          return;
        }
        // Idempotent: if the user already knows this recipe, this is a no-op
        // but we still take their coins (cosmetic risk — flag for UI to warn
        // before purchase). Use ON CONFLICT DO NOTHING.
        const { rowCount } = await client.query(
          `INSERT INTO known_recipes (user_id, recipe_id)
           VALUES ($1, $2)
           ON CONFLICT (user_id, recipe_id) DO NOTHING`,
          [userId, listing.result_recipe_id],
        );
        response = {
          ...response,
          kind: "recipe",
          recipe_id: listing.result_recipe_id,
          newly_learned: (rowCount ?? 0) > 0,
        };
        break;
      }

      case "mystery_crate": {
        const chestType = rollMysteryChest();
        await client.query(
          `INSERT INTO user_chests (user_id, chest_type, quantity)
           VALUES ($1, $2, 1)
           ON CONFLICT (user_id, chest_type)
           DO UPDATE SET quantity = user_chests.quantity + 1, earned_at = NOW()`,
          [userId, chestType],
        );
        response = { ...response, kind: "mystery_crate", chest_type: chestType, quantity_added: 1 };
        break;
      }

      default: {
        await client.query("ROLLBACK");
        res.status(500).json({ error: `Unknown listing_type: ${listing.listing_type}` });
        return;
      }
    }

    await client.query("COMMIT");
    res.json(response);
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
});

// ── PUT /api/shop/wishlist ────────────────────────────────────────────────────
// Body: { listing_id: number } — pins (or repins) this listing as the user's
// current goal. Returns the persisted record.

router.put("/shop/wishlist", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const listingId = Number(req.body?.listing_id);
  if (!Number.isFinite(listingId)) { res.status(400).json({ error: "listing_id required" }); return; }

  const client = await pool.connect();
  try {
    const { rowCount } = await client.query(
      `SELECT id FROM shop_listings WHERE id = $1 AND is_available = TRUE`,
      [listingId],
    );
    if (!rowCount) { res.status(404).json({ error: "Listing not found" }); return; }

    await client.query(
      `INSERT INTO shop_wishlist (user_id, listing_id, pinned_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id) DO UPDATE
         SET listing_id = EXCLUDED.listing_id,
             pinned_at  = NOW()`,
      [userId, listingId],
    );
    res.json({ ok: true, listing_id: listingId });
  } finally {
    client.release();
  }
});

// ── DELETE /api/shop/wishlist ─────────────────────────────────────────────────
// Clears the user's pinned wishlist target.

router.delete("/shop/wishlist", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const client = await pool.connect();
  try {
    await client.query(`DELETE FROM shop_wishlist WHERE user_id = $1`, [userId]);
    res.json({ ok: true });
  } finally {
    client.release();
  }
});

export default router;
