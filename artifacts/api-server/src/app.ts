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

// When running behind a Clerk proxy the middleware must be told the full
// proxy URL so it can validate tokens correctly. CLERK_PROXY_URL is set at
// deploy time; fall back to the known production URL if not provided.
const clerkProxyUrl =
  process.env.CLERK_PROXY_URL &&
  process.env.CLERK_PROXY_URL.startsWith("https://")
    ? process.env.CLERK_PROXY_URL
    : process.env.NODE_ENV === "production"
    ? "https://app.writingsprint.site/api/__clerk"
    : undefined;

app.use(clerkMiddleware({ proxyUrl: clerkProxyUrl }));

app.use("/api", router);

export default app;
