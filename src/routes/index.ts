import { Router } from "express";
import authRouter from "./auth.route.js";

const router: Router = Router();

router.use("/auth", authRouter);

export default router;
