import { Router } from "express";
import {
  authenticate,
  authorize,
  validateBody,
  validateParams,
  validateQuery,
} from "../middlewares";
import {
  academicRecordsQuerySchema,
  advisorChatSchema,
  courseParamsSchema,
  generateStudyPlanSchema,
  quizSchema,
  resourceSearchSchema,
  studentCoursesQuerySchema,
  whatIfSchema,
} from "../schemas/app.schema.js";
import catchAsync from "../utils/catchAsync";
import appController from "../controllers";

const appRouter: Router = Router();
export const courseRouter: Router = Router();
export const resourceRouter: Router = Router();
export const quizRouter: Router = Router();

appRouter.get(
  "/academic-summary",
  authenticate,
  authorize("STUDENT"),
  catchAsync(appController.getAcademicSummary),
);

appRouter.get(
  "/academic-records",
  authenticate,
  authorize("STUDENT"),
  validateQuery(academicRecordsQuerySchema),
  catchAsync(appController.listAcademicRecords),
);

appRouter.get(
  "/courses",
  authenticate,
  authorize("STUDENT"),
  validateQuery(studentCoursesQuerySchema),
  catchAsync(appController.listCourses),
);

appRouter.get(
  "/study-plan",
  authenticate,
  authorize("STUDENT"),
  catchAsync(appController.getStudyPlan),
);

appRouter.post(
  "/study-plan/generate",
  authenticate,
  authorize("STUDENT"),
  validateBody(generateStudyPlanSchema),
  catchAsync(appController.generateStudyPlan),
);

appRouter.post(
  "/what-if",
  authenticate,
  authorize("STUDENT"),
  validateBody(whatIfSchema),
  catchAsync(appController.analyzeWhatIf),
);

appRouter.get(
  "/recommendations",
  authenticate,
  authorize("STUDENT"),
  catchAsync(appController.getRecommendations),
);

appRouter.post(
  "/advisor/chat",
  authenticate,
  authorize("STUDENT"),
  validateBody(advisorChatSchema),
  catchAsync(appController.advisorChat),
);

courseRouter.get(
  "/:courseId",
  authenticate,
  validateParams(courseParamsSchema),
  catchAsync(appController.getCourseDetails),
);

resourceRouter.post(
  "/search",
  authenticate,
  authorize("STUDENT"),
  validateBody(resourceSearchSchema),
  catchAsync(appController.searchResources),
);

quizRouter.post(
  "/",
  authenticate,
  authorize("STUDENT"),
  validateBody(quizSchema),
  catchAsync(appController.generateQuiz),
);

export default appRouter;
