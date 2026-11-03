import type { Request, Response } from "express";
import AppErr from "../libs/appErr.js";
import * as coursesService from "../services/courses/index.js";
import * as meService from "../services/me/index.js";
import type {
  AcademicRecordsQuery,
  CourseParams,
  GenerateStudyPlanBody,
  StudentCoursesQuery,
  WhatIfBody,
} from "../schemas/app.schema.js";
import type {
  AcademicRecordsOutput,
  AcademicSummaryOutput,
  CourseDetailsOutput,
  StudentCoursesOutput,
  StudyPlanOutput,
  WhatIfOutput,
} from "../types/app.dto.js";

export const getAcademicSummary = async (
  req: Request,
  res: Response<AcademicSummaryOutput>,
) => {
  const authUser = res.locals.user;
  if (!authUser) throw new AppErr("Missing or malformed access token", 401);

  const data = await meService.getAcademicSummary(authUser.id);

  res.send({ data });
};

export const listAcademicRecords = async (
  req: Request,
  res: Response<AcademicRecordsOutput>,
) => {
  const authUser = res.locals.user;
  if (!authUser) throw new AppErr("Missing or malformed access token", 401);

  const query: AcademicRecordsQuery = res.locals.query;
  const data = await meService.listAcademicRecords(authUser.id, query);

  res.send({ data });
};

export const listCourses = async (
  req: Request,
  res: Response<StudentCoursesOutput>,
) => {
  const authUser = res.locals.user;
  if (!authUser) throw new AppErr("Missing or malformed access token", 401);

  const query: StudentCoursesQuery = res.locals.query;
  const data = await meService.listCourses(authUser.id, query);

  res.send({ data });
};

export const getCourseDetails = async (
  req: Request,
  res: Response<CourseDetailsOutput>,
) => {
  const authUser = res.locals.user;
  if (!authUser) throw new AppErr("Missing or malformed access token", 401);

  const { courseId }: CourseParams = res.locals.params;
  const data = await coursesService.getCourseDetails(
    courseId,
    authUser.id,
    authUser.role,
  );

  res.send({ data });
};

export const getStudyPlan = async (
  req: Request,
  res: Response<StudyPlanOutput>,
) => {
  const authUser = res.locals.user;
  if (!authUser) throw new AppErr("Missing or malformed access token", 401);

  const data = await meService.getStudyPlan(authUser.id);

  res.send({ data });
};

export const generateStudyPlan = async (
  req: Request<unknown, unknown, GenerateStudyPlanBody>,
  res: Response<StudyPlanOutput>,
) => {
  const authUser = res.locals.user;
  if (!authUser) throw new AppErr("Missing or malformed access token", 401);

  const data = await meService.generateStudyPlan(authUser.id, req.body);

  res.status(201).send({ data });
};

export const analyzeWhatIf = async (
  req: Request<unknown, unknown, WhatIfBody>,
  res: Response<WhatIfOutput>,
) => {
  const authUser = res.locals.user;
  if (!authUser) throw new AppErr("Missing or malformed access token", 401);

  const data = await meService.analyzeWhatIf(authUser.id, req.body);

  res.send({ data });
};
