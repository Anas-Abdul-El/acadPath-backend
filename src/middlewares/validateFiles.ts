import type { RequestHandler } from "express";
import type { z } from "zod";
import AppErr from "../libs/appErr.js";

function validateFiles(schema: z.ZodType): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req.files);
    if (!result.success) throw new AppErr(result.error);

    res.locals.files = result.data;
    next();
  };
}

export default validateFiles;
