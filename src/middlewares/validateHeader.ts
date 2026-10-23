import type { RequestHandler } from "express";
import type { z } from "zod";
import AppErr from "../libs/appErr.js";

// Validates req.headers against a Zod schema before the controller runs, e.g. to check
// that an "authorization" header holds a Bearer token. Node lowercases header names, so the
// schema's keys must be lowercase too. On success the parsed data goes to res.locals.headers;
// req.headers is left untouched, since swapping it for the parsed object would drop every
// header the schema doesn't list (host, content-type, ...). On failure an AppErr becomes a
// 400 by default; pass 401 for auth headers.
function validateHeader(schema: z.ZodType, statusCode = 400): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req.headers);
    if (!result.success) throw new AppErr(result.error, statusCode);

    res.locals.headers = result.data;
    next();
  };
}

export default validateHeader;
