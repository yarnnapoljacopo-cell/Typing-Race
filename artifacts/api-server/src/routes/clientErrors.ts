import { Router, type IRouter } from "express";
import { clientErrorLogLimiter } from "../lib/rateLimits";

const router: IRouter = Router();

router.post("/log/client-error", clientErrorLogLimiter, (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const message = String(body.message ?? "").slice(0, 500);
  const stack = String(body.stack ?? "").slice(0, 4000);
  const url = String(body.url ?? "").slice(0, 500);
  const userAgent = String(req.headers["user-agent"] ?? "").slice(0, 300);
  const componentStack = String(body.componentStack ?? "").slice(0, 2000);

  req.log.warn(
    { kind: "client-error", message, stack, componentStack, url, userAgent },
    "client-error",
  );
  res.json({ ok: true });
});

export default router;
