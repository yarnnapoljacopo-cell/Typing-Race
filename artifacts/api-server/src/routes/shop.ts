import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { pool } from "@workspace/db";
import { ensureUserCoins, dailyResetCheck, deductCoins } from "../lib/coinHelper";

const router: IRouter = Router();

// Maps shop item_type → user_chests chest_type
const ITEM_TYPE_TO_CHEST: Record<string, string> = {
  mortal_chest:   "mortal",
  iron_chest:     "iron",
  crystal_chest:  "crystal",
  inferno_chest:  "inferno",
  immortal_chest: "immortal",
};

// ── GET /api/shop ─────────────────────────────────────────────────────────────
// Returns all available listings with how many the user has bought today.

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
              is_available, display_order, daily_purchase_limit
       FROM shop_listings
       WHERE is_available = TRUE
       ORDER BY display_order`,
    );

    // Count today's purchases per listing for this user
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

    res.json({
      balance,
      listings: listings.map(l => ({
        ...l,
        purchases_today: todayMap[String(l.id)] ?? 0,
      })),
    });
  } finally {
    client.release();
  }
});

// ── POST /api/shop/buy ────────────────────────────────────────────────────────
// Body: { listing_id: number }

router.post("/shop/buy", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { listing_id } = req.body ?? {};
  if (!listing_id) { res.status(400).json({ error: "listing_id required" }); return; }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Step 1: Validate listing
    const { rows: listingRows } = await client.query(
      `SELECT id, name, item_type, quantity, price, daily_purchase_limit, is_available
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
    };

    // Step 3: Deduct coins (validates balance)
    await ensureUserCoins(client, userId);
    await dailyResetCheck(client, userId);
    let newBalance: number;
    try {
      ({ newBalance } = await deductCoins(
        client,
        userId,
        listing.price,
        String(listing.id),
        `Shop: ${listing.name}`,
      ));
    } catch {
      await client.query("ROLLBACK");
      res.status(400).json({ error: "Insufficient Spirit Coins" });
      return;
    }

    // Step 4: Grant chest(s)
    const chestType = ITEM_TYPE_TO_CHEST[listing.item_type];
    if (!chestType) {
      await client.query("ROLLBACK");
      res.status(500).json({ error: "Invalid item type in listing" });
      return;
    }
    await client.query(
      `INSERT INTO user_chests (user_id, chest_type, quantity)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, chest_type)
       DO UPDATE SET quantity = user_chests.quantity + $3, earned_at = NOW()`,
      [userId, chestType, listing.quantity],
    );

    await client.query("COMMIT");
    res.json({
      new_balance: newBalance,
      chest_type: chestType,
      quantity_added: listing.quantity,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
});

export default router;
