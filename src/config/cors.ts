import type { CorsOptions } from "cors";
import { z } from "zod";

// The local Vite dev server, allowed when CORS_ORIGIN isn't set outside production.
const DEV_ORIGIN = "http://localhost:5173";

// CORS_ORIGIN is a comma-separated list of exact origins (scheme, host and port,
// no path), e.g. "https://acadpath.app,https://www.acadpath.app".
// Validated once at startup: production refuses to start without it.
export const allowedOrigins = z
  .string()
  .optional()
  .transform((value, ctx) => {
    const origins = (value ?? "")
      .split(",")
      .map((origin) => origin.trim().replace(/\/+$/, ""))
      .filter(Boolean);

    for (const origin of origins) {
      if (!URL.canParse(origin) || new URL(origin).origin !== origin)
        ctx.addIssue({
          code: "custom",
          message: `CORS_ORIGIN has an invalid origin: "${origin}" (use e.g. https://example.com)`,
        });
    }

    if (origins.length) return origins;
    if (process.env.NODE_ENV === "production") {
      ctx.addIssue({ code: "custom", message: "CORS_ORIGIN is required in production" });
      return z.NEVER;
    }
    return [DEV_ORIGIN];
  })
  .parse(process.env.CORS_ORIGIN);

export const corsOptions: CorsOptions = {
  // Only listed origins get CORS headers; the browser blocks every other origin.
  origin: allowedOrigins,
  // The frontend sends the refresh cookie (axios withCredentials: true).
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  // Lets the frontend read the rate-limit headers (express-rate-limit draft-8).
  exposedHeaders: ["RateLimit", "RateLimit-Policy", "Retry-After"],
  // Browsers cache the preflight for 10 minutes.
  maxAge: 600,
};
