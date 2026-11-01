import { Router } from "express";
import appRouter from "./app.route.js";
import authRouter from "./auth.route.js";
import meRouter from "./me.route.js";

const router: Router = Router();

router.use("/auth", authRouter);
router.use("/me", meRouter);
router.use("/me", appRouter);

export default router;
