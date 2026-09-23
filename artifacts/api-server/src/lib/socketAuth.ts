import { verifyToken } from "@clerk/express";
import type { IncomingMessage } from "node:http";

/** Authenticate socket traffic, which does not pass through Express middleware. */
export async function socketUserId(req: IncomingMessage, token?: unknown): Promise<string | null> {
  const cookieToken = req.headers.cookie?.split(";")
    .map((part) => part.trim()).find((part) => part.startsWith("__session="))?.slice(10);
  const jwt = typeof token === "string" && token ? token : cookieToken;
  if (!jwt) return null;
  const claims = await verifyToken(jwt, {
    secretKey: process.env.CLERK_SECRET_KEY,
    jwtKey: process.env.CLERK_JWT_KEY,
  });
  return claims.sub;
}
