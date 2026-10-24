import { Router } from "express";
import { authenticate } from "../middlewares";
import catchAsync from "../utils/catchAsync";
import meController from "../controllers";

const meRouter: Router = Router();

meRouter.get("/", authenticate, catchAsync(meController.getMe));

export default meRouter;
