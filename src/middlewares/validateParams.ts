import type { RequestHandler } from "express";
import type { z } from "zod";
import AppErr from "../libs/appErr.js";

function validateParams(schema: z.ZodType): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req.params);
    if (!result.success) throw new AppErr(result.error);

    res.locals.params = result.data;
    next();
  };
}

export default validateParams;
