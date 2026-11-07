import { Router } from "express";
import { authenticate, authorize, validateQuery } from "../middlewares/index.js";
import { adminStatsQuerySchema } from "../schemas/admin.schema.js";
import catchAsync from "../utils/catchAsync.js";
import adminController from "../controllers/index.js";

const adminRouter: Router = Router();

adminRouter.use(authenticate, authorize("ADMIN"));

adminRouter.get(
  "/stats",
  validateQuery(adminStatsQuerySchema),
  catchAsync(adminController.getAdminStats),
);

export default adminRouter;
