import { Router } from "express";
import { validateBody, validateCookie } from "../middlewares/index.js";
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
  validateCookie(authSchema.refreshTokenSchema, 401),
  catchAsync((req: Request, res: Response) => {}),
);

authRouter.post(
  "/logout",
  validateCookie(authSchema.logoutSchema, 401),
  catchAsync((req: Request, res: Response) => {}),
);

export default authRouter;
