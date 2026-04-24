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
        ADD COLUMN IF NOT EXISTS discord_webhook_url VARCHAR(500);

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
        ADD COLUMN IF NOT EXISTS created_at              TIMESTAMP NOT NULL DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS updated_at              TIMESTAMP NOT NULL DEFAULT NOW();

      ALTER TABLE sprint_writing
        ADD COLUMN IF NOT EXISTS clerk_user_id     VARCHAR(100),
        ADD COLUMN IF NOT EXISTS saved_to_files    BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS xp_awarded        BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS room_mode         VARCHAR(20) NOT NULL DEFAULT 'regular',
        ADD COLUMN IF NOT EXISTS word_goal         INTEGER,
        ADD COLUMN IF NOT EXISTS updated_at        TIMESTAMP NOT NULL DEFAULT NOW();

      ALTER TABLE items_master
        ADD COLUMN IF NOT EXISTS effect_type         VARCHAR(80),
        ADD COLUMN IF NOT EXISTS effect_value        INTEGER,
        ADD COLUMN IF NOT EXISTS effect_duration     INTEGER,
        ADD COLUMN IF NOT EXISTS is_craftable        BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_tradeable        BOOLEAN NOT NULL DEFAULT TRUE,
        ADD COLUMN IF NOT EXISTS is_chest_obtainable BOOLEAN NOT NULL DEFAULT TRUE,
        ADD COLUMN IF NOT EXISTS stack_limit         INTEGER NOT NULL DEFAULT 1;

      ALTER TABLE active_effects
        ADD COLUMN IF NOT EXISTS metadata TEXT;

      ALTER TABLE item_use_log
        ADD COLUMN IF NOT EXISTS metadata TEXT;

      ALTER TABLE crafting_recipes
        ADD COLUMN IF NOT EXISTS recipe_type VARCHAR(20) NOT NULL DEFAULT 'alchemy';
    `);

    logger.info("DB schema ensured (tables created + missing columns added)");
  } finally {
    client.release();
  }
}
