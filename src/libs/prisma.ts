import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import { neonEnv } from "../config/env.js";

// Prisma 7 talks to Postgres through a driver adapter. This is a long-running Express
// server, so we use node-postgres (via @prisma/adapter-pg), which keeps a connection pool
// open across requests. DATABASE_URL is Neon's pooled (-pooler / PgBouncer) endpoint.
const adapter = new PrismaPg({ connectionString: neonEnv.postgres.databaseUrl });

export const prisma = new PrismaClient({ adapter });
