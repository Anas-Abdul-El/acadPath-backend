import { z } from "zod";

/**
 * Settings for the remote student-portal browser (see libs/portal/).
 *
 * A headless Chromium runs on the server; the student sees it in the onboarding page,
 * signs in to their university portal themselves and opens their transcript. The page's
 * HTML is then parsed to text and sent to the AI. Defaults target LIU's student portal.
 */
const portalEnv = z
  .object({
    PORTAL_START_URL: z.url().default("https://syslbv4.liu.edu.lb/login/"),
    // Comma-separated domains the browser may navigate to (subdomains included).
    PORTAL_ALLOWED_HOSTS: z.string().default("liu.edu.lb"),
    // Max browsers open at once across all students (each one costs ~150 MB of RAM).
    PORTAL_MAX_SESSIONS: z.coerce.number().int().min(1).max(50).default(5),
    // A session nobody is watching is closed after this many minutes.
    PORTAL_IDLE_MINUTES: z.coerce.number().int().min(1).max(120).default(10),
  })
  .parse(process.env);

const allowedHosts = portalEnv.PORTAL_ALLOWED_HOSTS.split(",")
  .map((host) => host.trim().toLowerCase().replace(/^\.+/, ""))
  .filter(Boolean);

export const portalConfig = {
  startUrl: portalEnv.PORTAL_START_URL,
  allowedHosts,
  maxSessions: portalEnv.PORTAL_MAX_SESSIONS,
  idleMs: portalEnv.PORTAL_IDLE_MINUTES * 60_000,
  // Hard cap on a session's lifetime, even while watched.
  maxLifetimeMs: 30 * 60_000,
  // A WebSocket ticket is single-use and valid this long.
  ticketTtlMs: 60_000,
  // Text sent to the AI is cut to this many characters.
  maxTextLength: 60_000,
  defaultViewport: { width: 1280, height: 800 },
} as const;
