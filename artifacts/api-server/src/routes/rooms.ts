import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { createRoom, getRoom, getActiveRooms } from "../lib/roomManager";
import { saveWriting, getWriting, getUserSprints } from "../lib/writingStore";
import { CreateRoomBody, GetRoomParams } from "@workspace/api-zod";
import { db, userProfilesTable, sprintWritingTable, friendshipsTable } from "@workspace/db";
import { eq, and, or, ne, desc, sql, max, sum, count, inArray, ilike, gte } from "drizzle-orm";
import bcrypt from "bcrypt";

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

  const { wordCount, isFirstPlace, roomCode } = req.body ?? {};
  if (typeof wordCount !== "number" || wordCount < 0) {
    res.status(400).json({ error: "wordCount required" }); return;
  }

  const base = Math.max(5, Math.ceil(wordCount / 5));
  const xpGained = isFirstPlace === true ? base * 2 : base;

  // If roomCode supplied, check whether the server already awarded XP so we
  // don't double-award when the server finalizeSprintData ran first.
  if (roomCode && typeof roomCode === "string") {
    const sprintRows = await db
      .select({ xpAwarded: sprintWritingTable.xpAwarded })
      .from(sprintWritingTable)
      .where(and(
        eq(sprintWritingTable.clerkUserId, clerkUserId),
        eq(sprintWritingTable.roomCode, roomCode),
      ))
      .limit(1);

    if (sprintRows[0]?.xpAwarded) {
      // Server already handled it — return the calculated XP so the UI still
      // shows the correct amount, but don't touch the database again.
      const profileRows = await db
        .select({ xp: userProfilesTable.xp })
        .from(userProfilesTable)
        .where(eq(userProfilesTable.clerkUserId, clerkUserId))
        .limit(1);
      const newXp = profileRows[0]?.xp ?? 0;
      res.json({ xpGained, newXp, alreadyAwarded: true });
      return;
    }
  }

  const rows = await db
    .select({ xp: userProfilesTable.xp })
    .from(userProfilesTable)
    .where(eq(userProfilesTable.clerkUserId, clerkUserId))
    .limit(1);

  if (rows.length === 0) {
    res.status(404).json({ error: "Profile not found" }); return;
  }

  const newXp = (rows[0].xp ?? 0) + xpGained;
  const now = new Date();

  await db
    .update(userProfilesTable)
    .set({ xp: newXp, lastSprintAt: now, decayCheckedAt: now, updatedAt: now })
    .where(eq(userProfilesTable.clerkUserId, clerkUserId));

  // Mark XP as awarded in sprint_writing so the server-side path is also
  // blocked from double-awarding (covers edge case of server restarting
  // between endSprint and finalizeSprintData completing).
  if (roomCode && typeof roomCode === "string") {
    await db
      .update(sprintWritingTable)
      .set({ xpAwarded: true })
      .where(and(
        eq(sprintWritingTable.clerkUserId, clerkUserId),
        eq(sprintWritingTable.roomCode, roomCode),
      ));
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

  await db
    .insert(userProfilesTable)
    .values({ clerkUserId, writerName: name })
    .onConflictDoUpdate({
      target: [userProfilesTable.clerkUserId],
      set: { writerName: name, updatedAt: new Date() },
    });

  res.json({ writerName: name });
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

export default router;
