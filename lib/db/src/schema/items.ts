import { pgTable, serial, varchar, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";

// ── Master list of all items ──────────────────────────────────────────────────
export const itemsMasterTable = pgTable("items_master", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 150 }).notNull(),
  description: text("description").notNull().default(""),
  category: varchar("category", { length: 20 }).notNull(), // pill/recipe/treasure/artifact/ingredient
  rarity: varchar("rarity", { length: 20 }).notNull(),     // common/uncommon/rare/epic/mythic/legendary
  effectType: varchar("effect_type", { length: 80 }),
  effectValue: integer("effect_value"),
  effectDuration: integer("effect_duration"),               // minutes
  isCraftable: boolean("is_craftable").notNull().default(false),
  isTradeable: boolean("is_tradeable").notNull().default(true),
  isChestObtainable: boolean("is_chest_obtainable").notNull().default(true),
  icon: varchar("icon", { length: 20 }).notNull().default("💊"),
  stackLimit: integer("stack_limit").notNull().default(1),
});

// ── Items owned by each user ──────────────────────────────────────────────────
export const userInventoryTable = pgTable("user_inventory", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 100 }).notNull(),
  itemId: integer("item_id").notNull().references(() => itemsMasterTable.id),
  quantity: integer("quantity").notNull().default(1),
  acquiredAt: timestamp("acquired_at").notNull().defaultNow(),
});

// ── Unopened chests per user ──────────────────────────────────────────────────
export const userChestsTable = pgTable("user_chests", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 100 }).notNull(),
  chestType: varchar("chest_type", { length: 20 }).notNull(), // mortal/iron/crystal/inferno/immortal
  quantity: integer("quantity").notNull().default(0),
  earnedAt: timestamp("earned_at").notNull().defaultNow(),
});

// ── Currently active timed effects per user ───────────────────────────────────
export const activeEffectsTable = pgTable("active_effects", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 100 }).notNull(),
  itemId: integer("item_id").notNull().references(() => itemsMasterTable.id),
  effectType: varchar("effect_type", { length: 80 }).notNull(),
  effectValue: integer("effect_value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  metadata: text("metadata"),                               // JSON string for extra data
});

// ── All valid crafting recipes ────────────────────────────────────────────────
export const craftingRecipesTable = pgTable("crafting_recipes", {
  id: serial("id").primaryKey(),
  resultItemId: integer("result_item_id").notNull().references(() => itemsMasterTable.id),
  ingredient1Id: integer("ingredient_1_id").references(() => itemsMasterTable.id),
  ingredient2Id: integer("ingredient_2_id").references(() => itemsMasterTable.id),
  ingredient3Id: integer("ingredient_3_id").references(() => itemsMasterTable.id),
  ingredient4Id: integer("ingredient_4_id").references(() => itemsMasterTable.id),
  requiredCauldron: varchar("required_cauldron", { length: 20 }).default("none"),
  baseSuccessRate: integer("base_success_rate").notNull().default(60),
  isDiscoverable: boolean("is_discoverable").notNull().default(true),
  recipeType: varchar("recipe_type", { length: 20 }).notNull().default("alchemy"), // alchemy/tribulation/fusion/special
});

// ── Recipes each user has discovered ─────────────────────────────────────────
export const knownRecipesTable = pgTable("known_recipes", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 100 }).notNull(),
  recipeId: integer("recipe_id").notNull().references(() => craftingRecipesTable.id),
  discoveredAt: timestamp("discovered_at").notNull().defaultNow(),
});

// ── Failure ashes count per user ──────────────────────────────────────────────
export const failureAshesTable = pgTable("failure_ashes", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 100 }).notNull().unique(),
  count: integer("count").notNull().default(0),
});

// ── Permanent XP modifier records ────────────────────────────────────────────
export const permanentModifiersTable = pgTable("permanent_modifiers", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 100 }).notNull(),
  sourceItemId: integer("source_item_id").notNull().references(() => itemsMasterTable.id),
  modifierType: varchar("modifier_type", { length: 50 }).notNull(),
  modifierValue: integer("modifier_value").notNull(),       // percentage points (e.g. 10 = +10%)
  appliedAt: timestamp("applied_at").notNull().defaultNow(),
});

// ── XP lost from crafting failures (for Karma Pill) ──────────────────────────
export const karmaPillLogTable = pgTable("karma_pill_log", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 100 }).notNull(),
  xpLost: integer("xp_lost").notNull(),
  lostAt: timestamp("lost_at").notNull().defaultNow(),
});

// ── Item usage log (rate-limiting / counter effects) ─────────────────────────
export const itemUseLogTable = pgTable("item_use_log", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 100 }).notNull(),
  itemId: integer("item_id").notNull().references(() => itemsMasterTable.id),
  usedAt: timestamp("used_at").notNull().defaultNow(),
  metadata: text("metadata"),
});
