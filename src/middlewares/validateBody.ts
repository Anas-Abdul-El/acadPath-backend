import type { RequestHandler } from "express";
import type { z } from "zod";
import AppErr from "../libs/appErr.js";

// Validates req.body against a Zod schema before the controller runs. On success the
// body is replaced with the parsed data (trimmed, lowercased, unknown keys removed);
// on failure an AppErr becomes a 400 with one entry per invalid field.
export function validateBody(schema: z.ZodType): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) throw new AppErr(result.error);

    req.body = result.data;
    next();
  };
}
