import rateLimit from "express-rate-limit";

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 100, // max requests per IP per window
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

// Stricter limit for the auth routes to slow down password guessing.
// Only failed requests (4xx/5xx) count, so normal logins and refreshes aren't blocked.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10, // max failed auth requests per IP per window
  skipSuccessfulRequests: true,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  // Tests send many deliberately failing requests from the same IP.
  skip: () => process.env.NODE_ENV === "test",
});

export default limiter;
