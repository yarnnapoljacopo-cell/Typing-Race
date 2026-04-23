import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { CLERK_PROXY_PATH, clerkProxyMiddleware } from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// Trust Replit's reverse proxy so Express sees the correct protocol/IP
app.set("trust proxy", true);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

app.use(cors({ credentials: true, origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Provide the RSA public key directly for JWT verification.
// This bypasses the CLERK_SECRET_KEY entirely for token validation, so
// mismatched secrets from old Clerk instances can't interfere.
// Key is fetched from https://clerk.writingsprint.site/.well-known/jwks.json
// (kid: ins_3CkebRzuovnqLClfMK7X03qRfIk)
const CLERK_JWT_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA1rmkjnmJSzTNYozqYtT9
ZgGTGhf51VBPrF6bnU8Wy1ztTd0mb3bxXAzt8GVCqur6yOG2z14p1/+QDY8XKEbL
+AtKU8+OXmxVWgprC3N3rE/H0kTx47F5LWcnI4MNT2sttbrPIXVXmHfC7lYIb2KX
oUd8UkacviE8pim8a9rnq34IrNMNrYlAuPzAdGw+aN9UZCGeEv5qADJ8UMAQQ7yb
RTgpYun6deQRGbOE+FZ8ZYGbkfQIs18y4dYRTCQoxXQ0Hi7jCNay7KmNHQALceGe
zrGYM66rkGVomzpnw9YU+q4si/BRbqPbSjZmgmq4VOaYpKwJOPrYtW++oM/6I+YP
bQIDAQAB
-----END PUBLIC KEY-----`;

const resolvedPublishableKey =
  process.env.VITE_CLERK_PK ??
  process.env.VITE_CLERK_PUBLISHABLE_KEY ??
  process.env.CLERK_PUBLISHABLE_KEY;

app.use(clerkMiddleware({ publishableKey: resolvedPublishableKey, jwtKey: CLERK_JWT_KEY }));

app.use("/api", router);

export default app;
