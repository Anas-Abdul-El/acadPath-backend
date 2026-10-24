import { Router } from "express";
import { validateBody, validateHeader } from "../middlewares/index.js";
import * as authSchema from "../schemas/auth.schema.js";
import catchAsync from "../utils/catchAsync.js";
import { authLimiter } from "../config/limiter.js";
import authController from "../controllers/index.js";

const authRouter: Router = Router();

authRouter.use(authLimiter);

authRouter.post(
  "/login",
  validateBody(authSchema.loginSchema),
  catchAsync(authController.login),
);

authRouter.post(
  "/signin",
  validateBody(authSchema.signinSchema),
  catchAsync(authController.signIn),
);

authRouter.post(
  "/refresh",
  validateHeader(authSchema.refreshTokenSchema),
  catchAsync((req: Request, res: Response) => {}),
);

authRouter.post(
  "/logout",
  validateHeader(authSchema.logoutSchema),
  catchAsync((req: Request, res: Response) => {}),
);

export default authRouter;
