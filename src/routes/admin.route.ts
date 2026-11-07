import { Router } from "express";
import {
  authenticate,
  authorize,
  validateBody,
  validateParams,
  validateQuery,
} from "../middlewares/index.js";
import {
  adminCourseParamsSchema,
  adminCourseSchema,
  adminCoursesQuerySchema,
  adminCourseUpdateSchema,
  adminMajorSchema,
  adminMajorUpdateSchema,
  adminStatsQuerySchema,
  adminStudentsQuerySchema,
  adminUniversitiesQuerySchema,
  adminUniversitySchema,
  adminUniversityUpdateSchema,
  majorParamsSchema,
  studentParamsSchema,
  universityParamsSchema,
} from "../schemas/admin.schema.js";
import catchAsync from "../utils/catchAsync.js";
import adminController from "../controllers/index.js";

const adminRouter: Router = Router();

adminRouter.use(authenticate, authorize("ADMIN"));

adminRouter.get(
  "/stats",
  validateQuery(adminStatsQuerySchema),
  catchAsync(adminController.getAdminStats),
);

adminRouter.get(
  "/universities",
  validateQuery(adminUniversitiesQuerySchema),
  catchAsync(adminController.listUniversities),
);

adminRouter.post(
  "/universities",
  validateBody(adminUniversitySchema),
  catchAsync(adminController.createUniversity),
);

adminRouter.get(
  "/universities/:universityId",
  validateParams(universityParamsSchema),
  catchAsync(adminController.getUniversity),
);

adminRouter.patch(
  "/universities/:universityId",
  validateParams(universityParamsSchema),
  validateBody(adminUniversityUpdateSchema),
  catchAsync(adminController.updateUniversity),
);

adminRouter.delete(
  "/universities/:universityId",
  validateParams(universityParamsSchema),
  catchAsync(adminController.deleteUniversity),
);

adminRouter.get(
  "/universities/:universityId/majors",
  validateParams(universityParamsSchema),
  catchAsync(adminController.listMajors),
);

adminRouter.post(
  "/universities/:universityId/majors",
  validateParams(universityParamsSchema),
  validateBody(adminMajorSchema),
  catchAsync(adminController.createMajor),
);

adminRouter.patch(
  "/majors/:majorId",
  validateParams(majorParamsSchema),
  validateBody(adminMajorUpdateSchema),
  catchAsync(adminController.updateMajor),
);

adminRouter.delete(
  "/majors/:majorId",
  validateParams(majorParamsSchema),
  catchAsync(adminController.deleteMajor),
);

adminRouter.get(
  "/courses",
  validateQuery(adminCoursesQuerySchema),
  catchAsync(adminController.listAdminCourses),
);

adminRouter.post(
  "/courses",
  validateBody(adminCourseSchema),
  catchAsync(adminController.createAdminCourse),
);

adminRouter.patch(
  "/courses/:courseId",
  validateParams(adminCourseParamsSchema),
  validateBody(adminCourseUpdateSchema),
  catchAsync(adminController.updateAdminCourse),
);

adminRouter.delete(
  "/courses/:courseId",
  validateParams(adminCourseParamsSchema),
  catchAsync(adminController.deleteAdminCourse),
);

adminRouter.get(
  "/students",
  validateQuery(adminStudentsQuerySchema),
  catchAsync(adminController.listAdminStudents),
);

adminRouter.get(
  "/students/:studentId",
  validateParams(studentParamsSchema),
  catchAsync(adminController.getAdminStudent),
);

export default adminRouter;
