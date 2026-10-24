import { Router } from "express";
import authRouter from "./auth.route.js";
import meRouter from "./me.route.js";

const router: Router = Router();

router.use("/auth", authRouter);
router.use("/me", meRouter);

export default router;
