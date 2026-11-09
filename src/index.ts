import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import cors from "cors";
import { corsOptions } from "./config/cors.js";
import type { Express } from "express";
import limiter from "./config/limiter.js";
import AppErr from "./libs/appErr.js";
import { errorHandler } from "./middlewares/index.js";
import routers from "./routes/index.js";

const app: Express = express();

// CORS first, so every response (including 429s and errors) carries the CORS
// headers, and preflight OPTIONS requests are answered before the rate limiter.
app.use(cors(corsOptions));

// Security Middleware
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
