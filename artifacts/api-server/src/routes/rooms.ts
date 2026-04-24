import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { createRoom, getRoom, getActiveRooms } from "../lib/roomManager";
import { saveWriting, getWriting, getUserSprints } from "../lib/writingStore";
import { CreateRoomBody, GetRoomParams } from "@workspace/api-zod";
import { db, pool, userProfilesTable, sprintWritingTable, friendshipsTable } from "@workspace/db";
import { eq, and, or, ne, desc, sql, max, sum, count, inArray, ilike, gte } from "drizzle-orm";
import bcrypt from "bcrypt";
import { grantChest } from "./chests";

const router: IRouter = Router();

// ── Writing Deviation (XP decay) ────────────────────────────────────────────
// Rank thresholds (index → min XP)
const RANK_THRESHOLDS = [0, 250, 1000, 3500, 10000, 25000, 75000, 200000];
// XP lost per day after 5 days idle, indexed by rank (0–2 = no decay, 3–7 = decay)
const DECAY_RATE_PER_DAY = [0, 0, 0, 15, 40, 100, 250, 500];
const RANKER_MIN_XP = 200000;
const DECAY_GRACE_DAYS = 5;

function getRankIndex(xp: number): number {
  for (let i = RANK_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= RANK_THRESHOLDS[i]) return i;
  }
  return 0;
}

interface DecayResult {
  xpLost: number;
  newXp: number;
}

async function applyXpDecay(clerkUserId: string): Promise<DecayResult | null> {
  const rows = await db
    .select({
      xp: userProfilesTable.xp,
      lastSprintAt: userProfilesTable.lastSprintAt,
      decayCheckedAt: userProfilesTable.decayCheckedAt,
    })
    .from(userProfilesTable)
    .where(eq(userProfilesTable.clerkUserId, clerkUserId))
    .limit(1);

  if (rows.length === 0) return null;
  const { xp, lastSprintAt, decayCheckedAt } = rows[0];
  const now = new Date();

  // No sprint ever recorded → nothing to decay against
  if (!lastSprintAt) return null;

  const rankIndex = getRankIndex(xp);
  if (rankIndex < 3) {
    // Below Author — reset check timestamp so we don't pile up days if they level up later
    await db
      .update(userProfilesTable)
      .set({ decayCheckedAt: now })
      .where(eq(userProfilesTable.clerkUserId, clerkUserId));
    return null;
  }

  // Decay window opens DECAY_GRACE_DAYS after last sprint
  const decayWindowStart = new Date(lastSprintAt.getTime() + DECAY_GRACE_DAYS * 86_400_000);

  // The point from which we haven't yet charged any decay
  const chargeFrom =
    decayCheckedAt && decayCheckedAt > decayWindowStart ? decayCheckedAt : decayWindowStart;

  if (now <= chargeFrom) return null; // Grace period still active

  const decayDays = Math.floor((now.getTime() - chargeFrom.getTime()) / 86_400_000);
  if (decayDays <= 0) return null;

  const decayPerDay = DECAY_RATE_PER_DAY[rankIndex];
  const totalDecay = decayDays * decayPerDay;
  const newXp = Math.max(0, xp - totalDecay);

  await db
    .update(userProfilesTable)
    .set({ xp: newXp, decayCheckedAt: now, updatedAt: now })
    .where(eq(userProfilesTable.clerkUserId, clerkUserId));

  return { xpLost: xp - newXp, newXp };
}

router.get("/rooms", async (_req, res): Promise<void> => {
  res.json(getActiveRooms());
});

// ── Discord webhook helper ────────────────────────────────────────────────────

const DISCORD_WEBHOOK_RE =
  /^https:\/\/(?:discord(?:app)?\.com|ptb\.discord\.com|canary\.discord\.com)\/api\/webhooks\/\d+\/[\w-]+$/i;

function isValidDiscordWebhookUrl(url: string): boolean {
  return DISCORD_WEBHOOK_RE.test(url.trim());
}

async function postDiscordAnnouncement(webhookUrl: string, message: string): Promise<boolean> {
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: message }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function buildSprintAnnouncement(opts: {
  writerName: string;
  durationMinutes: number;
  mode: string;
  wordGoal: number | null;
  roomCode: string;
  countdownDelayMinutes: number;
}): string {
  const { writerName, durationMinutes, mode, wordGoal, roomCode, countdownDelayMinutes } = opts;
  const appBase = (process.env.APP_BASE_URL ?? "https://app.writingsprint.site").replace(/\/$/, "");
  const joinUrl = `${appBase}/room?code=${roomCode}`;

  const modeLabel =
    mode === "goal" && wordGoal ? ` · Goal: ${wordGoal} words` :
    mode === "open" ? " · Open mode (text visible)" :
    mode === "kart" ? " · Kart mode" :
    mode === "gladiator" ? " · Gladiator mode" :
    "";
  const delayLabel = countdownDelayMinutes === 0 ? "starting now" :
    countdownDelayMinutes === 1 ? "starting in 1 minute" :
    `starting in ${countdownDelayMinutes} minutes`;

  return (
    `📝 **${writerName} just kicked off a ${durationMinutes}-minute writing sprint** — ${delayLabel}!${modeLabel}\n` +
    `Room code: \`${roomCode}\`\n` +
    `Join on the web: ${joinUrl}`
  );
}

router.post("/rooms", async (req, res): Promise<void> => {
  const parsed = CreateRoomBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { creatorName, durationMinutes, mode } = parsed.data;
  const rawBody = req.body as Record<string, unknown>;
  const rawDelay = rawBody.countdownDelayMinutes;
  const countdownDelayMinutes = typeof rawDelay === "number"
    ? Math.min(30, Math.max(0, Math.floor(rawDelay)))
    : 0;
  const rawGoal = rawBody.wordGoal;
  const wordGoal = typeof rawGoal === "number" && rawGoal > 0 ? Math.floor(rawGoal) : null;
  const rawDeathWpm = rawBody.deathModeWpm;
  const deathModeWpm = typeof rawDeathWpm === "number" ? rawDeathWpm : null;
  const rawBossGoal = rawBody.bossWordGoal;
  const bossWordGoal = typeof rawBossGoal === "number" && rawBossGoal > 0 ? Math.floor(rawBossGoal) : null;
  const rawPassword = rawBody.roomPassword;
  const passwordHash = (typeof rawPassword === "string" && rawPassword.trim().length > 0)
    ? await bcrypt.hash(rawPassword.trim(), 10)
    : null;
  const rawGladiatorGap = rawBody.gladiatorDeathGap;
  const gladiatorDeathGap = typeof rawGladiatorGap === "number" ? rawGladiatorGap : null;
  const effectiveMode = bossWordGoal ? "boss" : (mode ?? "regular");
  const room = createRoom(creatorName, durationMinutes, effectiveMode, countdownDelayMinutes, wordGoal, deathModeWpm, bossWordGoal, passwordHash, gladiatorDeathGap);

  res.status(201).json({
    code: room.code,
    creatorName: room.creatorName,
    durationMinutes: room.durationMinutes,
    status: room.status,
    participantCount: room.participants.size,
  });

  // Auto-announce to Discord if the authenticated user has a webhook configured
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (clerkUserId) {
    try {
      const profileRows = await db
        .select({ discordWebhookUrl: userProfilesTable.discordWebhookUrl, writerName: userProfilesTable.writerName })
        .from(userProfilesTable)
        .where(eq(userProfilesTable.clerkUserId, clerkUserId))
        .limit(1);
      const webhookUrl = profileRows[0]?.discordWebhookUrl;
      const writerName = profileRows[0]?.writerName ?? creatorName;
      if (webhookUrl && isValidDiscordWebhookUrl(webhookUrl)) {
        const message = buildSprintAnnouncement({
          writerName,
          durationMinutes: room.durationMinutes,
          mode: effectiveMode,
          wordGoal,
          roomCode: room.code,
          countdownDelayMinutes,
        });
        void postDiscordAnnouncement(webhookUrl, message);
      }
    } catch {
      // Non-critical — don't fail the room creation if Discord post fails
    }
  }
});

router.get("/rooms/:code", async (req, res): Promise<void> => {
  const params = GetRoomParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const room = getRoom(params.data.code.toUpperCase());
  if (!room) {
    res.status(404).json({ error: "Room not found" });
    return;
  }

  res.json({
    code: room.code,
    creatorName: room.creatorName,
    durationMinutes: room.durationMinutes,
    status: room.status,
    participantCount: room.participants.size,
    isPasswordProtected: !!room.passwordHash,
  });
});

router.put("/rooms/:code/writing", async (req, res): Promise<void> => {
  const code = req.params.code?.toUpperCase();
  if (!code) { res.status(400).json({ error: "Missing code" }); return; }

  const { participantName, text, wordCount } = req.body ?? {};
  if (typeof participantName !== "string" || !participantName.trim()) {
    res.status(400).json({ error: "participantName required" }); return;
  }
  if (typeof text !== "string") { res.status(400).json({ error: "text required" }); return; }
  const wc = typeof wordCount === "number" ? Math.max(0, Math.floor(wordCount)) : 0;

  const auth = getAuth(req);
  const clerkUserId = auth?.userId ?? null;

  const room = getRoom(code);
  await saveWriting(code, participantName.trim(), text, wc, clerkUserId, room?.mode ?? null, room?.wordGoal ?? null);
  res.json({ ok: true });
});

router.get("/rooms/:code/writing/:participantName", async (req, res): Promise<void> => {
  const code = req.params.code?.toUpperCase();
  const participantName = req.params.participantName;
  if (!code || !participantName) { res.status(400).json({ error: "Missing params" }); return; }

  const result = await getWriting(code, participantName);
  if (!result) { res.status(404).json({ error: "Not found" }); return; }
  res.json(result);
});

router.get("/user/sprints", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const sprints = await getUserSprints(clerkUserId);
  res.json(sprints);
});

router.get("/user/sprints/:id/text", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const { db, sprintWritingTable } = await import("@workspace/db");
  const { eq, and } = await import("drizzle-orm");
  const rows = await db
    .select({ text: sprintWritingTable.text, clerkUserId: sprintWritingTable.clerkUserId })
    .from(sprintWritingTable)
    .where(and(eq(sprintWritingTable.id, id), eq(sprintWritingTable.clerkUserId, clerkUserId)))
    .limit(1);

  if (rows.length === 0) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  res.json({ text: rows[0].text });
});

function htmlToPlain(html: string): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

router.get("/user/files", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const rows = await db
    .select()
    .from(sprintWritingTable)
    .where(and(eq(sprintWritingTable.clerkUserId, clerkUserId), eq(sprintWritingTable.savedToFiles, true)))
    .orderBy(desc(sprintWritingTable.updatedAt));

  res.json(rows.map((r) => ({
    id: r.id,
    roomCode: r.roomCode,
    participantName: r.participantName,
    wordCount: r.wordCount,
    updatedAt: r.updatedAt,
    excerpt: htmlToPlain(r.text).slice(0, 200),
  })));
});

router.post("/user/files", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { roomCode, participantName, text, wordCount } = req.body ?? {};
  if (!roomCode || !participantName || typeof text !== "string") {
    res.status(400).json({ error: "roomCode, participantName, and text are required" }); return;
  }
  const wc = typeof wordCount === "number" ? Math.max(0, Math.floor(wordCount)) : 0;

  await db
    .insert(sprintWritingTable)
    .values({ roomCode, participantName, clerkUserId, text, wordCount: wc, savedToFiles: true })
    .onConflictDoUpdate({
      target: [sprintWritingTable.roomCode, sprintWritingTable.participantName],
      set: { savedToFiles: true, clerkUserId, text, wordCount: wc, updatedAt: new Date() },
    });

  res.json({ ok: true });
});

router.delete("/user/sprints/:id", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  await db
    .delete(sprintWritingTable)
    .where(and(eq(sprintWritingTable.id, id), eq(sprintWritingTable.clerkUserId, clerkUserId)));

  res.json({ ok: true });
});

router.delete("/user/files/:id", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  await db
    .update(sprintWritingTable)
    .set({ savedToFiles: false })
    .where(and(eq(sprintWritingTable.id, id), eq(sprintWritingTable.clerkUserId, clerkUserId)));

  res.json({ ok: true });
});

router.get("/user/profile", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  // Apply any uncharged decay first (lazy evaluation)
  const decayResult = await applyXpDecay(clerkUserId);

  const rows = await db
    .select()
    .from(userProfilesTable)
    .where(eq(userProfilesTable.clerkUserId, clerkUserId))
    .limit(1);

  const profile = rows[0];
  const xp = profile?.xp ?? 0;
  const lastSprintAt = profile?.lastSprintAt;
  const now = new Date();

  // Decay warning info for the frontend
  let daysUntilDecay: number | null = null;
  let inDecay = false;
  let decayRatePerDay = 0;

  if (lastSprintAt) {
    const daysSinceLastSprint = (now.getTime() - lastSprintAt.getTime()) / 86_400_000;
    const rankIndex = getRankIndex(xp);
    if (rankIndex >= 3) {
      decayRatePerDay = DECAY_RATE_PER_DAY[rankIndex];
      if (daysSinceLastSprint > DECAY_GRACE_DAYS) {
        inDecay = true;
      } else {
        daysUntilDecay = Math.ceil(DECAY_GRACE_DAYS - daysSinceLastSprint);
      }
    }
  }

  res.json({
    writerName: profile?.writerName ?? null,
    xp,
    xpDecayed: decayResult?.xpLost ?? 0,
    inDecay,
    daysUntilDecay,
    decayRatePerDay,
    activeNameplate: profile?.activeNameplate ?? "default",
    activeSkin: profile?.activeSkin ?? "default",
  });
});

router.patch("/user/preferences", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { activeNameplate, activeSkin } = req.body ?? {};

  const NAMEPLATE_MIN_XP: Record<string, number> = {
    default: 0, crimson: 10000, gold: 25000, blue: 75000, purple: 200000,
  };
  const SKIN_MIN_XP: Record<string, number> = {
    default: 0, eternal: 75000, final: 200000,
  };

  const rows = await db
    .select({ xp: userProfilesTable.xp })
    .from(userProfilesTable)
    .where(eq(userProfilesTable.clerkUserId, clerkUserId))
    .limit(1);

  const currentXp = rows[0]?.xp ?? 0;
  const updates: Record<string, string> = {};

  if (activeNameplate !== undefined) {
    const minXp = NAMEPLATE_MIN_XP[activeNameplate] ?? 999999;
    if (currentXp >= minXp) updates.activeNameplate = activeNameplate;
    else { res.status(403).json({ error: "Not enough XP for that nameplate" }); return; }
  }
  if (activeSkin !== undefined) {
    const minXp = SKIN_MIN_XP[activeSkin] ?? 999999;
    if (currentXp >= minXp) updates.activeSkin = activeSkin;
    else { res.status(403).json({ error: "Not enough XP for that skin" }); return; }
  }

  if (Object.keys(updates).length === 0) { res.status(400).json({ error: "Nothing to update" }); return; }

  await db
    .update(userProfilesTable)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(userProfilesTable.clerkUserId, clerkUserId));

  res.json({ ok: true, ...updates });
});

router.post("/user/xp", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { isFirstPlace, roomCode } = req.body ?? {};

  // roomCode is required — XP can only be awarded for a real sprint.
  if (!roomCode || typeof roomCode !== "string") {
    res.status(400).json({ error: "roomCode required" }); return;
  }

  // Look up the sprint record owned by this Clerk user in this room.
  // We use the DB-stored word count — never the client-supplied value —
  // so a user cannot inflate their XP by submitting a fake number.
  const sprintRows = await db
    .select({ wordCount: sprintWritingTable.wordCount, xpAwarded: sprintWritingTable.xpAwarded })
    .from(sprintWritingTable)
    .where(and(
      eq(sprintWritingTable.clerkUserId, clerkUserId),
      eq(sprintWritingTable.roomCode, roomCode),
    ))
    .limit(1);

  if (!sprintRows[0]) {
    res.status(404).json({ error: "Sprint record not found" }); return;
  }

  const dbWordCount = sprintRows[0].wordCount;
  const base = Math.max(5, Math.ceil(dbWordCount / 5));

  if (sprintRows[0].xpAwarded) {
    // Server already handled it — return current XP without touching DB again.
    const profileRows = await db
      .select({ xp: userProfilesTable.xp })
      .from(userProfilesTable)
      .where(eq(userProfilesTable.clerkUserId, clerkUserId))
      .limit(1);
    const newXp = profileRows[0]?.xp ?? 0;
    res.json({ xpGained: base, newXp, alreadyAwarded: true });
    return;
  }

  const profileRows = await db
    .select({ xp: userProfilesTable.xp })
    .from(userProfilesTable)
    .where(eq(userProfilesTable.clerkUserId, clerkUserId))
    .limit(1);

  if (profileRows.length === 0) {
    res.status(404).json({ error: "Profile not found" }); return;
  }

  // ── Apply active sprint effects ──────────────────────────────────────────
  let xpGained = isFirstPlace === true ? base * 2 : base;

  const client2 = await pool.connect();
  try {
    // Remove expired effects
    await client2.query(
      `DELETE FROM active_effects WHERE user_id = $1 AND expires_at < NOW()`,
      [clerkUserId],
    );

    const { rows: activeEffects } = await client2.query(
      `SELECT id, effect_type, effect_value, metadata FROM active_effects
       WHERE user_id = $1 AND expires_at > NOW()`,
      [clerkUserId],
    );

    let multiplier = 1;

    // World Destroying: multiply by count of active timed effects
    const worldDestroying = activeEffects.find(e => e.effect_type === "world_destroying");
    if (worldDestroying) {
      const timedEffects = activeEffects.filter(e =>
        e.effect_type !== "world_destroying" &&
        e.effect_type !== "cauldron" &&
        e.effect_type !== "chest_luck" &&
        e.effect_type !== "fortune_reversal" &&
        e.effect_type !== "reroll_chest_rarity" &&
        e.effect_type !== "guarantee_rarity" &&
        e.effect_type !== "guarantee_one_mythic" &&
        e.effect_type !== "karmic_ring" &&
        e.effect_type !== "nuwa_stone",
      );
      multiplier = Math.min(worldDestroying.effect_value ?? 8, Math.max(1, timedEffects.length));
      await client2.query(`DELETE FROM active_effects WHERE id = $1`, [worldDestroying.id]);
    }

    // Sprint multiplier (xp_sprint_multiplier) — Qilin, Triple XP, etc.
    const sprintMult = activeEffects.find(e => e.effect_type === "xp_sprint_multiplier");
    if (sprintMult && !worldDestroying) {
      multiplier = Math.max(multiplier, (sprintMult.effect_value ?? 100) / 100);
      // Decrement sprints_remaining
      let meta: { sprints_remaining?: number } = {};
      try { meta = JSON.parse(sprintMult.metadata ?? "{}"); } catch { /* ignore */ }
      const remaining = (meta.sprints_remaining ?? 1) - 1;
      if (remaining <= 0) {
        await client2.query(`DELETE FROM active_effects WHERE id = $1`, [sprintMult.id]);
      } else {
        await client2.query(
          `UPDATE active_effects SET metadata = $1 WHERE id = $2`,
          [JSON.stringify({ ...meta, sprints_remaining: remaining }), sprintMult.id],
        );
      }
    }

    // Timed bonus % (xp_sprint_bonus_pct) — Spirit Bead Necklace, Phoenix Feather, etc.
    let bonusPct = 0;
    for (const eff of activeEffects) {
      if (eff.effect_type === "xp_sprint_bonus_pct") {
        bonusPct += eff.effect_value ?? 0;
      }
    }

    // Apply permanent modifiers (sprint XP % boost, capped at +60%)
    const { rows: permRows } = await client2.query<{ total: string; mult: string }>(
      `SELECT
         COALESCE(SUM(CASE WHEN modifier_type IN ('sprint_xp_pct','heaven_defying_constitution') THEN modifier_value ELSE 0 END), 0) AS total,
         COALESCE(MAX(CASE WHEN modifier_type = 'sprint_xp_multiplier' THEN modifier_value ELSE 100 END), 100) AS mult
       FROM permanent_modifiers
       WHERE user_id = $1`,
      [clerkUserId],
    );
    const permBonusPct = Math.min(60, Number(permRows[0]?.total ?? 0));
    const permMultiplier = Math.min(3, Number(permRows[0]?.mult ?? 100) / 100);

    xpGained = Math.floor(xpGained * multiplier * (1 + (bonusPct + permBonusPct) / 100) * permMultiplier);

    // Dao of Writing stack
    const daoEffect = activeEffects.find(e => e.effect_type === "dao_of_writing");
    if (daoEffect) {
      let meta: { stack?: number; last_sprint_date?: string | null } = {};
      try { meta = JSON.parse(daoEffect.metadata ?? "{}"); } catch { /* ignore */ }
      const today = new Date().toISOString().slice(0, 10);
      if (meta.last_sprint_date !== today) {
        meta.stack = Math.min((meta.stack ?? 0) + 5, daoEffect.effect_value ?? 50);
        meta.last_sprint_date = today;
        await client2.query(
          `UPDATE active_effects SET metadata = $1 WHERE id = $2`,
          [JSON.stringify(meta), daoEffect.id],
        );
        // Add as bonus XP (counted toward permanent bonus cap)
        const daoBonus = Math.floor(base * (meta.stack / 100));
        xpGained += daoBonus;
      }
    }

    // Mountain Seal: store XP from this sprint
    const mountainSeal = activeEffects.find(e => e.effect_type === "mountain_seal");
    if (mountainSeal) {
      let meta: { stored_xp?: number; sprints_remaining?: number } = {};
      try { meta = JSON.parse(mountainSeal.metadata ?? "{}"); } catch { /* ignore */ }
      meta.stored_xp = (meta.stored_xp ?? 0) + base; // store base (not multiplied)
      meta.sprints_remaining = (meta.sprints_remaining ?? 3) - 1;
      if (meta.sprints_remaining <= 0) {
        // Release stored XP as bonus
        xpGained += meta.stored_xp;
        await client2.query(`DELETE FROM active_effects WHERE id = $1`, [mountainSeal.id]);
      } else {
        await client2.query(
          `UPDATE active_effects SET metadata = $1 WHERE id = $2`,
          [JSON.stringify(meta), mountainSeal.id],
        );
      }
    }

    // Karma Beads: track sprint XP earned
    const karmaBeads = activeEffects.find(e => e.effect_type === "karma_beads");
    if (karmaBeads) {
      let meta: { sprint_xp_tracked?: number } = {};
      try { meta = JSON.parse(karmaBeads.metadata ?? "{}"); } catch { /* ignore */ }
      meta.sprint_xp_tracked = (meta.sprint_xp_tracked ?? 0) + base;
      await client2.query(
        `UPDATE active_effects SET metadata = $1 WHERE id = $2`,
        [JSON.stringify(meta), karmaBeads.id],
      );
    }

    // Chronicle of Heaven: record best sprint
    const chronicle = activeEffects.find(e => e.effect_type === "chronicle_of_heaven");
    if (chronicle) {
      let meta: { best_sprint_xp?: number; last_replay?: string | null } = {};
      try { meta = JSON.parse(chronicle.metadata ?? "{}"); } catch { /* ignore */ }
      // Only record if no active XP multiplier effect was running (other than permanent mods)
      const hasMultiplierEffect = activeEffects.some(e =>
        e.effect_type === "xp_sprint_multiplier" || e.effect_type === "xp_timed_multiplier",
      );
      if (!hasMultiplierEffect) {
        meta.best_sprint_xp = Math.max(meta.best_sprint_xp ?? 0, base);
        await client2.query(
          `UPDATE active_effects SET metadata = $1 WHERE id = $2`,
          [JSON.stringify(meta), chronicle.id],
        );
      }
      // Check if replay is due (every 7 days)
      const lastReplay = meta.last_replay ? new Date(meta.last_replay) : null;
      if (!lastReplay || (Date.now() - lastReplay.getTime()) > 7 * 86_400_000) {
        const replayXp = Math.min(chronicle.effect_value ?? 5000, meta.best_sprint_xp ?? 0);
        if (replayXp > 0) {
          xpGained += replayXp;
          meta.last_replay = new Date().toISOString();
          await client2.query(
            `UPDATE active_effects SET metadata = $1 WHERE id = $2`,
            [JSON.stringify(meta), chronicle.id],
          );
        }
      }
    }
  } finally {
    client2.release();
  }

  const newXp = (profileRows[0].xp ?? 0) + xpGained;
  const now = new Date();

  await db
    .update(userProfilesTable)
    .set({ xp: newXp, lastSprintAt: now, decayCheckedAt: now, updatedAt: now })
    .where(eq(userProfilesTable.clerkUserId, clerkUserId));

  // Mark XP as awarded so the server-side path cannot double-award.
  await db
    .update(sprintWritingTable)
    .set({ xpAwarded: true })
    .where(and(
      eq(sprintWritingTable.clerkUserId, clerkUserId),
      eq(sprintWritingTable.roomCode, roomCode),
    ));

  // ── Award chests ─────────────────────────────────────────────────────────
  // Every sprint completion → +1 Mortal Chest
  void grantChest(clerkUserId, "mortal", 1);
  // Win (first place) → +1 Iron Chest
  if (isFirstPlace === true) {
    void grantChest(clerkUserId, "iron", 1);
  }

  res.json({ xpGained, newXp });
});

router.put("/user/profile", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { writerName } = req.body ?? {};
  if (typeof writerName !== "string" || writerName.trim().length < 2 || writerName.trim().length > 40) {
    res.status(400).json({ error: "Writer name must be 2–40 characters." });
    return;
  }

  const name = writerName.trim();

  try {
    await db
      .insert(userProfilesTable)
      .values({ clerkUserId, writerName: name })
      .onConflictDoUpdate({
        target: [userProfilesTable.clerkUserId],
        set: { writerName: name, updatedAt: new Date() },
      });
    res.json({ writerName: name });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: `DB error: ${msg}` });
  }
});

router.get("/users/by-name/:name/profile", async (req, res): Promise<void> => {
  const name = decodeURIComponent(req.params.name ?? "").trim();
  if (!name) { res.status(400).json({ error: "Missing name" }); return; }

  const [statsRow] = await db
    .select({
      totalWords: sum(sprintWritingTable.wordCount),
      highestWordCount: max(sprintWritingTable.wordCount),
      sprintCount: count(),
    })
    .from(sprintWritingTable)
    .where(eq(sprintWritingTable.participantName, name));

  const profileRows = await db
    .select()
    .from(userProfilesTable)
    .where(eq(userProfilesTable.writerName, name))
    .limit(1);

  res.json({
    name,
    writerName: profileRows[0]?.writerName ?? name,
    xp: profileRows[0]?.xp ?? 0,
    totalWords: Number(statsRow?.totalWords ?? 0),
    highestWordCount: Number(statsRow?.highestWordCount ?? 0),
    sprintCount: Number(statsRow?.sprintCount ?? 0),
  });
});

// ── Global Ranking (Rankers only) ───────────────────────────────────────────
// Public read — the page itself gates access by rank on the client, but
// anyone who guesses the URL just gets a list of writer names + XP, which
// is intentionally public leaderboard data.
// Public endpoint — top 10 Rankers with their position (used by profile pages)
router.get("/rankings/top10", async (_req, res): Promise<void> => {
  const rows = await db
    .select({ writerName: userProfilesTable.writerName, xp: userProfilesTable.xp })
    .from(userProfilesTable)
    .where(gte(userProfilesTable.xp, RANKER_MIN_XP))
    .orderBy(desc(userProfilesTable.xp))
    .limit(10);

  res.json(rows.map((r, i) => ({ ...r, position: i + 1 })));
});

router.get("/rankings/global", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      writerName: userProfilesTable.writerName,
      xp: userProfilesTable.xp,
    })
    .from(userProfilesTable)
    .where(gte(userProfilesTable.xp, RANKER_MIN_XP))
    .orderBy(desc(userProfilesTable.xp));

  res.json(rows);
});

router.get("/friends", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const rows = await db
    .select({
      id: friendshipsTable.id,
      requesterId: friendshipsTable.requesterId,
      addresseeId: friendshipsTable.addresseeId,
      status: friendshipsTable.status,
    })
    .from(friendshipsTable)
    .where(or(
      eq(friendshipsTable.requesterId, clerkUserId),
      eq(friendshipsTable.addresseeId, clerkUserId),
    ));

  const otherIds = rows.map((f) => f.requesterId === clerkUserId ? f.addresseeId : f.requesterId);

  const profiles = otherIds.length > 0
    ? await db
        .select({ clerkUserId: userProfilesTable.clerkUserId, writerName: userProfilesTable.writerName, xp: userProfilesTable.xp })
        .from(userProfilesTable)
        .where(inArray(userProfilesTable.clerkUserId, otherIds))
    : [];

  const profileMap = Object.fromEntries(profiles.map((p) => [p.clerkUserId, p]));

  const friends: { id: number; writerName: string; xp: number }[] = [];
  const pendingReceived: { id: number; writerName: string; xp: number }[] = [];
  const pendingSent: { id: number; writerName: string; xp: number }[] = [];

  for (const f of rows) {
    const otherId = f.requesterId === clerkUserId ? f.addresseeId : f.requesterId;
    const profile = profileMap[otherId];
    const entry = { id: f.id, writerName: profile?.writerName ?? "", xp: profile?.xp ?? 0 };
    if (f.status === "accepted") {
      friends.push(entry);
    } else if (f.status === "pending") {
      if (f.addresseeId === clerkUserId) {
        pendingReceived.push(entry);
      } else {
        pendingSent.push(entry);
      }
    }
  }

  res.json({ friends, pendingReceived, pendingSent });
});

router.get("/users/search", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const q = String(req.query.q ?? "").trim();
  if (q.length < 2) { res.status(400).json({ error: "Query must be at least 2 characters" }); return; }

  const results = await db
    .select({ clerkUserId: userProfilesTable.clerkUserId, writerName: userProfilesTable.writerName, xp: userProfilesTable.xp })
    .from(userProfilesTable)
    .where(and(
      ilike(userProfilesTable.writerName, `%${q}%`),
      ne(userProfilesTable.clerkUserId, clerkUserId),
    ))
    .limit(10);

  res.json(results);
});

router.post("/friends/request", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { writerName } = req.body ?? {};
  if (!writerName) { res.status(400).json({ error: "writerName required" }); return; }

  const targetRows = await db
    .select({ clerkUserId: userProfilesTable.clerkUserId })
    .from(userProfilesTable)
    .where(eq(userProfilesTable.writerName, writerName))
    .limit(1);

  if (targetRows.length === 0) { res.status(404).json({ error: "Writer not found" }); return; }
  const addresseeId = targetRows[0].clerkUserId;
  if (addresseeId === clerkUserId) { res.status(400).json({ error: "Cannot add yourself" }); return; }

  const existing = await db
    .select({ id: friendshipsTable.id })
    .from(friendshipsTable)
    .where(or(
      and(eq(friendshipsTable.requesterId, clerkUserId), eq(friendshipsTable.addresseeId, addresseeId)),
      and(eq(friendshipsTable.requesterId, addresseeId), eq(friendshipsTable.addresseeId, clerkUserId)),
    ))
    .limit(1);

  if (existing.length > 0) { res.status(409).json({ error: "Already connected or pending" }); return; }

  await db.insert(friendshipsTable).values({ requesterId: clerkUserId, addresseeId, status: "pending" });

  res.json({ ok: true });
});

router.post("/friends/:id/accept", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const rows = await db
    .select()
    .from(friendshipsTable)
    .where(and(eq(friendshipsTable.id, id), eq(friendshipsTable.addresseeId, clerkUserId), eq(friendshipsTable.status, "pending")))
    .limit(1);

  if (rows.length === 0) { res.status(404).json({ error: "Request not found" }); return; }

  await db
    .update(friendshipsTable)
    .set({ status: "accepted" })
    .where(eq(friendshipsTable.id, id));

  res.json({ ok: true });
});

router.delete("/friends/:id", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  await db
    .delete(friendshipsTable)
    .where(and(
      eq(friendshipsTable.id, id),
      or(eq(friendshipsTable.requesterId, clerkUserId), eq(friendshipsTable.addresseeId, clerkUserId)),
    ));

  res.json({ ok: true });
});

// ── Discord Integration endpoints ─────────────────────────────────────────────

router.get("/user/discord", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const rows = await db
    .select({ discordWebhookUrl: userProfilesTable.discordWebhookUrl })
    .from(userProfilesTable)
    .where(eq(userProfilesTable.clerkUserId, clerkUserId))
    .limit(1);

  const webhookUrl = rows[0]?.discordWebhookUrl ?? null;
  res.json({ webhookUrl });
});

router.put("/user/discord", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { webhookUrl } = req.body ?? {};

  if (webhookUrl !== null && webhookUrl !== "" && webhookUrl !== undefined) {
    if (typeof webhookUrl !== "string" || !isValidDiscordWebhookUrl(webhookUrl)) {
      res.status(400).json({ error: "Invalid Discord webhook URL. It must be a discord.com/api/webhooks/… URL." });
      return;
    }
  }

  const normalised = (typeof webhookUrl === "string" && webhookUrl.trim()) ? webhookUrl.trim() : null;

  await db
    .insert(userProfilesTable)
    .values({ clerkUserId, writerName: "", discordWebhookUrl: normalised })
    .onConflictDoUpdate({
      target: [userProfilesTable.clerkUserId],
      set: { discordWebhookUrl: normalised, updatedAt: new Date() },
    });

  res.json({ ok: true });
});

router.post("/user/discord/test", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const rows = await db
    .select({ discordWebhookUrl: userProfilesTable.discordWebhookUrl, writerName: userProfilesTable.writerName })
    .from(userProfilesTable)
    .where(eq(userProfilesTable.clerkUserId, clerkUserId))
    .limit(1);

  const webhookUrl = rows[0]?.discordWebhookUrl;
  const writerName = rows[0]?.writerName ?? "Writer";

  if (!webhookUrl || !isValidDiscordWebhookUrl(webhookUrl)) {
    res.status(400).json({ error: "No valid webhook URL saved." });
    return;
  }

  const ok = await postDiscordAnnouncement(
    webhookUrl,
    `✅ **${writerName}'s Writing Sprint Discord integration is working!**\nYou'll see sprint announcements here when you start a sprint from the web app.`
  );

  if (ok) {
    res.json({ ok: true });
  } else {
    res.status(502).json({ error: "Discord returned an error. Check that the webhook URL is correct and the channel still exists." });
  }
});

export default router;
