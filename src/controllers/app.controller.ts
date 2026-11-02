import type { Request, Response } from "express";
import AppErr from "../libs/appErr.js";
import * as courseDetailsService from "../services/courses/get-course-details.service.js";
import * as academicSummaryService from "../services/me/academic/get-academic-summary.service.js";
import * as academicRecordsService from "../services/me/academic/list-academic-records.service.js";
import * as listCoursesService from "../services/me/courses/list-courses.service.js";
import * as generateStudyPlanService from "../services/me/study-plan/generate-study-plan.service.js";
import * as getStudyPlanService from "../services/me/study-plan/get-study-plan.service.js";
import * as whatIfService from "../services/me/what-if/analyze-what-if.service.js";
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

  const data = await academicSummaryService.getAcademicSummary(authUser.id);

  res.send({ data });
};

export const listAcademicRecords = async (
  req: Request,
  res: Response<AcademicRecordsOutput>,
) => {
  const authUser = res.locals.user;
  if (!authUser) throw new AppErr("Missing or malformed access token", 401);

  const query: AcademicRecordsQuery = res.locals.query;
  const data = await academicRecordsService.listAcademicRecords(authUser.id, query);

  res.send({ data });
};

export const listCourses = async (
  req: Request,
  res: Response<StudentCoursesOutput>,
) => {
  const authUser = res.locals.user;
  if (!authUser) throw new AppErr("Missing or malformed access token", 401);

  const query: StudentCoursesQuery = res.locals.query;
  const data = await listCoursesService.listCourses(authUser.id, query);

  res.send({ data });
};

export const getCourseDetails = async (
  req: Request,
  res: Response<CourseDetailsOutput>,
) => {
  const authUser = res.locals.user;
  if (!authUser) throw new AppErr("Missing or malformed access token", 401);

  const { courseId }: CourseParams = res.locals.params;
  const data = await courseDetailsService.getCourseDetails(
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

  const data = await getStudyPlanService.getStudyPlan(authUser.id);

  res.send({ data });
};

export const generateStudyPlan = async (
  req: Request<unknown, unknown, GenerateStudyPlanBody>,
  res: Response<StudyPlanOutput>,
) => {
  const authUser = res.locals.user;
  if (!authUser) throw new AppErr("Missing or malformed access token", 401);

  const data = await generateStudyPlanService.generateStudyPlan(authUser.id, req.body);

  res.status(201).send({ data });
};

export const analyzeWhatIf = async (
  req: Request<unknown, unknown, WhatIfBody>,
  res: Response<WhatIfOutput>,
) => {
  const authUser = res.locals.user;
  if (!authUser) throw new AppErr("Missing or malformed access token", 401);

  const data = await whatIfService.analyzeWhatIf(authUser.id, req.body);

  res.send({ data });
};
