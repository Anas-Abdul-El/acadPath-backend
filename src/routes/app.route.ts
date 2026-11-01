import { Router } from "express";
import {
  authenticate,
  authorize,
  validateParams,
  validateQuery,
} from "../middlewares";
import {
  academicRecordsQuerySchema,
  courseParamsSchema,
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

courseRouter.get(
  "/:courseId",
  authenticate,
  validateParams(courseParamsSchema),
  catchAsync(appController.getCourseDetails),
);

export default appRouter;
