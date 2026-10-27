import { Router } from "express";
import { authenticate, validateBody } from "../middlewares";
import { selectUniversitySchema } from "../schemas/me.schema.js";
import catchAsync from "../utils/catchAsync";
import meController from "../controllers";

const meRouter: Router = Router();

meRouter.get("/", authenticate, catchAsync(meController.getMe));

meRouter.put(
  "/university",
  authenticate,
  validateBody(selectUniversitySchema),
  catchAsync(meController.selectUniversity),
);

export default meRouter;
