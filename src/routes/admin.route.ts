import { Router } from "express";
import {
  authenticate,
  authorize,
  validateBody,
  validateParams,
  validateQuery,
} from "../middlewares/index.js";
import {
  adminMajorSchema,
  adminStatsQuerySchema,
  adminUniversitiesQuerySchema,
  adminUniversitySchema,
  adminUniversityUpdateSchema,
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

export default adminRouter;
