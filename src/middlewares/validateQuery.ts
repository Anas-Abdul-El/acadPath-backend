import type { RequestHandler } from "express";
import type { z } from "zod";
import AppErr from "../libs/appErr.js";

function validateQuery(schema: z.ZodType): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) throw new AppErr(result.error);

    res.locals.query = result.data;
    next();
  };
}

export default validateQuery;
