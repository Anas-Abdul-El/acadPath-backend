// Runs before every test file (see jest.config.ts), so modules that read
// environment variables at import time find the values they need.
process.env.ACCESS_TOKEN_SECRET = "test-access-secret-that-is-at-least-32-chars";
process.env.REFRESH_TOKEN_SECRET = "test-refresh-secret-that-is-at-least-32-chars";
process.env.VERIFICATION_TOKEN_SECRET = "test-verify-secret-that-is-at-least-32-chars";
