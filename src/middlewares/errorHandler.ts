import type { NextFunction, Request, Response } from "express";
import { MulterError } from "multer";
import logger from "../config/logger.js";
import AppErr from "../libs/appErr.js";

// Errors from Express's own body parser (malformed JSON, body too large) carry a 4xx
// `status` and `expose: true`, meaning their message is safe to show the client.
function isExposedClientError(error: unknown): error is Error & { status: number } {
  return (
    error instanceof Error &&
    "status" in error &&
    typeof error.status === "number" &&
    error.status >= 400 &&
    error.status < 500 &&
    "expose" in error &&
    error.expose === true
  );
}

// Last middleware in the chain; Express 5 sends both thrown errors and rejected
// promises from async handlers here. Every error response has the shape
// { error: { message, details? } }.
// Express recognizes error handlers by their four parameters, so `_next` must stay.
export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (error instanceof AppErr) {
    if (error.statusCode >= 500) logger.error(error.message, { cause: error.cause });

    res.status(error.statusCode).json({
      error: { message: error.message, ...(error.details && { details: error.details }) },
    });
    return;
  }

  if (error instanceof MulterError) {
    res.status(400).json({ error: { message: error.message } });
    return;
  }

  if (isExposedClientError(error)) {
    res.status(error.status).json({ error: { message: error.message } });
    return;
  }

  // Anything else is a bug or an outage: log the details, but never send them to the client.
  logger.error("Unhandled error", error);
  res.status(500).json({ error: { message: "Internal server error" } });
}
