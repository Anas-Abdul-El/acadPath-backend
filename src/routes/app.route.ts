import { Router } from "express";
import { authenticate, authorize } from "../middlewares";
import catchAsync from "../utils/catchAsync";
import appController from "../controllers";

const appRouter: Router = Router();

appRouter.get(
  "/academic-summary",
  authenticate,
  authorize("STUDENT"),
  catchAsync(appController.getAcademicSummary),
);

export default appRouter;
