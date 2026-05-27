import { pool } from "@workspace/db";
import { logger } from "./logger";

/**
 * Idempotent schema bootstrap.
 *
 * Two-phase approach:
 *   1. CREATE TABLE IF NOT EXISTS  — for fresh databases
 *   2. ALTER TABLE ADD COLUMN IF NOT EXISTS — for existing databases that
 *      are missing columns added after the initial table was created.
 */
export async function ensureSchema(): Promise<void> {
  const client = await pool.connect();
  try {
    // ── Phase 1: create tables that don't exist yet ───────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_profiles (
        clerk_user_id        VARCHAR(100) PRIMARY KEY,
        writer_name          VARCHAR(50)  NOT NULL,
        xp                   INTEGER      NOT NULL DEFAULT 0,
        last_sprint_at       TIMESTAMP,
        decay_checked_at     TIMESTAMP,
        updated_at           TIMESTAMP    NOT NULL DEFAULT NOW(),
        active_nameplate     VARCHAR(20)  NOT NULL DEFAULT 'default',
        active_skin          VARCHAR(20)  NOT NULL DEFAULT 'default',
        discord_webhook_url  VARCHAR(500)
      );

      CREATE TABLE IF NOT EXISTS rooms (
        code                     VARCHAR(20)  PRIMARY KEY,
        creator_name             VARCHAR(100) NOT NULL,
        duration_minutes         INTEGER      NOT NULL,
        countdown_delay_minutes  INTEGER      NOT NULL DEFAULT 0,
        mode                     VARCHAR(20)  NOT NULL DEFAULT 'regular',
        word_goal                INTEGER,
        boss_word_goal           INTEGER,
        death_mode_wpm           INTEGER,
        password_hash            VARCHAR(100),
        gladiator_death_gap      INTEGER,
        status                   VARCHAR(20)  NOT NULL DEFAULT 'waiting',
        start_time               BIGINT,
        end_time                 BIGINT,
        countdown_ends_at        BIGINT,
        created_at               TIMESTAMP    NOT NULL DEFAULT NOW(),
        updated_at               TIMESTAMP    NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS sprint_writing (
        id                SERIAL       PRIMARY KEY,
        room_code         VARCHAR(20)  NOT NULL,
        participant_name  VARCHAR(100) NOT NULL,
        clerk_user_id     VARCHAR(100),
        text              TEXT         NOT NULL DEFAULT '',
        word_count        INTEGER      NOT NULL DEFAULT 0,
        saved_to_files    BOOLEAN      NOT NULL DEFAULT FALSE,
        xp_awarded        BOOLEAN      NOT NULL DEFAULT FALSE,
        room_mode         VARCHAR(20)  NOT NULL DEFAULT 'regular',
        word_goal         INTEGER,
        updated_at        TIMESTAMP    NOT NULL DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS sprint_writing_room_participant_idx
        ON sprint_writing (room_code, participant_name);
      -- Profile page aggregation index: allows COUNT/SUM to resolve within timeout
      CREATE INDEX IF NOT EXISTS sprint_writing_participant_name_idx
        ON sprint_writing (participant_name);
      CREATE INDEX IF NOT EXISTS sprint_writing_clerk_user_id_idx
        ON sprint_writing (clerk_user_id);

      CREATE TABLE IF NOT EXISTS friendships (
        id            SERIAL       PRIMARY KEY,
        requester_id  VARCHAR(100) NOT NULL
          REFERENCES user_profiles(clerk_user_id) ON DELETE CASCADE,
        addressee_id  VARCHAR(100) NOT NULL
          REFERENCES user_profiles(clerk_user_id) ON DELETE CASCADE,
        status        VARCHAR(20)  NOT NULL DEFAULT 'pending',
        created_at    TIMESTAMP    NOT NULL DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS friendships_pair_idx
        ON friendships (requester_id, addressee_id);

      -- ── Cultivation / Item system tables ──────────────────────────────

      CREATE TABLE IF NOT EXISTS items_master (
        id                    SERIAL        PRIMARY KEY,
        name                  VARCHAR(150)  NOT NULL UNIQUE,
        description           TEXT          NOT NULL DEFAULT '',
        category              VARCHAR(20)   NOT NULL,
        rarity                VARCHAR(20)   NOT NULL,
        effect_type           VARCHAR(80),
        effect_value          INTEGER,
        effect_duration       INTEGER,
        is_craftable          BOOLEAN       NOT NULL DEFAULT FALSE,
        is_tradeable          BOOLEAN       NOT NULL DEFAULT TRUE,
        is_chest_obtainable   BOOLEAN       NOT NULL DEFAULT TRUE,
        icon                  VARCHAR(20)   NOT NULL DEFAULT '💊',
        stack_limit           INTEGER       NOT NULL DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS user_inventory (
        id           SERIAL        PRIMARY KEY,
        user_id      VARCHAR(100)  NOT NULL,
        item_id      INTEGER       NOT NULL REFERENCES items_master(id) ON DELETE CASCADE,
        quantity     INTEGER       NOT NULL DEFAULT 1,
        acquired_at  TIMESTAMP     NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS user_inventory_user_idx ON user_inventory (user_id);

      CREATE TABLE IF NOT EXISTS user_chests (
        id          SERIAL        PRIMARY KEY,
        user_id     VARCHAR(100)  NOT NULL,
        chest_type  VARCHAR(20)   NOT NULL,
        quantity    INTEGER       NOT NULL DEFAULT 0,
        earned_at   TIMESTAMP     NOT NULL DEFAULT NOW(),
        UNIQUE (user_id, chest_type)
      );

      CREATE TABLE IF NOT EXISTS active_effects (
        id           SERIAL        PRIMARY KEY,
        user_id      VARCHAR(100)  NOT NULL,
        item_id      INTEGER       NOT NULL REFERENCES items_master(id) ON DELETE CASCADE,
        effect_type  VARCHAR(80)   NOT NULL,
        effect_value INTEGER       NOT NULL,
        expires_at   TIMESTAMP     NOT NULL,
        metadata     TEXT
      );
      CREATE INDEX IF NOT EXISTS active_effects_user_idx ON active_effects (user_id);
      CREATE INDEX IF NOT EXISTS active_effects_expires_idx ON active_effects (user_id, expires_at);

      CREATE TABLE IF NOT EXISTS crafting_recipes (
        id                SERIAL        PRIMARY KEY,
        result_item_id    INTEGER       NOT NULL REFERENCES items_master(id) ON DELETE CASCADE,
        ingredient_1_id   INTEGER       REFERENCES items_master(id),
        ingredient_2_id   INTEGER       REFERENCES items_master(id),
        ingredient_3_id   INTEGER       REFERENCES items_master(id),
        ingredient_4_id   INTEGER       REFERENCES items_master(id),
        required_cauldron VARCHAR(20)   DEFAULT 'none',
        base_success_rate INTEGER       NOT NULL DEFAULT 60,
        is_discoverable   BOOLEAN       NOT NULL DEFAULT TRUE,
        recipe_type       VARCHAR(20)   NOT NULL DEFAULT 'alchemy'
      );

      CREATE TABLE IF NOT EXISTS known_recipes (
        id            SERIAL        PRIMARY KEY,
        user_id       VARCHAR(100)  NOT NULL,
        recipe_id     INTEGER       NOT NULL REFERENCES crafting_recipes(id) ON DELETE CASCADE,
        discovered_at TIMESTAMP     NOT NULL DEFAULT NOW(),
        UNIQUE (user_id, recipe_id)
      );

      CREATE TABLE IF NOT EXISTS failure_ashes (
        id       SERIAL        PRIMARY KEY,
        user_id  VARCHAR(100)  NOT NULL UNIQUE,
        count    INTEGER       NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS permanent_modifiers (
        id              SERIAL        PRIMARY KEY,
        user_id         VARCHAR(100)  NOT NULL,
        source_item_id  INTEGER       NOT NULL REFERENCES items_master(id) ON DELETE CASCADE,
        modifier_type   VARCHAR(50)   NOT NULL,
        modifier_value  INTEGER       NOT NULL,
        applied_at      TIMESTAMP     NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS permanent_modifiers_user_idx ON permanent_modifiers (user_id);

      CREATE TABLE IF NOT EXISTS karma_pill_log (
        id       SERIAL        PRIMARY KEY,
        user_id  VARCHAR(100)  NOT NULL,
        xp_lost  INTEGER       NOT NULL,
        lost_at  TIMESTAMP     NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS karma_pill_log_user_idx ON karma_pill_log (user_id);

      CREATE TABLE IF NOT EXISTS item_use_log (
        id        SERIAL        PRIMARY KEY,
        user_id   VARCHAR(100)  NOT NULL,
        item_id   INTEGER       NOT NULL REFERENCES items_master(id) ON DELETE CASCADE,
        used_at   TIMESTAMP     NOT NULL DEFAULT NOW(),
        metadata  TEXT
      );
      CREATE INDEX IF NOT EXISTS item_use_log_user_idx ON item_use_log (user_id);

      -- ── Spirit Coin economy tables ─────────────────────────────────────
      CREATE TABLE IF NOT EXISTS user_coins (
        id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id             TEXT          NOT NULL UNIQUE,
        balance             INTEGER       NOT NULL DEFAULT 0,
        daily_coins_earned  INTEGER       NOT NULL DEFAULT 0,
        daily_reset_at      TIMESTAMP     NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMP     NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS coin_transactions (
        id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id           TEXT          NOT NULL,
        amount            INTEGER       NOT NULL,
        transaction_type  TEXT          NOT NULL,
        reference_id      TEXT,
        description       TEXT          NOT NULL,
        created_at        TIMESTAMP     NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS coin_transactions_user_created_idx
        ON coin_transactions (user_id, created_at DESC);

      CREATE TABLE IF NOT EXISTS shop_listings (
        id                   SERIAL   PRIMARY KEY,
        name                 TEXT     NOT NULL,
        description          TEXT     NOT NULL,
        item_type            TEXT     NOT NULL,
        quantity             INTEGER  NOT NULL DEFAULT 1,
        price                INTEGER  NOT NULL,
        icon                 TEXT     NOT NULL,
        is_available         BOOLEAN  NOT NULL DEFAULT TRUE,
        display_order        INTEGER  NOT NULL UNIQUE,
        daily_purchase_limit INTEGER  NOT NULL
      );

      CREATE TABLE IF NOT EXISTS equipped_storage (
        id          UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id     TEXT      NOT NULL UNIQUE,
        item_id     INTEGER   REFERENCES items_master(id),
        slot_count  INTEGER   NOT NULL DEFAULT 20,
        equipped_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      -- Per-user rolled daily/weekly quests. period_key is YYYY-MM-DD for
      -- daily and YYYY-Www for weekly (UTC). The unique constraint stops
      -- duplicate rolls if the rolling code races with itself.
      CREATE TABLE IF NOT EXISTS user_quests (
        id          SERIAL       PRIMARY KEY,
        user_id     VARCHAR(100) NOT NULL,
        quest_id    VARCHAR(50)  NOT NULL,
        scope       VARCHAR(10)  NOT NULL,
        period_key  VARCHAR(20)  NOT NULL,
        progress    INTEGER      NOT NULL DEFAULT 0,
        target      INTEGER      NOT NULL,
        claimed_at  TIMESTAMP,
        created_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
        UNIQUE (user_id, quest_id, period_key)
      );
      CREATE INDEX IF NOT EXISTS user_quests_user_period_idx
        ON user_quests (user_id, scope, period_key);

      -- Per-day writing log used to render the streak calendar and compute
      -- current/longest streaks. day_key is YYYY-MM-DD in UTC.
      CREATE TABLE IF NOT EXISTS daily_writing_log (
        user_id            VARCHAR(100) NOT NULL,
        day_key            CHAR(10)     NOT NULL,
        words_written      INTEGER      NOT NULL DEFAULT 0,
        sprints_completed  INTEGER      NOT NULL DEFAULT 0,
        first_logged_at    TIMESTAMP    NOT NULL DEFAULT NOW(),
        updated_at         TIMESTAMP    NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_id, day_key)
      );
      CREATE INDEX IF NOT EXISTS daily_writing_log_user_day_idx
        ON daily_writing_log (user_id, day_key DESC);
    `);

    // ── Phase 2: add any columns that were added to the schema after the
    //   table was first created (safe no-op if the column already exists) ──
    await client.query(`
      ALTER TABLE user_profiles
        ADD COLUMN IF NOT EXISTS xp                  INTEGER     NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS last_sprint_at      TIMESTAMP,
        ADD COLUMN IF NOT EXISTS decay_checked_at    TIMESTAMP,
        ADD COLUMN IF NOT EXISTS updated_at          TIMESTAMP   NOT NULL DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS active_nameplate    VARCHAR(20) NOT NULL DEFAULT 'default',
        ADD COLUMN IF NOT EXISTS active_skin         VARCHAR(20) NOT NULL DEFAULT 'default',
        ADD COLUMN IF NOT EXISTS equipped_car_skin   VARCHAR(30) NOT NULL DEFAULT 'bluebird',
        ADD COLUMN IF NOT EXISTS equipped_road_skin  VARCHAR(30) NOT NULL DEFAULT 'mushroom',
        ADD COLUMN IF NOT EXISTS discord_webhook_url VARCHAR(500),
        ADD COLUMN IF NOT EXISTS current_streak      INTEGER     NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS longest_streak      INTEGER     NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS last_streak_day     CHAR(10),
        ADD COLUMN IF NOT EXISTS profile_bio         VARCHAR(200),
        ADD COLUMN IF NOT EXISTS profile_banner      VARCHAR(20) NOT NULL DEFAULT 'default',
        ADD COLUMN IF NOT EXISTS profile_accent      VARCHAR(20) NOT NULL DEFAULT 'default';

      ALTER TABLE rooms
        ADD COLUMN IF NOT EXISTS countdown_delay_minutes INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS mode                    VARCHAR(20)  NOT NULL DEFAULT 'regular',
        ADD COLUMN IF NOT EXISTS word_goal               INTEGER,
        ADD COLUMN IF NOT EXISTS boss_word_goal          INTEGER,
        ADD COLUMN IF NOT EXISTS death_mode_wpm          INTEGER,
        ADD COLUMN IF NOT EXISTS password_hash           VARCHAR(100),
        ADD COLUMN IF NOT EXISTS gladiator_death_gap     INTEGER,
        ADD COLUMN IF NOT EXISTS start_time              BIGINT,
        ADD COLUMN IF NOT EXISTS end_time                BIGINT,
        ADD COLUMN IF NOT EXISTS countdown_ends_at       BIGINT,
        ADD COLUMN IF NOT EXISTS host_car_skin           VARCHAR(30),
        ADD COLUMN IF NOT EXISTS host_road_skin          VARCHAR(30),
        ADD COLUMN IF NOT EXISTS created_at              TIMESTAMP NOT NULL DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS updated_at              TIMESTAMP NOT NULL DEFAULT NOW();

      ALTER TABLE sprint_writing
        ADD COLUMN IF NOT EXISTS clerk_user_id     VARCHAR(100),
        ADD COLUMN IF NOT EXISTS saved_to_files    BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS xp_awarded        BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS room_mode         VARCHAR(20) NOT NULL DEFAULT 'regular',
        ADD COLUMN IF NOT EXISTS word_goal         INTEGER,
        ADD COLUMN IF NOT EXISTS wpm               INTEGER,
        ADD COLUMN IF NOT EXISTS updated_at        TIMESTAMP NOT NULL DEFAULT NOW();

      ALTER TABLE items_master
        ADD COLUMN IF NOT EXISTS effect_type         VARCHAR(80),
        ADD COLUMN IF NOT EXISTS effect_value        INTEGER,
        ADD COLUMN IF NOT EXISTS effect_duration     INTEGER,
        ADD COLUMN IF NOT EXISTS is_craftable        BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_tradeable        BOOLEAN NOT NULL DEFAULT TRUE,
        ADD COLUMN IF NOT EXISTS is_chest_obtainable BOOLEAN NOT NULL DEFAULT TRUE,
        ADD COLUMN IF NOT EXISTS stack_limit         INTEGER NOT NULL DEFAULT 1,
        ADD COLUMN IF NOT EXISTS sell_value          INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS is_storage_item     BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS storage_slot_count  INTEGER;

      ALTER TABLE user_inventory
        ADD COLUMN IF NOT EXISTS overflow_since TIMESTAMP NULL;
      CREATE INDEX IF NOT EXISTS user_inventory_overflow_idx
        ON user_inventory (user_id, overflow_since)
        WHERE overflow_since IS NOT NULL;

      ALTER TABLE active_effects
        ADD COLUMN IF NOT EXISTS metadata TEXT;

      ALTER TABLE item_use_log
        ADD COLUMN IF NOT EXISTS metadata TEXT;

      ALTER TABLE crafting_recipes
        ADD COLUMN IF NOT EXISTS recipe_type VARCHAR(20) NOT NULL DEFAULT 'alchemy';

      -- ── Shop expansion: 3 merchants, item/recipe/mystery listings ──
      -- merchant: which stall hosts this listing ('mortal' | 'earth' | 'heaven')
      -- listing_type: what the buy action grants ('chest' | 'item' | 'recipe' | 'mystery_crate')
      -- result_item_id: items_master FK for listing_type='item'
      -- result_recipe_id: crafting_recipes FK for listing_type='recipe'
      -- featured_eligible: include in the daily-featured rotation
      ALTER TABLE shop_listings
        ADD COLUMN IF NOT EXISTS merchant          VARCHAR(20) NOT NULL DEFAULT 'mortal',
        ADD COLUMN IF NOT EXISTS listing_type      VARCHAR(20) NOT NULL DEFAULT 'chest',
        ADD COLUMN IF NOT EXISTS result_item_id    INTEGER REFERENCES items_master(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS result_recipe_id  INTEGER REFERENCES crafting_recipes(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS featured_eligible BOOLEAN NOT NULL DEFAULT TRUE;
      CREATE INDEX IF NOT EXISTS shop_listings_merchant_idx
        ON shop_listings (merchant, display_order);

      -- One pinned wishlist target per user. PRIMARY KEY (user_id) enforces
      -- the "one pin at a time" rule — re-pinning replaces.
      CREATE TABLE IF NOT EXISTS shop_wishlist (
        user_id    VARCHAR(100) PRIMARY KEY,
        listing_id INTEGER      NOT NULL REFERENCES shop_listings(id) ON DELETE CASCADE,
        pinned_at  TIMESTAMP    NOT NULL DEFAULT NOW()
      );

      -- ── Guild system tables ───────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS guilds (
        id           SERIAL       PRIMARY KEY,
        name         VARCHAR(40)  NOT NULL UNIQUE,
        tag          VARCHAR(6)   NOT NULL,
        leader_id    VARCHAR(100) NOT NULL
          REFERENCES user_profiles(clerk_user_id) ON DELETE CASCADE,
        description  TEXT         NOT NULL DEFAULT '',
        crest        VARCHAR(20)  NOT NULL DEFAULT 'swords',
        created_at   TIMESTAMP    NOT NULL DEFAULT NOW()
      );
      ALTER TABLE guilds
        ADD COLUMN IF NOT EXISTS crest VARCHAR(20) NOT NULL DEFAULT 'swords';

      CREATE TABLE IF NOT EXISTS guild_members (
        guild_id   INTEGER      NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
        user_id    VARCHAR(100) NOT NULL REFERENCES user_profiles(clerk_user_id) ON DELETE CASCADE,
        role       VARCHAR(10)  NOT NULL DEFAULT 'member',
        joined_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
        PRIMARY KEY (guild_id, user_id)
      );
      CREATE UNIQUE INDEX IF NOT EXISTS guild_members_user_idx ON guild_members (user_id);

      CREATE TABLE IF NOT EXISTS guild_messages (
        id           SERIAL       PRIMARY KEY,
        guild_id     INTEGER      NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
        user_id      VARCHAR(100) NOT NULL,
        writer_name  VARCHAR(50)  NOT NULL,
        content      TEXT         NOT NULL,
        type         VARCHAR(10)  NOT NULL DEFAULT 'chat',
        sent_at      TIMESTAMP    NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS guild_messages_guild_sent_idx
        ON guild_messages (guild_id, sent_at DESC);

      CREATE TABLE IF NOT EXISTS guild_invites (
        id          SERIAL       PRIMARY KEY,
        guild_id    INTEGER      NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
        invitee_id  VARCHAR(100) NOT NULL,
        invited_by  VARCHAR(100) NOT NULL,
        status      VARCHAR(10)  NOT NULL DEFAULT 'pending',
        expires_at  TIMESTAMP    NOT NULL,
        created_at  TIMESTAMP    NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS guild_invites_invitee_idx
        ON guild_invites (invitee_id, status);

      CREATE TABLE IF NOT EXISTS room_bets (
        room_code    VARCHAR(20)  NOT NULL,
        user_id      VARCHAR(100) NOT NULL,
        writer_name  VARCHAR(50)  NOT NULL,
        amount       INTEGER      NOT NULL,
        status       VARCHAR(12)  NOT NULL DEFAULT 'active',
        created_at   TIMESTAMP    NOT NULL DEFAULT NOW(),
        settled_at   TIMESTAMP,
        PRIMARY KEY (room_code, user_id)
      );
      CREATE INDEX IF NOT EXISTS room_bets_room_idx ON room_bets (room_code, status);
      CREATE INDEX IF NOT EXISTS room_bets_user_idx ON room_bets (user_id);

      CREATE TABLE IF NOT EXISTS folio_state (
        user_id     VARCHAR(100) PRIMARY KEY,
        state       JSONB        NOT NULL DEFAULT '{}'::jsonb,
        updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS novel_notes_state (
        user_id     VARCHAR(100) PRIMARY KEY,
        nn_data     JSONB        NOT NULL DEFAULT '{}'::jsonb,
        updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );

      -- Versioned Folio snapshots: one row every ~5 min of active writing.
      -- Provides a rollback history independent of the hosting-provider backup.
      CREATE TABLE IF NOT EXISTS folio_snapshots (
        id        SERIAL       PRIMARY KEY,
        user_id   VARCHAR(100) NOT NULL,
        saved_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        state     JSONB        NOT NULL
      );
      CREATE INDEX IF NOT EXISTS folio_snapshots_user_saved_idx
        ON folio_snapshots (user_id, saved_at DESC);

      -- ── Co-writing: shared collaborative projects with Yjs sync ──────────
      CREATE TABLE IF NOT EXISTS co_writing_rooms (
        id            SERIAL       PRIMARY KEY,
        name          VARCHAR(120) NOT NULL,
        owner_user_id VARCHAR(100) NOT NULL,
        invite_code   VARCHAR(12)  NOT NULL UNIQUE,
        created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS co_writing_rooms_owner_idx
        ON co_writing_rooms (owner_user_id);

      CREATE TABLE IF NOT EXISTS co_writing_members (
        id           SERIAL       PRIMARY KEY,
        room_id      INTEGER      NOT NULL REFERENCES co_writing_rooms(id) ON DELETE CASCADE,
        user_id      VARCHAR(100) NOT NULL,
        display_name VARCHAR(80)  NOT NULL,
        color        VARCHAR(16)  NOT NULL,
        role         VARCHAR(16)  NOT NULL DEFAULT 'editor',
        joined_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        last_seen_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS co_writing_members_room_idx
        ON co_writing_members (room_id);
      CREATE UNIQUE INDEX IF NOT EXISTS co_writing_members_room_user_uq
        ON co_writing_members (room_id, user_id);

      CREATE TABLE IF NOT EXISTS co_writing_docs (
        id          SERIAL       PRIMARY KEY,
        room_id     INTEGER      NOT NULL REFERENCES co_writing_rooms(id) ON DELETE CASCADE,
        name        VARCHAR(200) NOT NULL,
        order_index INTEGER      NOT NULL DEFAULT 0,
        created_by  VARCHAR(100) NOT NULL,
        created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS co_writing_docs_room_idx
        ON co_writing_docs (room_id);

      -- Yjs binary state per doc. Kept in a sister table so the docs list
      -- can be queried cheaply without hauling the binary state around.
      CREATE TABLE IF NOT EXISTS co_writing_doc_state (
        doc_id       INTEGER     PRIMARY KEY REFERENCES co_writing_docs(id) ON DELETE CASCADE,
        state        BYTEA,
        text_preview TEXT        NOT NULL DEFAULT '',
        updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // ── Phase 3: seed static data ─────────────────────────────────────────
    // Mortal Merchant — "Old Liang" — chests + the Mystery Crate gamble.
    // display_order 1..99 reserved for Mortal so future additions stay grouped.
    await client.query(`
      INSERT INTO shop_listings
        (name, description, item_type, quantity, price, icon, is_available, display_order, daily_purchase_limit, merchant, listing_type, featured_eligible)
      VALUES
        ('Mortal Chest',    'A basic chest of common cultivation resources.',         'mortal_chest',   1, 50,   '📦', TRUE, 1, 999999, 'mortal', 'chest', TRUE),
        ('Iron Chest',      'Improved rewards with higher rarity drops.',             'iron_chest',     1, 300,  '🗃️', TRUE, 2, 999999, 'mortal', 'chest', TRUE),
        ('Iron Chest ×3',   'Three Iron Chests for a bulk discount.',                 'iron_chest',     3, 800,  '🗃️', TRUE, 3, 999999, 'mortal', 'chest', TRUE),
        ('Crystal Chest',   'Crystalline chest with rare cultivation treasures.',     'crystal_chest',  1, 800,  '💎', TRUE, 4, 999999, 'mortal', 'chest', TRUE),
        ('Inferno Chest',   'Forged in heavenly flames. Exceptional rewards.',        'inferno_chest',  1, 2500, '🔥', TRUE, 5, 999999, 'mortal', 'chest', TRUE),
        ('Immortal Chest',  'The pinnacle chest. Mythic power within.',               'immortal_chest', 1, 7000, '👑', TRUE, 6, 999999, 'mortal', 'chest', TRUE),
        ('Mystery Crate',   'A sealed box. Roll the heavens for a random chest tier — Common to Immortal.', 'mystery_crate', 1, 500, '🎁', TRUE, 7, 999999, 'mortal', 'mystery_crate', FALSE)
      ON CONFLICT (display_order) DO UPDATE SET
        merchant          = EXCLUDED.merchant,
        listing_type      = EXCLUDED.listing_type,
        featured_eligible = EXCLUDED.featured_eligible
    `);

    // Earth Merchant — "The Veiled Apothecary" — sells consumable items
    // and crafting recipes. display_order 100..199.
    // Listings reference items_master by name (resolved on insert) so the
    // seed survives id-renumbering of items_master across environments.
    // Recipe listings reference crafting_recipes by result item name.
    await client.query(`
      WITH item_lookup AS (SELECT id, name FROM items_master)
      INSERT INTO shop_listings
        (name, description, item_type, quantity, price, icon, is_available, display_order, daily_purchase_limit, merchant, listing_type, result_item_id, featured_eligible)
      SELECT v.name, v.description, 'item', v.quantity, v.price, v.icon, TRUE, v.display_order, 999999, 'earth', 'item', i.id, TRUE
      FROM (VALUES
        ('Body Tempering Pill ×3',     'Three uncommon pills, +150 XP each.',                                              'Body Tempering Pill',           3, 120,  '💊', 100),
        ('Meridian Clearing Pill',     'Doubles XP from your next sprint. The Apothecary swears by it.',                   'Meridian Clearing Pill',        1, 220,  '💊', 101),
        ('Heaven Qi Pill ×2',          'Condensed heavenly Qi — two doses, +150 XP each.',                                 'Heaven Qi Pill',                2, 240,  '💊', 102),
        ('Luck Enhancing Pill',        'Bends fortune over your next 3 chests.',                                           'Luck Enhancing Pill',           1, 180,  '🍀', 103),
        ('Foundation Pill',            'Solidifies your foundation — a single dose grants 400 XP.',                        'Foundation Pill',               1, 360,  '💊', 104),
        ('Time Acceleration Elixir',   'Doubles XP for 60 minutes of active sprint writing.',                              'Time Acceleration Elixir',      1, 700,  '⏳', 105),
        ('Fortune Reversal Pill',      'If your next chest yields Common, it is automatically rerolled once.',             'Fortune Reversal Pill',         1, 450,  '🎲', 106)
      ) AS v(name, description, item_name, quantity, price, icon, display_order)
      JOIN item_lookup i ON i.name = v.item_name
      ON CONFLICT (display_order) DO UPDATE SET
        merchant       = EXCLUDED.merchant,
        listing_type   = EXCLUDED.listing_type,
        result_item_id = EXCLUDED.result_item_id
    `);

    // Earth Merchant — recipes. Lookup recipes by result_item name so the
    // seed is idempotent regardless of crafting_recipes.id changes.
    await client.query(`
      WITH recipe_lookup AS (
        SELECT r.id, im.name AS result_name
        FROM crafting_recipes r
        JOIN items_master im ON im.id = r.result_item_id
      )
      INSERT INTO shop_listings
        (name, description, item_type, quantity, price, icon, is_available, display_order, daily_purchase_limit, merchant, listing_type, result_recipe_id, featured_eligible)
      SELECT v.name, v.description, 'recipe', 1, v.price, v.icon, TRUE, v.display_order, 999999, 'earth', 'recipe', r.id, TRUE
      FROM (VALUES
        ('Recipe: Yin-Yang Harmony Pill',           'Adds the Yin-Yang Harmony Pill recipe to your Crafting tome.',           'Yin-Yang Harmony Pill',           1200, '📜', 120),
        ('Recipe: Foundation Pill',                  'Adds the Foundation Pill recipe to your Crafting tome.',                 'Foundation Pill',                 1500, '📜', 121),
        ('Recipe: Lightning Tribulation Remnant',    'Adds the Lightning Tribulation Remnant Pill recipe.',                    'Lightning Tribulation Remnant Pill', 1800, '📜', 122),
        ('Recipe: Dragon Bloodline Fragment Pill',   'Adds the Dragon Bloodline Fragment Pill recipe to your Crafting tome.',  'Dragon Bloodline Fragment Pill',  2200, '📜', 123)
      ) AS v(name, description, result_name, price, icon, display_order)
      JOIN recipe_lookup r ON r.result_name = v.result_name
      ON CONFLICT (display_order) DO UPDATE SET
        merchant         = EXCLUDED.merchant,
        listing_type     = EXCLUDED.listing_type,
        result_recipe_id = EXCLUDED.result_recipe_id
    `);

    // Heaven Merchant — "The Hermit" — premium chests at bulk rates plus
    // ultra-rare items that don't appear anywhere else. display_order 200..299.
    await client.query(`
      WITH item_lookup AS (SELECT id, name FROM items_master)
      INSERT INTO shop_listings
        (name, description, item_type, quantity, price, icon, is_available, display_order, daily_purchase_limit, merchant, listing_type, result_item_id, featured_eligible)
      SELECT v.name, v.description, 'item', v.quantity, v.price, v.icon, TRUE, v.display_order, 999999, 'heaven', 'item', i.id, TRUE
      FROM (VALUES
        ('Triple XP Pill',             'The Hermit''s rarest stock. Triples XP from your next 3 sprints.',          'Triple XP Pill',                  1, 3200, '✨', 200),
        ('Fate Altering Pill',         'Rewrites destiny — rerolls the rarity tier of the next chest you open.',   'Fate Altering Pill',              1, 2400, '🎲', 201),
        ('Karma Pill',                  'Recovers all XP lost through crafting failures (capped at 10,000).',       'Karma Pill',                      1, 5000, '☯️', 202),
        ('Taiji Pill',                  'Primordial balance condensed — instant 1,500 XP.',                          'Taiji Pill',                      1, 2200, '☯️', 203),
        ('Core Pill',                   'Forms a true core of condensed Qi. +1,000 XP, immediately.',                'Core Pill',                       1, 1600, '💠', 204)
      ) AS v(name, description, item_name, quantity, price, icon, display_order)
      JOIN item_lookup i ON i.name = v.item_name
      ON CONFLICT (display_order) DO UPDATE SET
        merchant       = EXCLUDED.merchant,
        listing_type   = EXCLUDED.listing_type,
        result_item_id = EXCLUDED.result_item_id
    `);

    // Heaven Merchant — premium chest bundles. Cheaper-per-chest than the
    // Mortal Merchant for the same chest type.
    await client.query(`
      INSERT INTO shop_listings
        (name, description, item_type, quantity, price, icon, is_available, display_order, daily_purchase_limit, merchant, listing_type, featured_eligible)
      VALUES
        ('Inferno Chest ×2',  'Two Infernos at a discount only the Hermit will offer.',  'inferno_chest',  2, 4500,  '🔥', 220, 999999, 'heaven', 'chest', TRUE),
        ('Immortal Chest ×2', 'Two Immortal Chests — the Hermit''s benevolence.',         'immortal_chest', 2, 12000, '👑', 221, 999999, 'heaven', 'chest', TRUE)
      ON CONFLICT (display_order) DO UPDATE SET
        merchant     = EXCLUDED.merchant,
        listing_type = EXCLUDED.listing_type
    `);

    logger.info("DB schema ensured (tables created + missing columns added)");
  } finally {
    client.release();
  }
}
