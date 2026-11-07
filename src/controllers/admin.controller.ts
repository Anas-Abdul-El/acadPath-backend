import type { Request, Response } from "express";
import AppErr from "../libs/appErr.js";
import * as adminService from "../services/admin/index.js";
import type {
  AdminStatsQuery,
  AdminUniversitiesQuery,
  AdminUniversityBody,
} from "../schemas/admin.schema.js";
import type {
  AdminStatsOutput,
  AdminUniversitiesOutput,
  AdminUniversityOutput,
} from "../types/admin.dto.js";

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

export const listUniversities = async (
  req: Request,
  res: Response<AdminUniversitiesOutput>,
) => {
  const authUser = res.locals.user;
  if (!authUser) throw new AppErr("Missing or malformed access token", 401);

  const query: AdminUniversitiesQuery = res.locals.query;
  res.send(await adminService.listUniversities(query));
};

export const createUniversity = async (
  req: Request<unknown, unknown, AdminUniversityBody>,
  res: Response<AdminUniversityOutput>,
) => {
  const authUser = res.locals.user;
  if (!authUser) throw new AppErr("Missing or malformed access token", 401);

  const data = await adminService.createUniversity(req.body);
  res.status(201).send({ data });
};
