import type { RequestHandler } from "express";
import type { z } from "zod";
import AppErr from "../libs/appErr.js";

function validateFiles(schema: z.ZodType): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req.files);
    if (!result.success) {
      const tooLarge = result.error.issues.some(
        (issue) => issue.code === "custom" && issue.params?.["status"] === 413,
      );
      throw new AppErr(result.error, tooLarge ? 413 : 400);
    }

    res.locals.files = result.data;
    next();
  };
}

export default validateFiles;
