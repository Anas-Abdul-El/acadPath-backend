import type { RequestHandler } from "express";
import type { z } from "zod";
import AppErr from "../libs/appErr.js";

function validateFiles(schema: z.ZodType): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req.files);
    if (!result.success) {
      // A schema can ask for 413 (too large) or 415 (unsupported type) through
      // a custom issue's params.status; anything else is a 400.
      const statuses = new Set(
        result.error.issues.map((issue) =>
          issue.code === "custom" ? issue.params?.["status"] : undefined,
        ),
      );
      const status = statuses.has(415) ? 415 : statuses.has(413) ? 413 : 400;
      throw new AppErr(result.error, status);
    }

    res.locals.files = result.data;
    next();
  };
}

export default validateFiles;
