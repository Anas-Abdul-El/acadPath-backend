import { Router } from "express";
import {
  authenticate,
  authorize,
  validateBody,
  validateQuery,
} from "../middlewares/index.js";
import {
  adminStatsQuerySchema,
  adminUniversitiesQuerySchema,
  adminUniversitySchema,
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

export default adminRouter;
