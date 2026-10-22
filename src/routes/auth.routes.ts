import { Router } from "express";
import { authLimiter } from "../config/limiter.js";
import { authController } from "../controllers/index.js";
import { validateBody } from "../middlewares/index.js";
import { loginSchema, signInSchema } from "../schemas/auth.schema.js";

const authRouter: Router = Router();

authRouter.use(authLimiter);

authRouter.post("/signin", validateBody(signInSchema), authController.signIn);
authRouter.post("/login", validateBody(loginSchema), authController.login);
authRouter.post("/refresh", authController.refresh);
authRouter.post("/logout", authController.logout);

export default authRouter;
