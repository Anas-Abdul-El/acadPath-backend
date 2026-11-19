# The portal import drives a real Chromium through Playwright, so the image starts from
# Playwright's own image: it has Node, Chromium and Chromium's system libraries, at the
# exact version the playwright package in pnpm-lock.yaml expects.
FROM mcr.microsoft.com/playwright:v1.65.0-noble

WORKDIR /app

# pnpm at the version package.json pins.
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# Dev dependencies stay: the build needs TypeScript, and the start command runs the
# Prisma CLI to apply migrations.
RUN pnpm install --frozen-lockfile --prod=false

COPY . .

# prisma.config.ts reads DATABASE_URL_UNPOOLED, but `prisma generate` never connects,
# so a placeholder is enough at build time. The real URL comes from the host at runtime.
RUN DATABASE_URL_UNPOOLED=postgresql://build:build@localhost:5432/build pnpm build

ENV NODE_ENV=production
EXPOSE 3000

# Apply pending migrations, then start. Both run on every deploy and restart;
# `migrate deploy` does nothing when the database is already up to date.
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && node dist/src/server.js"]
