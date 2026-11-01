import type { Request, Response } from "express";
import AppErr from "../libs/appErr.js";
import * as appService from "../services/app.service.js";
import type {
  AcademicRecordsQuery,
  StudentCoursesQuery,
} from "../schemas/app.schema.js";
import type {
  AcademicRecordsOutput,
  AcademicSummaryOutput,
  StudentCoursesOutput,
} from "../types/app.dto.js";

export const getAcademicSummary = async (
  req: Request,
  res: Response<AcademicSummaryOutput>,
) => {
  const authUser = res.locals.user;
  if (!authUser) throw new AppErr("Missing or malformed access token", 401);

  const data = await appService.getAcademicSummary(authUser.id);

  res.send({ data });
};

export const listAcademicRecords = async (
  req: Request,
  res: Response<AcademicRecordsOutput>,
) => {
  const authUser = res.locals.user;
  if (!authUser) throw new AppErr("Missing or malformed access token", 401);

  const query: AcademicRecordsQuery = res.locals.query;
  const data = await appService.listAcademicRecords(authUser.id, query);

  res.send({ data });
};

export const listCourses = async (
  req: Request,
  res: Response<StudentCoursesOutput>,
) => {
  const authUser = res.locals.user;
  if (!authUser) throw new AppErr("Missing or malformed access token", 401);

  const query: StudentCoursesQuery = res.locals.query;
  const data = await appService.listCourses(authUser.id, query);

  res.send({ data });
};
