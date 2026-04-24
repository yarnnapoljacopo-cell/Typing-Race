import { pool } from "@workspace/db";
import { logger } from "./logger";

/**
 * Idempotent schema bootstrap.
 *
 * Two-phase approach:
 *   1. CREATE TABLE IF NOT EXISTS  — for fresh databases
 *   2. ALTER TABLE ADD COLUMN IF NOT EXISTS — for existing databases that
 *      are missing columns added after the initial table was created.
 *      (Railway only injects DATABASE_URL at runtime, so drizzle-kit push
 *       in the build step never actually ran against the real DB.)
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
    `);

    logger.info("DB schema ensured (tables created + missing columns added)");
  } finally {
    client.release();
  }
}
