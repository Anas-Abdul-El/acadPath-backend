import { Router } from "express";
import adminRouter from "./admin.route.js";
import appRouter, {
  courseRouter,
  quizRouter,
  resourceRouter,
} from "./app.route.js";
import authRouter from "./auth.route.js";
import meRouter from "./me.route.js";

const router: Router = Router();

router.use("/auth", authRouter);
router.use("/me", meRouter);
router.use("/me", appRouter);
router.use("/courses", courseRouter);
router.use("/resources", resourceRouter);
router.use("/quizzes", quizRouter);
router.use("/admin", adminRouter);

export default router;
