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
  courseParamsSchema,
  generateStudyPlanSchema,
  studentCoursesQuerySchema,
} from "../schemas/app.schema.js";
import catchAsync from "../utils/catchAsync";
import appController from "../controllers";

const appRouter: Router = Router();
export const courseRouter: Router = Router();

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

courseRouter.get(
  "/:courseId",
  authenticate,
  validateParams(courseParamsSchema),
  catchAsync(appController.getCourseDetails),
);

export default appRouter;
