import { pool } from "@workspace/db";
import { logger } from "./logger";

const SAMPLE_INTERVAL_MS = 60_000;
const WAITING_WARN_THRESHOLD = 3;
const SATURATION_WARN_RATIO = 0.8;

let started = false;

export function startPoolMetrics(): void {
  if (started) return;
  started = true;

  setInterval(() => {
    try {
      const total = pool.totalCount;
      const idle = pool.idleCount;
      const waiting = pool.waitingCount;
      const active = total - idle;
      const max = (pool as unknown as { options?: { max?: number } }).options?.max ?? 30;
      const saturated = active / max >= SATURATION_WARN_RATIO;

      const payload = { total, idle, active, waiting, max };

      if (waiting >= WAITING_WARN_THRESHOLD || saturated) {
        logger.warn(payload, "[db-pool] high pressure");
      } else {
        logger.info(payload, "[db-pool] sample");
      }
    } catch (err) {
      logger.error({ err }, "[db-pool] metrics sample failed");
    }
  }, SAMPLE_INTERVAL_MS).unref();
}
