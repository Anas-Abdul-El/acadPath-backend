import type { Request } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";

// GET routes the frontend polls every few seconds while uploads are processing.
// They skip the global limit, which they would exhaust in minutes, and use pollLimiter.
const POLLED_PATHS = new Set([
  "/api/me/documents",
  "/api/me/university/sources",
  "/api/me/portal",
]);

const isPolledRequest = (req: Request) =>
  req.method === "GET" && POLLED_PATHS.has(req.path.replace(/\/+$/, ""));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 100, // max requests per IP per window
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: { message: "Too many requests, try again later" } },
  skip: isPolledRequest,
});

// Per-user limit for the polled routes: about one request every 1.5 seconds.
// Must run after authenticate.
export const pollLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 600,
  keyGenerator: (req, res) => res.locals.user?.id ?? ipKeyGenerator(req.ip ?? ""),
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: { message: "Too many requests, try again later" } },
  skip: () => process.env.NODE_ENV === "test",
});

// Stricter limit for the auth routes to slow down password guessing.
// Only failed requests (4xx/5xx) count, so normal logins and refreshes aren't blocked.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10, // max failed auth requests per IP per window
  skipSuccessfulRequests: true,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: { message: "Too many attempts, try again later" } },
  // Tests send many deliberately failing requests from the same IP.
  skip: () => process.env.NODE_ENV === "test",
});

export default limiter;

export const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 30, // max AI requests per user per window
  keyGenerator: (req, res) => res.locals.user?.id ?? ipKeyGenerator(req.ip ?? ""),
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: { message: "Too many AI requests, try again later" } },
  skip: () => process.env.NODE_ENV === "test",
});

// Starting the remote portal browser (POST /me/portal) launches Chromium; reconnects
// call it again for a fresh WebSocket ticket. Must run after authenticate.
export const portalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 40,
  keyGenerator: (req, res) => res.locals.user?.id ?? ipKeyGenerator(req.ip ?? ""),
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: { message: "Too many requests, try again later" } },
  skip: () => process.env.NODE_ENV === "test",
});
