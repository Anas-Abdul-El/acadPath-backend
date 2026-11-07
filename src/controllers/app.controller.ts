import type { Request, Response } from "express";
import logger from "../config/logger.js";
import AppErr from "../libs/appErr.js";
import * as coursesService from "../services/courses/index.js";
import * as meService from "../services/me/index.js";
import * as quizzesService from "../services/quizzes/index.js";
import * as resourcesService from "../services/resources/index.js";
import type {
  AcademicRecordsQuery,
  AdvisorChatBody,
  CourseParams,
  GenerateStudyPlanBody,
  PlanCourseParams,
  QuizBody,
  ResourceSearchBody,
  StudentCoursesQuery,
  UpdatePlanCourseBody,
  WhatIfBody,
} from "../schemas/app.schema.js";
import type {
  AcademicRecordsOutput,
  AcademicSummaryOutput,
  CourseDetailsOutput,
  QuizOutput,
  RecommendationsOutput,
  ResourceSearchOutput,
  StudentCoursesOutput,
  StudyPlanCourseOutput,
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

export const updatePlanCourse = async (
  req: Request<unknown, unknown, UpdatePlanCourseBody>,
  res: Response<StudyPlanCourseOutput>,
) => {
  const authUser = res.locals.user;
  if (!authUser) throw new AppErr("Missing or malformed access token", 401);

  const { planCourseId }: PlanCourseParams = res.locals.params;
  const data = await meService.updatePlanCourse(
    authUser.id,
    planCourseId,
    req.body,
  );
  res.send({ data });
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

export const getRecommendations = async (
  req: Request,
  res: Response<RecommendationsOutput>,
) => {
  const authUser = res.locals.user;
  if (!authUser) throw new AppErr("Missing or malformed access token", 401);

  const data = await meService.getRecommendations(authUser.id);

  res.send({ data });
};

export const searchResources = async (
  req: Request<unknown, unknown, ResourceSearchBody>,
  res: Response<ResourceSearchOutput>,
) => {
  const authUser = res.locals.user;
  if (!authUser) throw new AppErr("Missing or malformed access token", 401);

  const data = await resourcesService.searchResources(authUser.id, req.body);
  res.send({ data });
};

export const generateQuiz = async (
  req: Request<unknown, unknown, QuizBody>,
  res: Response<QuizOutput>,
) => {
  const authUser = res.locals.user;
  if (!authUser) throw new AppErr("Missing or malformed access token", 401);

  const data = await quizzesService.generateQuiz(req.body);
  res.status(201).send({ data });
};

export const advisorChat = async (
  req: Request<unknown, unknown, AdvisorChatBody>,
  res: Response,
) => {
  const authUser = res.locals.user;
  if (!authUser) throw new AppErr("Missing or malformed access token", 401);

  const abort = new AbortController();
  res.on("close", () => abort.abort());

  const reply = await meService.streamAdvisorReply(
    authUser.id,
    req.body,
    abort.signal,
  );

  res.status(200).set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.flushHeaders();

  const send = (event: "delta" | "done" | "error", data: object) =>
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  try {
    for await (const text of reply) send("delta", { text });
    send("done", {});
  } catch (error) {
    if (!abort.signal.aborted) {
      logger.error("Advisor reply failed", error);
      send("error", { message: "The advisor is unavailable right now." });
    }
  }
  res.end();
};
