import { ZodError } from "zod";

// One problem with the request data, e.g. { path: "courses.0.credits", message: "Too small" }.
export interface ValidationIssue {
  path: string;
  message: string;
}

// An error we throw on purpose, e.g. `throw new AppErr("Course not found", 404)`.
// The error-handling middleware can trust its message, status code and details and send
// them to the client; any other Error is unexpected and should become a generic 500.
//
// It also accepts a ZodError: `throw new AppErr(result.error)` becomes a 400
// "Validation failed" with one entry in `details` per invalid field.
export class AppErr extends Error {
  readonly statusCode: number;
  readonly details?: ValidationIssue[];

  // `options.cause` keeps the original error (e.g. a Prisma or axios error) for logging.
  constructor(error: string | ZodError, statusCode?: number, options?: ErrorOptions) {
    if (error instanceof ZodError) {
      // The ZodError itself becomes the cause, so the full report is still available in logs.
      super("Validation failed", { cause: error, ...options });
      this.statusCode = statusCode ?? 400;
      // Only path and message are copied: they describe what is wrong without
      // echoing back the values the client sent.
      this.details = error.issues.map((issue) => ({
        path: issue.path.map(String).join("."),
        message: issue.message,
      }));
    } else {
      super(error, options);
      this.statusCode = statusCode ?? 500;
    }
    this.name = "AppErr";
  }
}
