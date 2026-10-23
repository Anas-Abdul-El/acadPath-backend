import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import type { Express } from "express";
import limiter from "./config/limiter";
import AppErr from "./libs/appErr.js";
import { errorHandler } from "./middlewares/index.js";
import routers from "./routes";

const app: Express = express();

// Security iddleware
app.use(limiter);
app.use(helmet());

// Body and cookie parsing
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());

// Routes
app.use("/api/", routers);

// Nothing matched: hand a 404 to the error handler so it uses the standard error shape.
app.use(() => {
  throw new AppErr("Route not found", 404);
});

// Must be registered last
app.use(errorHandler);

export default app;
