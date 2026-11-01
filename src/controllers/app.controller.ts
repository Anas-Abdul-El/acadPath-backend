import type { Request, Response } from "express";
import AppErr from "../libs/appErr.js";
import * as appService from "../services/app.service.js";
import type { AcademicSummaryOutput } from "../types/app.dto.js";

export const getAcademicSummary = async (
  req: Request,
  res: Response<AcademicSummaryOutput>,
) => {
  const authUser = res.locals.user;
  if (!authUser) throw new AppErr("Missing or malformed access token", 401);

  const data = await appService.getAcademicSummary(authUser.id);

  res.send({ data });
};
