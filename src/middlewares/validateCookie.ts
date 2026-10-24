import type { RequestHandler } from "express";
import type { z } from "zod";
import AppErr from "../libs/appErr.js";

// Validates req.cookies (filled by cookie-parser) against a Zod schema before the controller
// runs, e.g. to check the refresh token cookie. On success the parsed data goes to
// res.locals.cookies. On failure an AppErr becomes a 400 by default; pass 401 for auth cookies.
function validateCookie(schema: z.ZodType, statusCode = 400): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req.cookies ?? {});
    if (!result.success) throw new AppErr(result.error, statusCode);

    res.locals.cookies = result.data;
    next();
  };
}

export default validateCookie;
