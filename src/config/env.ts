import { parseEnv } from "@neon/env";
import neonConfig from "../../neon.js";

// Validates the Neon-managed variables (written to .env by `neon deploy` / `neon env pull`)
// against the services declared in neon.ts. Throws at startup if any are missing.
// DATABASE_URL_UNPOOLED is not listed: only the Prisma CLI uses it (see prisma.config.ts).
export const neonEnv = parseEnv(neonConfig, [
  "DATABASE_URL",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_ENDPOINT_URL_S3",
  "AWS_REGION",
]);
