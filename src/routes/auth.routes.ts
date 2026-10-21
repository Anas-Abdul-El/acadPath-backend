import { Router } from "express";
import { authLimiter } from "../config/limiter.js";
import * as authController from "../controllers/auth.controller.js";
import { validateBody } from "../middlewares/validateBody.js";
import { loginSchema, signInSchema } from "../schemas/auth.schema.js";

const authRouter: Router = Router();

authRouter.use(authLimiter);

authRouter.post("/signin", validateBody(signInSchema), authController.signIn);
authRouter.post("/login", validateBody(loginSchema), authController.login);
authRouter.post("/refresh", authController.refresh);

export default authRouter;
