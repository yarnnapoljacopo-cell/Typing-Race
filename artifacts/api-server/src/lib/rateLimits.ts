import rateLimit, { type RateLimitRequestHandler, ipKeyGenerator } from "express-rate-limit";
import { getAuth } from "@clerk/express";
import type { Request } from "express";

function keyByUserOrIp(req: Request): string {
  try {
    const auth = getAuth(req);
    if (auth?.userId) return `u:${auth.userId}`;
  } catch {}
  return `ip:${ipKeyGenerator(req.ip ?? "unknown")}`;
}

export const generalLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60_000,
  limit: 300,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: keyByUserOrIp,
  message: { error: "Too many requests — slow down a moment." },
});

export const mutationLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60_000,
  limit: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: keyByUserOrIp,
  message: { error: "Too many actions — try again in a few seconds." },
});

export const expensiveLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: keyByUserOrIp,
  message: { error: "Action limit reached — try again soon." },
});

export const clientErrorLogLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: keyByUserOrIp,
  message: { ok: false },
});
