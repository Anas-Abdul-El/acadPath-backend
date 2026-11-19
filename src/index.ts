import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import cors from "cors";
import { corsOptions } from "./config/cors.js";
import type { Express } from "express";
import limiter from "./config/limiter.js";
import AppErr from "./libs/appErr.js";
import { errorHandler } from "./middlewares/index.js";
import routers from "./routes/index.js";

const app: Express = express();

// Behind Render's proxy (and Vercel's, when the frontend proxies /api), the client IP
// is in X-Forwarded-For. Without this every request looks like it comes from the proxy,
// so all users would share one rate-limit bucket. TRUST_PROXY takes Express's values:
// a hop count ("2"), "true", or a comma-separated list of addresses/subnets.
const trustProxy = process.env.TRUST_PROXY?.trim();
if (trustProxy) {
  app.set(
    "trust proxy",
    /^\d+$/.test(trustProxy) ? Number(trustProxy)
    : trustProxy === "true" ? true
    : trustProxy === "false" ? false
    : trustProxy,
  );
}

// Liveness check for the host (Render's health check). Before the rate limiter, so
// health checks never use up a bucket, and it never touches the database.
app.get("/api/health", (_req, res) => {
  res.json({ data: { status: "ok" } });
});

// CORS first, so every response (including 429s and errors) carries the CORS
// headers, and preflight OPTIONS requests are answered before the rate limiter.
app.use(cors(corsOptions));

// Security Middleware
app.use(limiter);
app.use(helmet());

// Body and cookie parsing
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());

// Routes
app.use("/api/", routers);

// Nothing matched: hand a 404 to the error handler so it uses the standard error shape.
app.use(() => {
  throw new AppErr("Route not found", 404);
});

app.use(errorHandler);

export default app;
