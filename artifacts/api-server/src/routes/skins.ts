import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { db, userProfilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

// ── Skin catalog (server-side authority) ─────────────────────────────────────
// Free-tier MVP: a small set of car & road skins, all unlocked for everyone.
// Locked entries are listed for display only and cannot be equipped.

interface CarSkinDef {
  key: string;
  name: string;
  rarity: "common" | "rare" | "epic" | "legendary" | "ultra";
  unlocked: boolean;
}

interface RoadSkinDef {
  key: string;
  name: string;
  rarity: "common" | "rare" | "epic" | "legendary" | "ultra";
  unlocked: boolean;
}

const CAR_SKINS: CarSkinDef[] = [
  { key: "bluebird",  name: "Bluebird",        rarity: "common",    unlocked: true  },
  { key: "firebolt",  name: "Firebolt",        rarity: "rare",      unlocked: true  },
  { key: "jade",      name: "Jade Rider",      rarity: "rare",      unlocked: true  },
  { key: "shadow",    name: "Shadow Racer",    rarity: "epic",      unlocked: false },
  { key: "crimson",   name: "Crimson Beast",   rarity: "epic",      unlocked: false },
  { key: "royal",     name: "Royal Phantom",   rarity: "legendary", unlocked: false },
  { key: "gilded",    name: "Gilded Emperor",  rarity: "legendary", unlocked: false },
  { key: "void",      name: "Void Serpent",    rarity: "epic",      unlocked: false },
  { key: "arctic",    name: "Arctic Storm",    rarity: "epic",      unlocked: false },
  { key: "sakura",    name: "Sakura Drift",    rarity: "rare",      unlocked: false },
  { key: "thunder",   name: "Thunder God",     rarity: "legendary", unlocked: false },
  { key: "cyber",     name: "Cyber Grid",      rarity: "legendary", unlocked: false },
  { key: "celestial", name: "Celestial Titan", rarity: "ultra",     unlocked: false },
  { key: "inferno",   name: "Inferno God",     rarity: "ultra",     unlocked: false },
];

const ROAD_SKINS: RoadSkinDef[] = [
  { key: "mushroom",   name: "Mushroom Kingdom", rarity: "common",    unlocked: true  },
  { key: "ghost",      name: "Ghost House",      rarity: "rare",      unlocked: true  },
  { key: "volcano",    name: "Volcano Peak",     rarity: "epic",      unlocked: true  },
  { key: "ice",        name: "Ice Palace",       rarity: "epic",      unlocked: false },
  { key: "rainbow",    name: "Rainbow Road",     rarity: "legendary", unlocked: false },
  { key: "desert",     name: "Desert Dunes",     rarity: "rare",      unlocked: false },
  { key: "underwater", name: "Underwater Reef",  rarity: "epic",      unlocked: false },
  { key: "space",      name: "Deep Space",       rarity: "legendary", unlocked: false },
  { key: "autumn",     name: "Autumn Festival",  rarity: "rare",      unlocked: false },
  { key: "neon",       name: "Neon City",        rarity: "legendary", unlocked: false },
];

const CAR_KEYS = new Set(CAR_SKINS.map(s => s.key));
const ROAD_KEYS = new Set(ROAD_SKINS.map(s => s.key));
const UNLOCKED_CARS = new Set(CAR_SKINS.filter(s => s.unlocked).map(s => s.key));
const UNLOCKED_ROADS = new Set(ROAD_SKINS.filter(s => s.unlocked).map(s => s.key));

router.get("/skins", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;

  let equippedCarSkin = "bluebird";
  let equippedRoadSkin = "mushroom";

  if (clerkUserId) {
    try {
      const rows = await db
        .select({
          equippedCarSkin: userProfilesTable.equippedCarSkin,
          equippedRoadSkin: userProfilesTable.equippedRoadSkin,
        })
        .from(userProfilesTable)
        .where(eq(userProfilesTable.clerkUserId, clerkUserId))
        .limit(1);
      if (rows[0]) {
        equippedCarSkin = rows[0].equippedCarSkin ?? "bluebird";
        equippedRoadSkin = rows[0].equippedRoadSkin ?? "mushroom";
      }
    } catch {
      // Non-fatal — return defaults
    }
  }

  res.json({
    cars: CAR_SKINS,
    roads: ROAD_SKINS,
    equippedCarSkin,
    equippedRoadSkin,
  });
});

router.post("/skins/equip", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { type, key } = req.body ?? {};
  if (typeof type !== "string" || typeof key !== "string") {
    res.status(400).json({ error: "type and key are required" }); return;
  }

  if (type === "car") {
    if (!CAR_KEYS.has(key)) { res.status(400).json({ error: "Unknown car skin" }); return; }
    if (!UNLOCKED_CARS.has(key)) { res.status(403).json({ error: "Car skin is locked" }); return; }
    await db
      .update(userProfilesTable)
      .set({ equippedCarSkin: key, updatedAt: new Date() })
      .where(eq(userProfilesTable.clerkUserId, clerkUserId));
    res.json({ ok: true, equippedCarSkin: key });
    return;
  }

  if (type === "road") {
    if (!ROAD_KEYS.has(key)) { res.status(400).json({ error: "Unknown road skin" }); return; }
    if (!UNLOCKED_ROADS.has(key)) { res.status(403).json({ error: "Road skin is locked" }); return; }
    await db
      .update(userProfilesTable)
      .set({ equippedRoadSkin: key, updatedAt: new Date() })
      .where(eq(userProfilesTable.clerkUserId, clerkUserId));
    res.json({ ok: true, equippedRoadSkin: key });
    return;
  }

  res.status(400).json({ error: "type must be 'car' or 'road'" });
});

export default router;
