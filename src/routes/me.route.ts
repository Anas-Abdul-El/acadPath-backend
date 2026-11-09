import { Router } from "express";
import {
  authenticate,
  authorize,
  upload,
  validateBody,
  validateFiles,
  validateQuery,
} from "../middlewares";
import {
  documentsQuerySchema,
  selectUniversitySchema,
  updateProfileSchema,
  uploadDocumentFilesSchema,
  uploadDocumentsBodySchema,
  uploadSourcesSchema,
  yearOfStudySchema,
} from "../schemas/me.schema.js";
import { pollLimiter } from "../config/limiter.js";
import catchAsync from "../utils/catchAsync";
import meController from "../controllers";

const meRouter: Router = Router();

meRouter.get("/", authenticate, catchAsync(meController.getMeData));

meRouter.put(
  "/university",
  authenticate,
  authorize("STUDENT"),
  validateBody(selectUniversitySchema),
  catchAsync(meController.selectUniversity),
);

meRouter.get(
  "/university/sources",
  authenticate,
  authorize("STUDENT"),
  pollLimiter,
  catchAsync(meController.getStudentUniversitySources),
);

meRouter.post(
  "/university/sources",
  authenticate,
  authorize("STUDENT"),
  upload.array("files", 20),
  validateFiles(uploadSourcesSchema),
  catchAsync(meController.uploadSources),
);

meRouter.get(
  "/documents",
  authenticate,
  authorize("STUDENT"),
  pollLimiter,
  validateQuery(documentsQuerySchema),
  catchAsync(meController.listDocuments),
);

meRouter.post(
  "/documents",
  authenticate,
  authorize("STUDENT"),
  upload.array("files", 20),
  validateFiles(uploadDocumentFilesSchema),
  validateBody(uploadDocumentsBodySchema),
  catchAsync(meController.uploadDocuments),
);

meRouter.put(
  "/year-of-study",
  authenticate,
  authorize("STUDENT"),
  validateBody(yearOfStudySchema),
  catchAsync(meController.updateYearOfStudy),
);

meRouter.patch(
  "/profile",
  authenticate,
  authorize("STUDENT"),
  validateBody(updateProfileSchema),
  catchAsync(meController.updateProfile),
);

meRouter.post(
  "/onboarding/complete",
  authenticate,
  authorize("STUDENT"),
  catchAsync(meController.completeOnboarding),
);

export default meRouter;
