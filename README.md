# acadPath-backend
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
