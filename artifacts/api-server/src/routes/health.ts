import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

// NOTE: /api/healthz, /api/health, and /api/healthz/deep are registered
// directly on `app` in app.ts — BEFORE Clerk middleware and the rate
// limiter — so probes measure only true app/DB health. This router-level
// handler stays as a safety fallback in case the app-level routes ever get
// removed; it will not normally be hit.
function liteHandler(_req: import("express").Request, res: import("express").Response) {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
}

router.get("/healthz", liteHandler);
router.get("/health", liteHandler);

export default router;
