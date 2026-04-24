export interface ItemDef {
  name: string;
  description: string;
  category: "pill" | "recipe" | "treasure" | "artifact" | "ingredient";
  rarity: "common" | "uncommon" | "rare" | "epic" | "mythic" | "legendary";
  effectType?: string;
  effectValue?: number;
  effectDuration?: number; // minutes
  isCraftable?: boolean;
  isTradeable?: boolean;
  isChestObtainable?: boolean;
  icon: string;
  stackLimit?: number;
}

// ── Pills ────────────────────────────────────────────────────────────────────

const commonPills: ItemDef[] = [
  { name: "Qi Gathering Pill", description: "Instantly gathers ambient Qi into usable XP.", category: "pill", rarity: "common", effectType: "xp_instant", effectValue: 50, icon: "💊" },
  { name: "Impure Pill", description: "+20 XP, but failed refinement means a 20% chance of giving nothing.", category: "pill", rarity: "common", effectType: "impure_pill", effectValue: 20, icon: "💊" },
  { name: "Earth Qi Pill", description: "Draws on the earth's deep Qi reserves for an instant boost.", category: "pill", rarity: "common", effectType: "xp_instant", effectValue: 50, icon: "💊" },
  { name: "Mortal Cleansing Pill", description: "Purges impurities from the meridians, granting clarity and XP.", category: "pill", rarity: "common", effectType: "xp_instant", effectValue: 40, isCraftable: true, icon: "💊" },
];

const uncommonPills: ItemDef[] = [
  { name: "Body Tempering Pill", description: "Tempers the body's foundations with a surge of Qi.", category: "pill", rarity: "uncommon", effectType: "xp_instant", effectValue: 150, icon: "💊" },
  { name: "Meridian Clearing Pill", description: "Clears all blocked meridians — doubles XP from your next sprint.", category: "pill", rarity: "uncommon", effectType: "xp_double_next_sprint", icon: "💊" },
  { name: "Heaven Qi Pill", description: "Condensed heavenly Qi grants an immediate boost.", category: "pill", rarity: "uncommon", effectType: "xp_instant", effectValue: 150, icon: "💊" },
  { name: "Yin Gathering Pill", description: "+150 XP instantly. A key crafting ingredient for harmony pills.", category: "pill", rarity: "uncommon", effectType: "xp_instant", effectValue: 150, isCraftable: true, icon: "💊" },
  { name: "Yang Gathering Pill", description: "+150 XP instantly. A key crafting ingredient for harmony pills.", category: "pill", rarity: "uncommon", effectType: "xp_instant", effectValue: 150, isCraftable: true, icon: "💊" },
  { name: "Beast Bloodline Pill", description: "Awakens dormant beast bloodline energy for a powerful XP surge.", category: "pill", rarity: "uncommon", effectType: "xp_instant", effectValue: 200, icon: "💊" },
  { name: "Luck Enhancing Pill", description: "Bends fortune in your favour — increases rare drop chance for your next 3 chests.", category: "pill", rarity: "uncommon", effectType: "chest_luck", effectValue: 3, icon: "💊" },
  { name: "Qi Condensation Pill", description: "Compresses scattered Qi into a dense, usable form.", category: "pill", rarity: "uncommon", effectType: "xp_instant", effectValue: 120, icon: "💊" },
];

const rarePills: ItemDef[] = [
  { name: "Foundation Pill", description: "Solidifies your cultivation foundation with a massive XP infusion.", category: "pill", rarity: "rare", effectType: "xp_instant", effectValue: 400, isCraftable: true, icon: "💊" },
  { name: "Heaven Earth Pill", description: "Draws on both heaven and earth energies simultaneously.", category: "pill", rarity: "rare", effectType: "xp_instant", effectValue: 450, icon: "💊" },
  { name: "Yin-Yang Harmony Pill", description: "The perfect balance of Yin and Yang. Craftable only from a Yin and Yang Gathering Pill.", category: "pill", rarity: "rare", effectType: "xp_instant", effectValue: 600, isCraftable: true, icon: "☯️" },
  { name: "Lightning Tribulation Remnant Pill", description: "Forged from the remnants of a lightning tribulation — raw power in pill form.", category: "pill", rarity: "rare", effectType: "xp_instant", effectValue: 500, isCraftable: true, icon: "⚡" },
  { name: "Dragon Bloodline Fragment Pill", description: "Contains a fragment of true dragon blood, awakening hidden potential.", category: "pill", rarity: "rare", effectType: "xp_instant", effectValue: 600, isCraftable: true, icon: "🐉" },
  { name: "Time Acceleration Elixir", description: "Warps your perception of time — doubles XP for exactly 60 minutes of active sprint writing.", category: "pill", rarity: "rare", effectType: "xp_timed_double", effectDuration: 60, icon: "⏳" },
  { name: "Fortune Reversal Pill", description: "Twists fate's hand — if your next opened chest yields Common, it is automatically rerolled once.", category: "pill", rarity: "rare", effectType: "fortune_reversal", icon: "💊" },
  { name: "Fate Altering Pill", description: "Rewrites destiny itself, rerolling the rarity tier of the next chest you open.", category: "pill", rarity: "rare", effectType: "reroll_chest_rarity", icon: "🎲" },
];

const epicPills: ItemDef[] = [
  { name: "Core Pill", description: "Forms a solid core of condensed Qi energy.", category: "pill", rarity: "epic", effectType: "xp_instant", effectValue: 1000, isCraftable: true, icon: "💊" },
  { name: "Triple XP Pill", description: "Triples all XP earned from your next 3 sprints.", category: "pill", rarity: "epic", effectType: "xp_triple_next_sprints", effectValue: 3, icon: "💊" },
  { name: "Taiji Pill", description: "Embodies the primordial balance of all things.", category: "pill", rarity: "epic", effectType: "xp_instant", effectValue: 1500, icon: "☯️" },
  { name: "Karma Pill", description: "Recovers all XP lost through crafting failures since your last Karma Pill. Capped at 10,000 XP. Only crafting failure losses count.", category: "pill", rarity: "epic", effectType: "karma_xp", effectValue: 10000, icon: "💊" },
  { name: "Heaven Defying Luck Pill", description: "Defies the heavens themselves — guarantees Mythic rarity or above from your next chest.", category: "pill", rarity: "epic", effectType: "guarantee_mythic_plus", icon: "💊" },
  { name: "False Tribulation Pill", description: "Simulates a rank breakthrough tribulation, granting 20% of the XP needed for your next rank (max 5,000 XP).", category: "pill", rarity: "epic", effectType: "false_tribulation", effectValue: 5000, icon: "⚡" },
  { name: "Phoenix Bloodline Essence Pill", description: "Awakens phoenix bloodline essence, granting rebirth-like vitality.", category: "pill", rarity: "epic", effectType: "xp_instant", effectValue: 1500, icon: "🔥" },
  { name: "Dao Comprehension Pill", description: "Grants sudden enlightenment of a fragment of the Dao.", category: "pill", rarity: "epic", effectType: "xp_instant", effectValue: 1200, icon: "💊" },
  { name: "Forbidden Technique Pill", description: "Unleashes forbidden cultivation techniques for a massive XP burst.", category: "pill", rarity: "epic", effectType: "xp_instant", effectValue: 1500, isCraftable: true, icon: "💊" },
  { name: "Destiny Pill", description: "Seizes control of destiny — guarantees at least one Mythic item in your next opened chest.", category: "pill", rarity: "epic", effectType: "guarantee_one_mythic", icon: "⭐" },
];

const mythicPills: ItemDef[] = [
  { name: "Nascent Pill", description: "Births a nascent soul fragment, massively accelerating cultivation.", category: "pill", rarity: "mythic", effectType: "xp_instant", effectValue: 3000, isCraftable: true, icon: "💊" },
  { name: "Nine Heavens Pill", description: "Refined from the essence of all nine heavens.", category: "pill", rarity: "mythic", effectType: "xp_instant", effectValue: 4000, icon: "💊" },
  { name: "Heaven Swallowing Pill", description: "Devours heavenly energy wholesale — an enormous XP infusion.", category: "pill", rarity: "mythic", effectType: "xp_instant", effectValue: 5000, icon: "💊" },
  { name: "Dao Heart Pill", description: "Crystallises the Dao heart, granting unshakeable conviction.", category: "pill", rarity: "mythic", effectType: "xp_instant", effectValue: 5000, icon: "💊" },
  { name: "Primal Chaos Pill", description: "Forged from the primal chaos before the world began.", category: "pill", rarity: "mythic", effectType: "xp_instant", effectValue: 6000, isCraftable: true, icon: "💊" },
  { name: "Supreme Yin-Yang Pill", description: "The supreme fusion of Yin and Yang energies. Craftable only — never found in chests.", category: "pill", rarity: "mythic", effectType: "xp_instant", effectValue: 6000, isCraftable: true, isChestObtainable: false, icon: "☯️" },
  { name: "True Dragon Bloodline Pill", description: "Awakens the true dragon bloodline, not merely a fragment.", category: "pill", rarity: "mythic", effectType: "xp_instant", effectValue: 6000, icon: "🐉" },
  { name: "Celestial Bloodline Pill", description: "Activates the celestial bloodline sleeping deep within.", category: "pill", rarity: "mythic", effectType: "xp_instant", effectValue: 8000, isCraftable: true, icon: "💊" },
  { name: "Immortal Cultivation Pill", description: "Used by immortals in their earliest stages of cultivation.", category: "pill", rarity: "mythic", effectType: "xp_instant", effectValue: 8000, icon: "💊" },
  { name: "World Destroying Pill", description: "Your next sprint XP is multiplied by the number of currently active timed effects (max ×8).", category: "pill", rarity: "mythic", effectType: "world_destroying", effectValue: 8, icon: "💊" },
  { name: "Tribulation Evasion Pill", description: "Evades tribulation lightning — doubles XP earned from your next 5 sprints.", category: "pill", rarity: "mythic", effectType: "xp_double_next_sprints", effectValue: 5, icon: "⚡" },
  { name: "Immortal Luck Pill", description: "Guarantees a Legendary item from your next chest. Hard limit: once per 30 days. Non-transferable.", category: "pill", rarity: "mythic", effectType: "guarantee_legendary", isTradeable: false, icon: "🍀" },
];

const legendaryPills: ItemDef[] = [
  { name: "Immortality Pill", description: "A pill that grants a fragment of true immortality.", category: "pill", rarity: "legendary", effectType: "xp_instant", effectValue: 10000, icon: "💊" },
  { name: "True Immortal Pill", description: "Said to be consumed only by true immortals. A transcendent XP surge.", category: "pill", rarity: "legendary", effectType: "xp_instant", effectValue: 100000, icon: "✨" },
  { name: "Undying Pill", description: "Grants a permanent +10% XP bonus from sprint earnings only. Craftable only — never found in chests. Counts toward the +60% permanent bonus cap.", category: "pill", rarity: "legendary", effectType: "permanent_sprint_xp", effectValue: 10, isCraftable: true, isChestObtainable: false, icon: "💊" },
  { name: "Creation Pill", description: "Requires 10 Legendary ingredients to craft. Said to rewrite the laws of cultivation itself. Craftable only — never found in chests.", category: "pill", rarity: "legendary", effectType: "creation_pill", isCraftable: true, isChestObtainable: false, icon: "🌟" },
  { name: "Chaos Pill", description: "70% chance: +50,000 XP instantly. 30% chance: all active pill effects are cancelled.", category: "pill", rarity: "legendary", effectType: "chaos_random", effectValue: 50000, icon: "🌀" },
];

// ── Recipes ──────────────────────────────────────────────────────────────────

const uncommonRecipes: ItemDef[] = [
  { name: "Scroll: Yin-Yang Harmony", description: "Teaches you the Yin-Yang Harmony Pill recipe: Yin + Yang Gathering Pill → Yin-Yang Harmony Pill.", category: "recipe", rarity: "uncommon", effectType: "recipe_scroll", icon: "📜" },
  { name: "Scroll: Basic Fusion", description: "Teaches the basic fusion of 3 identical Common herbs into one Uncommon herb.", category: "recipe", rarity: "uncommon", effectType: "recipe_scroll", icon: "📜" },
  { name: "Scroll: Mortal Cleansing", description: "Teaches the Mortal Cleansing Pill recipe.", category: "recipe", rarity: "uncommon", effectType: "recipe_scroll", icon: "📜" },
];

const rareRecipes: ItemDef[] = [
  { name: "Scroll: Foundation Building", description: "Teaches the Foundation Pill recipe: Ginseng + Blood Lotus + Spirit Herb.", category: "recipe", rarity: "rare", effectType: "recipe_scroll", icon: "📜" },
  { name: "Scroll: Essence Extraction", description: "Teaches Pure Essence extraction — destroy any item to receive 1 Pure Essence, usable as any ingredient.", category: "recipe", rarity: "rare", effectType: "recipe_scroll", icon: "📜" },
  { name: "Scroll: Pill Splitting", description: "Teaches Pill Splitting — destroy 1 pill to receive exactly 1 pill of the rarity below. A pure downgrade, not a duplication.", category: "recipe", rarity: "rare", effectType: "recipe_scroll", icon: "📜" },
  { name: "Scroll: Beast Core Fusion", description: "Teaches how to fuse beast cores into higher grades.", category: "recipe", rarity: "rare", effectType: "recipe_scroll", icon: "📜" },
];

const epicRecipes: ItemDef[] = [
  { name: "Scroll: Core Formation", description: "Teaches the Core Pill recipe.", category: "recipe", rarity: "epic", effectType: "recipe_scroll", icon: "📜" },
  { name: "Scroll: Tribulation Pill", description: "Teaches the Lightning Tribulation Remnant Pill recipe.", category: "recipe", rarity: "epic", effectType: "recipe_scroll", icon: "📜" },
  { name: "Scroll: Alchemy Mastery", description: "Permanently reduces all alchemy cooldowns by 50% when used.", category: "recipe", rarity: "epic", effectType: "alchemy_mastery", icon: "📜" },
  { name: "Scroll: Forbidden Arts", description: "Teaches the Forbidden Technique Pill recipe.", category: "recipe", rarity: "epic", effectType: "recipe_scroll", icon: "📜" },
  { name: "Scroll: Dragon Bloodline", description: "Teaches the Dragon Bloodline Fragment Pill recipe.", category: "recipe", rarity: "epic", effectType: "recipe_scroll", icon: "📜" },
];

const mythicRecipes: ItemDef[] = [
  { name: "Scroll: Nascent Soul", description: "Teaches the Nascent Pill recipe.", category: "recipe", rarity: "mythic", effectType: "recipe_scroll", icon: "📜" },
  { name: "Scroll: Supreme Yin-Yang", description: "Teaches the Supreme Yin-Yang Pill recipe.", category: "recipe", rarity: "mythic", effectType: "recipe_scroll", icon: "📜" },
  { name: "Scroll: Primal Chaos", description: "Teaches the Primal Chaos Pill recipe.", category: "recipe", rarity: "mythic", effectType: "recipe_scroll", icon: "📜" },
  { name: "Scroll: World Destroying", description: "Teaches the World Destroying Pill recipe.", category: "recipe", rarity: "mythic", effectType: "recipe_scroll", icon: "📜" },
  { name: "Scroll: Celestial Bloodline", description: "Teaches the Celestial Bloodline Pill recipe.", category: "recipe", rarity: "mythic", effectType: "recipe_scroll", icon: "📜" },
  { name: "Scroll: Immortal Alchemy", description: "Permanently removes ALL crafting cooldowns when used.", category: "recipe", rarity: "mythic", effectType: "immortal_alchemy", icon: "📜" },
];

const legendaryRecipes: ItemDef[] = [
  { name: "Scroll: Creation", description: "Teaches the Creation Pill recipe.", category: "recipe", rarity: "legendary", effectType: "recipe_scroll", icon: "📜" },
  { name: "Scroll: Undying", description: "Teaches the Undying Pill recipe.", category: "recipe", rarity: "legendary", effectType: "recipe_scroll", icon: "📜" },
  { name: "Scroll: True Immortal", description: "Teaches the True Immortal Pill recipe.", category: "recipe", rarity: "legendary", effectType: "recipe_scroll", icon: "📜" },
  { name: "Scroll: Heaven's Path", description: "Teaches the secret recipe combining all three Legendary pills.", category: "recipe", rarity: "legendary", effectType: "recipe_scroll", icon: "📜" },
];

// ── Treasures & Artifacts ────────────────────────────────────────────────────

const commonTreasures: ItemDef[] = [
  { name: "Low Grade Spirit Stone", description: "A basic spirit stone, still crackling with residual Qi.", category: "treasure", rarity: "common", effectType: "xp_instant", effectValue: 30, icon: "💎" },
  { name: "Basic Qi Talisman", description: "A roughly drawn talisman that releases a small burst of Qi.", category: "treasure", rarity: "common", effectType: "xp_instant", effectValue: 40, icon: "🪬" },
  { name: "Mortal Cultivation Jade Slip", description: "Contains a fragment of mortal-level cultivation insights.", category: "treasure", rarity: "common", effectType: "xp_instant", effectValue: 60, icon: "📗" },
  { name: "Failure Ash", description: "Collect 5 to craft a random Common pill via the Refining Furnace.", category: "treasure", rarity: "common", effectType: "failure_ash", icon: "🌫️", stackLimit: 99 },
];

const uncommonTreasures: ItemDef[] = [
  { name: "Mid Grade Spirit Stone", description: "A mid-quality spirit stone with a steady Qi output.", category: "treasure", rarity: "uncommon", effectType: "xp_instant", effectValue: 100, icon: "💎" },
  { name: "Spirit Gathering Talisman", description: "Attracts higher-quality items from your next 2 chests.", category: "treasure", rarity: "uncommon", effectType: "chest_luck", effectValue: 2, icon: "🪬" },
  { name: "Jade Ring", description: "Permanently expands your bag by 5 slots.", category: "treasure", rarity: "uncommon", effectType: "bag_slots", effectValue: 5, icon: "💍" },
  { name: "Prayer Beads", description: "Worn by cultivators during deep meditation. +100 XP.", category: "treasure", rarity: "uncommon", effectType: "xp_instant", effectValue: 100, icon: "📿" },
  { name: "Spirit Brush", description: "Use before a sprint to channel focused intent — +150 XP.", category: "treasure", rarity: "uncommon", effectType: "xp_instant", effectValue: 150, icon: "🖊️" },
  { name: "Dao Seed", description: "A seed containing the earliest whisper of the Dao.", category: "treasure", rarity: "uncommon", effectType: "xp_instant", effectValue: 60, icon: "🌱" },
  { name: "Cultivation Manual Fragment", description: "A torn page from an ancient cultivation manual.", category: "treasure", rarity: "uncommon", effectType: "xp_instant", effectValue: 100, icon: "📖" },
];

const rareTreasures: ItemDef[] = [
  { name: "High Grade Spirit Stone", description: "A high-quality spirit stone radiating dense Qi.", category: "treasure", rarity: "rare", effectType: "xp_instant", effectValue: 300, icon: "💎" },
  { name: "Bronze Alchemy Cauldron", description: "A durable bronze cauldron that improves crafting success rates by 20%.", category: "treasure", rarity: "rare", effectType: "cauldron_bronze", effectValue: 20, icon: "⚗️" },
  { name: "Spirit Ring", description: "Permanently expands your bag by 10 slots.", category: "treasure", rarity: "rare", effectType: "bag_slots", effectValue: 10, icon: "💍" },
  { name: "Mountain Suppressing Seal", description: "Stores sprint XP from your next 3 sprints, then releases the total as a bonus. The stored amount is locked at each sprint's completion — active multipliers at release time do not apply.", category: "treasure", rarity: "rare", effectType: "mountain_seal", effectValue: 3, icon: "🏔️" },
  { name: "Heaven Defying Talisman", description: "Skip the cooldown on any one item of your choice.", category: "treasure", rarity: "rare", effectType: "skip_cooldown", icon: "🪬" },
  { name: "Ten Thousand Year Spirit Milk", description: "Milk drawn from a spirit beast ten thousand years old.", category: "treasure", rarity: "rare", effectType: "xp_instant", effectValue: 700, icon: "🍶" },
  { name: "Void Essence", description: "Crystallised essence of the void between worlds.", category: "treasure", rarity: "rare", effectType: "xp_instant", effectValue: 400, icon: "🌀" },
  { name: "Cultivation Ring", description: "Permanently expands your bag by 5 slots.", category: "treasure", rarity: "rare", effectType: "bag_slots", effectValue: 5, icon: "💍" },
  { name: "Ancient Sect Manual", description: "A manual from a now-fallen ancient sect, filled with forgotten techniques.", category: "treasure", rarity: "rare", effectType: "xp_instant", effectValue: 500, icon: "📖" },
  { name: "Spirit Bead Necklace", description: "Passively grants +5% XP from sprint earnings for 24 hours.", category: "treasure", rarity: "rare", effectType: "xp_timed_bonus", effectValue: 5, effectDuration: 1440, icon: "📿" },
  { name: "Refining Furnace", description: "Converts 5 Failure Ashes into one random Common pill.", category: "treasure", rarity: "rare", effectType: "refining_furnace", icon: "🔥" },
];

const epicTreasures: ItemDef[] = [
  { name: "King Grade Spirit Stone", description: "A king-grade spirit stone, radiating regal Qi density.", category: "treasure", rarity: "epic", effectType: "xp_instant", effectValue: 800, icon: "💎" },
  { name: "Spirit Cauldron", description: "Increases crafting success rate by 35% and allows crafting up to Mythic-rarity pills.", category: "treasure", rarity: "epic", effectType: "cauldron_spirit", effectValue: 35, icon: "⚗️" },
  { name: "Spatial Pouch", description: "Permanently expands your bag by 15 slots.", category: "treasure", rarity: "epic", effectType: "bag_slots", effectValue: 15, icon: "👜" },
  { name: "Dao Fruit", description: "Grants XP equal to your current rank tier multiplied by 200.", category: "treasure", rarity: "epic", effectType: "dao_fruit", effectValue: 200, icon: "🍑" },
  { name: "Fate Sealing Talisman", description: "Seals fate to your advantage — guarantees your next chest is Rare rarity or above.", category: "treasure", rarity: "epic", effectType: "guarantee_rare_plus", icon: "🪬" },
  { name: "Heaven Locking Seal", description: "Prevents any XP penalties (decay, tribulation backlash) for 48 hours.", category: "treasure", rarity: "epic", effectType: "xp_penalty_immune", effectDuration: 2880, icon: "🔒" },
  { name: "Heavenly Tribulation Stone", description: "Triggers a rank breakthrough if you are within 10% of the XP required for your next rank.", category: "treasure", rarity: "epic", effectType: "rank_breakthrough", icon: "⚡" },
  { name: "Karma Beads", description: "Tracks XP earned from sprints only (not pills) for 24 hours, then grants 20% of that total as a bonus.", category: "treasure", rarity: "epic", effectType: "karma_beads", effectValue: 20, effectDuration: 1440, icon: "📿" },
  { name: "Nine Dragon Beads", description: "Nine beads, each containing the essence of a different dragon lineage.", category: "treasure", rarity: "epic", effectType: "xp_instant", effectValue: 2000, icon: "📿" },
  { name: "Ancestral Seal", description: "A seal passed down through a line of ancient cultivators. +3,000 XP flat — does not scale.", category: "treasure", rarity: "epic", effectType: "xp_instant", effectValue: 3000, icon: "🏺" },
  { name: "Space Tear Fragment", description: "A crystallised fragment of torn space-time.", category: "treasure", rarity: "epic", effectType: "xp_instant", effectValue: 1000, icon: "🌀" },
  { name: "Soul Binding Ring", description: "Links two different inventory items by their slot IDs — using one automatically uses the other. Cannot bind an item to itself or another copy of the same item. Binding is consumed on use.", category: "treasure", rarity: "epic", effectType: "soul_binding", icon: "💍" },
  { name: "Void Ring", description: "Permanently expands your bag by 20 slots.", category: "treasure", rarity: "epic", effectType: "bag_slots", effectValue: 20, icon: "💍" },
  { name: "Phoenix Feather", description: "Doubles XP earned from sprint writings for 48 hours.", category: "treasure", rarity: "epic", effectType: "xp_timed_bonus", effectValue: 100, effectDuration: 2880, icon: "🪶" },
  { name: "Dragon Scale", description: "Triples XP earned from sprint writings for 24 hours.", category: "treasure", rarity: "epic", effectType: "xp_timed_bonus", effectValue: 200, effectDuration: 1440, icon: "🐉" },
];

const mythicTreasures: ItemDef[] = [
  { name: "Emperor Grade Spirit Stone", description: "An emperor-grade spirit stone radiating overwhelming Qi presence.", category: "treasure", rarity: "mythic", effectType: "xp_instant", effectValue: 2500, icon: "💎" },
  { name: "Heaven Cauldron", description: "100% crafting success rate and capable of crafting Legendary-tier pills.", category: "treasure", rarity: "mythic", effectType: "cauldron_heaven", effectValue: 100, icon: "⚗️" },
  { name: "Immortal Storage Ring", description: "Permanently expands your bag by 50 slots.", category: "treasure", rarity: "mythic", effectType: "bag_slots", effectValue: 50, icon: "💍" },
  { name: "Heaven's Mirror", description: "Reveals the contents of your next chest before opening. You may open it or discard it (discarding destroys the chest with no refund). Goes on a 48-hour cooldown after use.", category: "treasure", rarity: "mythic", effectType: "heaven_mirror", effectDuration: 2880, icon: "🪞" },
  { name: "Qilin Horn Fragment", description: "A fragment of a Qilin's sacred horn. Multiplies next sprint XP by 5×.", category: "treasure", rarity: "mythic", effectType: "xp_5x_next_sprint", icon: "🦄" },
  { name: "Nine Heavens Tribulation Crystal", description: "Crystallised energy from nine rounds of heavenly tribulation.", category: "treasure", rarity: "mythic", effectType: "xp_instant", effectValue: 7000, icon: "⚡" },
  { name: "Immortal Cultivation Bible", description: "The foundational scripture of an immortal cultivation sect.", category: "treasure", rarity: "mythic", effectType: "xp_instant", effectValue: 8000, icon: "📖" },
  { name: "World Sealing Monument", description: "Releases bonus XP equal to 50% of all sprint XP you earned in the last 7 days (pill and item XP not included).", category: "treasure", rarity: "mythic", effectType: "xp_release_7days", effectValue: 50, icon: "🏛️" },
  { name: "Dao Carving Sword", description: "Channels the words you wrote into pure Qi — grants XP equal to the total words you wrote in your last sprint.", category: "treasure", rarity: "mythic", effectType: "xp_release_words", icon: "⚔️" },
  { name: "Karmic Ring", description: "Every XP-granting item you use returns 10% of its listed XP value as a bonus. Does not stack with itself.", category: "treasure", rarity: "mythic", effectType: "karmic_ring", effectValue: 10, icon: "💍" },
  { name: "Immortal Sealing Talisman", description: "Freezes your current XP multiplier in place for 72 hours.", category: "treasure", rarity: "mythic", effectType: "freeze_multiplier", effectDuration: 4320, icon: "🪬" },
  { name: "Heaven Destroying Talisman", description: "Instantly fills your XP bar to 90% of the threshold required for your next rank.", category: "treasure", rarity: "mythic", effectType: "heaven_destroying", icon: "🪬" },
  { name: "Space-Time Reversal Stone", description: "Resets all item cooldowns instantly.", category: "treasure", rarity: "mythic", effectType: "space_time_reversal", icon: "🌀" },
  { name: "Immortal Ink Stone", description: "Grants +10% XP bonus from sprint writings for the next 24 hours.", category: "treasure", rarity: "mythic", effectType: "xp_timed_bonus", effectValue: 10, effectDuration: 1440, icon: "🖋️" },
  { name: "Heaven Piercing Brush", description: "A brush that pierces through the veil of heaven itself.", category: "treasure", rarity: "mythic", effectType: "xp_instant", effectValue: 800, icon: "🖊️" },
];

const legendaryTreasures: ItemDef[] = [
  { name: "Immortal Crystal", description: "A crystal that pulses with the energy of true immortality.", category: "treasure", rarity: "legendary", effectType: "xp_instant", effectValue: 8000, icon: "💎" },
  { name: "Chaos Cauldron", description: "70% success rate on Legendary crafting recipes and can attempt impossible recipes no other cauldron can.", category: "artifact", rarity: "legendary", effectType: "cauldron_chaos", effectValue: 70, icon: "⚗️" },
  { name: "Book of Life and Death", description: "Rewrites the destiny of all items in your bag — rerolls every item's identity while preserving its rarity tier.", category: "artifact", rarity: "legendary", effectType: "book_of_life", icon: "📕" },
  { name: "Wheel of Reincarnation Fragment", description: "A fragment of the great Wheel. Brings back one previously used item from the void to your bag.", category: "artifact", rarity: "legendary", effectType: "wheel_fragment", icon: "☯️" },
  { name: "Jade Emperor's Decree", description: "A decree from the Jade Emperor himself. Bypasses all cooldowns and limits for 1 full hour.", category: "artifact", rarity: "legendary", effectType: "jade_emperor", effectDuration: 60, icon: "📜" },
  { name: "Pangu's Axe Fragment", description: "A shard from the axe that split heaven and earth.", category: "artifact", rarity: "legendary", effectType: "xp_instant", effectValue: 25000, icon: "🪓" },
  { name: "Nuwa's Stone", description: "Automatically grants you 1 Mortal Chest every 24 hours. Total Mortal Chests per day from all sources is capped at 5.", category: "artifact", rarity: "legendary", effectType: "nuwa_stone", icon: "🪨" },
  { name: "Heaven Defying Constitution", description: "Grants a permanent +25% XP boost on sprint earnings only. Counts toward the global permanent modifier cap. Non-tradeable.", category: "artifact", rarity: "legendary", effectType: "heaven_defying_constitution", effectValue: 25, isTradeable: false, icon: "💪" },
  { name: "Dao of Writing", description: "Every completed sprint permanently grants +5% bonus XP, stacking up to +50%. The stack decays by 1% per calendar day without a sprint. Counts toward the permanent modifier cap.", category: "artifact", rarity: "legendary", effectType: "dao_of_writing", effectValue: 50, icon: "✍️" },
  { name: "Chronicle of Heaven", description: "Records your single best sprint XP of the last 30 days (rolling window). Replays that value as a bonus every 7 days, capped at 5,000 XP per replay. The recorded sprint must have been earned without an active XP multiplier to be eligible.", category: "artifact", rarity: "legendary", effectType: "chronicle_of_heaven", effectValue: 5000, icon: "📜" },
  { name: "Immortal Emperor Seal", description: "Your writer name glows gold in all sprint rooms forever. A purely cosmetic mark of supremacy.", category: "artifact", rarity: "legendary", effectType: "immortal_emperor_seal", icon: "👑" },
  { name: "Wheel of Reincarnation", description: "Resets your rank XP to zero and permanently multiplies all future sprint XP by ×2. All permanent modifier stacks (Dao of Writing, permanent_modifiers) are also reset to zero. The total effective multiplier from all permanent sources combined is hard-capped at ×3.", category: "artifact", rarity: "legendary", effectType: "wheel_of_reincarnation", icon: "☯️" },
];

// ── Ingredients ──────────────────────────────────────────────────────────────

const commonIngredients: ItemDef[] = [
  { name: "Common Spirit Herb", description: "A common herb found near spiritual springs.", category: "ingredient", rarity: "common", icon: "🌿", stackLimit: 99 },
  { name: "Mortal Qi Grass", description: "Grass that absorbs ambient mortal Qi over decades.", category: "ingredient", rarity: "common", icon: "🌱", stackLimit: 99 },
  { name: "Stone Fragment", description: "A stone fragment with faint crystalline Qi traces.", category: "ingredient", rarity: "common", icon: "🪨", stackLimit: 99 },
  { name: "Impure Qi Crystal", description: "A crystal with Qi so impure it's barely usable.", category: "ingredient", rarity: "common", icon: "💠", stackLimit: 99 },
  { name: "Ash Root", description: "The root of a plant that survived repeated wildfires.", category: "ingredient", rarity: "common", icon: "🌿", stackLimit: 99 },
];

const uncommonIngredients: ItemDef[] = [
  { name: "Thousand Year Ginseng", description: "Ginseng that has absorbed a thousand years of earth Qi.", category: "ingredient", rarity: "uncommon", icon: "🌿", stackLimit: 99 },
  { name: "Spirit Moss", description: "Moss that grows only where spiritual energy pools.", category: "ingredient", rarity: "uncommon", icon: "🌿", stackLimit: 99 },
  { name: "Jade Flower", description: "A flower with petals of near-crystalline purity.", category: "ingredient", rarity: "uncommon", icon: "🌸", stackLimit: 99 },
  { name: "Iron Core Dust", description: "Powdered ore from the core of a spirit metal vein.", category: "ingredient", rarity: "uncommon", icon: "⚙️", stackLimit: 99 },
  { name: "Cold Spring Water", description: "Water drawn from a spring that never rises above freezing.", category: "ingredient", rarity: "uncommon", icon: "💧", stackLimit: 99 },
  { name: "Solar Flame Petal", description: "A petal that only blooms in the presence of solar flame Qi.", category: "ingredient", rarity: "uncommon", icon: "🌺", stackLimit: 99 },
];

const rareIngredients: ItemDef[] = [
  { name: "Blood Lotus", description: "A lotus that blooms only in waters stained by tribulation.", category: "ingredient", rarity: "rare", icon: "🪷", stackLimit: 99 },
  { name: "Nine Cold Ice Grass", description: "Grass that crystallises in nine layers of cold energy.", category: "ingredient", rarity: "rare", icon: "❄️", stackLimit: 99 },
  { name: "Thunder Bamboo", description: "Bamboo struck by lightning nine times without breaking.", category: "ingredient", rarity: "rare", icon: "🎋", stackLimit: 99 },
  { name: "Spirit Python Gallbladder", description: "Extracted from a thousand-year spirit python.", category: "ingredient", rarity: "rare", icon: "🐍", stackLimit: 99 },
  { name: "Heaven Dew Drop", description: "Dew collected from the highest peaks where heaven energy settles.", category: "ingredient", rarity: "rare", icon: "💧", stackLimit: 99 },
  { name: "Crimson Spirit Mushroom", description: "A mushroom that stores condensed crimson Qi over centuries.", category: "ingredient", rarity: "rare", icon: "🍄", stackLimit: 99 },
];

const epicIngredients: ItemDef[] = [
  { name: "Nine Leaf Immortal Grass", description: "Nine perfectly formed leaves, each containing a fragment of immortal energy.", category: "ingredient", rarity: "epic", icon: "🌿", stackLimit: 99 },
  { name: "Phoenix Tail Feather", description: "A tail feather shed by a phoenix during rebirth.", category: "ingredient", rarity: "epic", icon: "🪶", stackLimit: 99 },
  { name: "Dragon Whisker", description: "A whisker from a true dragon, crackling with draconic power.", category: "ingredient", rarity: "epic", icon: "🐉", stackLimit: 99 },
  { name: "Void Crystal Shard", description: "A shard of pure void crystal that warps space around it.", category: "ingredient", rarity: "epic", icon: "💠", stackLimit: 99 },
  { name: "Celestial Spring Water", description: "Water flowing from a spring directly beneath a celestial body.", category: "ingredient", rarity: "epic", icon: "💧", stackLimit: 99 },
  { name: "Heaven Defying Herb", description: "An herb that grew in defiance of heaven's restrictions.", category: "ingredient", rarity: "epic", icon: "🌿", stackLimit: 99 },
  { name: "True Blood Lotus", description: "The true form of the Blood Lotus, soaked in centuries of tribulation energy.", category: "ingredient", rarity: "epic", icon: "🪷", stackLimit: 99 },
  { name: "Ancient Tree Heartwood", description: "The heartwood of a ten-thousand-year-old spiritual tree.", category: "ingredient", rarity: "epic", icon: "🌳", stackLimit: 99 },
];

const mythicIngredients: ItemDef[] = [
  { name: "Heavenly Flame Essence", description: "The distilled essence of a heavenly-grade flame, capable of refining almost anything.", category: "ingredient", rarity: "mythic", icon: "🔥", stackLimit: 99 },
  { name: "Nine Heavens Lightning Seed", description: "A seed of pure lightning energy descended from the ninth heaven.", category: "ingredient", rarity: "mythic", icon: "⚡", stackLimit: 99 },
  { name: "Qilin Blood Drop", description: "A single drop of blood from a true Qilin.", category: "ingredient", rarity: "mythic", icon: "🦄", stackLimit: 99 },
  { name: "Phoenix Core", description: "The core flame crystal from a reborn phoenix.", category: "ingredient", rarity: "mythic", icon: "🔥", stackLimit: 99 },
  { name: "Dragon Soul Fragment", description: "A fragment of a dragon's soul, still radiating draconic will.", category: "ingredient", rarity: "mythic", icon: "🐉", stackLimit: 99 },
  { name: "Void Origin Crystal", description: "A crystal formed at the very origin point of the void.", category: "ingredient", rarity: "mythic", icon: "💠", stackLimit: 99 },
  { name: "Primordial Chaos Grass", description: "Grass that survived from before the world was formed from chaos.", category: "ingredient", rarity: "mythic", icon: "🌿", stackLimit: 99 },
];

const legendaryIngredients: ItemDef[] = [
  { name: "Pangu's Blood Drop", description: "A drop of blood from Pangu, the god who split heaven and earth.", category: "ingredient", rarity: "legendary", icon: "🩸", stackLimit: 99 },
  { name: "Nuwa's Clay", description: "Clay used by Nuwa to create mortal life.", category: "ingredient", rarity: "legendary", icon: "🪨", stackLimit: 99 },
  { name: "Heaven's Tear", description: "A tear shed by heaven itself — an impossibly rare ingredient.", category: "ingredient", rarity: "legendary", icon: "💧", stackLimit: 99 },
  { name: "Dao Origin Seed", description: "A seed from the very origin of the Dao, before it had form.", category: "ingredient", rarity: "legendary", icon: "🌱", stackLimit: 99 },
  { name: "True Immortal Bone Fragment", description: "A bone fragment from a being that achieved true immortality.", category: "ingredient", rarity: "legendary", icon: "🦴", stackLimit: 99 },
  { name: "Creation Flame", description: "The flame that preceded all other flames — it burns without fuel.", category: "ingredient", rarity: "legendary", icon: "🔥", stackLimit: 99 },
];

// ── Export ───────────────────────────────────────────────────────────────────

export const ALL_ITEMS: ItemDef[] = [
  ...commonPills,
  ...uncommonPills,
  ...rarePills,
  ...epicPills,
  ...mythicPills,
  ...legendaryPills,
  ...uncommonRecipes,
  ...rareRecipes,
  ...epicRecipes,
  ...mythicRecipes,
  ...legendaryRecipes,
  ...commonTreasures,
  ...uncommonTreasures,
  ...rareTreasures,
  ...epicTreasures,
  ...mythicTreasures,
  ...legendaryTreasures,
  ...commonIngredients,
  ...uncommonIngredients,
  ...rareIngredients,
  ...epicIngredients,
  ...mythicIngredients,
  ...legendaryIngredients,
];
