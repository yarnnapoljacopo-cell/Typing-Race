import { pool } from "@workspace/db";
import { logger } from "./logger";

/**
 * Runs CREATE TABLE IF NOT EXISTS for every table in the schema.
 * Safe to call on every startup — it is idempotent.
 * This is needed because Railway only injects DATABASE_URL at *runtime*,
 * so the drizzle-kit push step in the build command never has access to it.
 */
export async function ensureSchema(): Promise<void> {
  const client = await pool.connect();
  try {
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
        id            SERIAL      PRIMARY KEY,
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
    logger.info("DB schema ensured (all tables exist)");
  } finally {
    client.release();
  }
}
