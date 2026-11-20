# acadPath-backend

Express + TypeScript API for AcadPath (Prisma on Neon Postgres).

## Local setup

```sh
pnpm install
pnpm browser:install   # Chromium for the student-portal import (once, and after upgrading playwright)
pnpm dev
```

`pnpm install` installs the `playwright` package but not the browser it drives. Without
`pnpm browser:install`, `POST /api/me/portal` fails with "Could not start the remote browser"
and the server log shows `Executable doesn't exist at …/ms-playwright/…`. On Linux, if Chromium
then fails on missing system libraries, run `pnpm exec playwright install-deps chromium`.

The Docker image (used on Render) already includes the matching browser.

## Deploying on Render

The service runs on Render's Node runtime. Playwright's Chromium is downloaded during the
build into the project folder, the only part of the build Render keeps:

- Build command: `pnpm install --frozen-lockfile && pnpm exec playwright install --only-shell chromium && pnpm run build`
- Start command: `pnpm run start`
- Environment: `PLAYWRIGHT_BROWSERS_PATH=0` and `TRUST_PROXY=true`, plus the variables in `.env.example`
