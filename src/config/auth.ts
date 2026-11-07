import { z } from "zod";

const secret = (name: string) => z.string().min(32, `${name} must be at least 32 characters`);

// Validated once at startup: the server refuses to start with a missing or weak secret,
// instead of failing on the first login.
const authEnv = z
  .object({
    ACCESS_TOKEN_SECRET: secret("ACCESS_TOKEN_SECRET"),
    REFRESH_TOKEN_SECRET: secret("REFRESH_TOKEN_SECRET"),
  })
  // Separate secrets only help if they are actually different.
  .refine(
    (env) => env.ACCESS_TOKEN_SECRET !== env.REFRESH_TOKEN_SECRET,
    "ACCESS_TOKEN_SECRET and REFRESH_TOKEN_SECRET must be different",
  )
  .parse(process.env);

const REFRESH_TOKEN_TTL_DAYS = 7;

export const authConfig = {
  tokens: {
    access: { secret: authEnv.ACCESS_TOKEN_SECRET, expiresIn: "1h" },
    refresh: { secret: authEnv.REFRESH_TOKEN_SECRET, expiresIn: `${REFRESH_TOKEN_TTL_DAYS}d` },
  },
  // Same lifetime as the refresh JWT, in ms, for the Session row and the cookie.
  refreshTokenTtlMs: REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  refreshCookieName: "refreshToken",
  // The browser only sends the refresh cookie to the auth routes (must match where authRouter is mounted).
  refreshCookiePath: "/api/auth",
  bcryptSaltRounds: 12,
} as const;
