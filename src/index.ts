import express from "express";
import helmet from "helmet";
import type { Express } from "express";
import limiter from "./config/limiter";

const app: Express = express();

// Security iddleware
app.use(limiter);
app.use(helmet());

export default app;
