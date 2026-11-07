import type { Request, Response } from "express";
import AppErr from "../libs/appErr.js";
import * as adminService from "../services/admin/index.js";
import type { AdminStatsQuery } from "../schemas/admin.schema.js";
import type { AdminStatsOutput } from "../types/admin.dto.js";

export const getAdminStats = async (
  req: Request,
  res: Response<AdminStatsOutput>,
) => {
  const authUser = res.locals.user;
  if (!authUser) throw new AppErr("Missing or malformed access token", 401);

  const query: AdminStatsQuery = res.locals.query;
  const data = await adminService.getAdminStats(query);
  res.send({ data });
};
