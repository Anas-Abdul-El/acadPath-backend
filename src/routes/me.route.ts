import { Router } from "express";
import {
  authenticate,
  authorize,
  upload,
  validateBody,
  validateFiles,
} from "../middlewares";
import {
  selectUniversitySchema,
  updateProfileSchema,
  uploadDocumentsBodySchema,
  uploadSourcesSchema,
} from "../schemas/me.schema.js";
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
  catchAsync(meController.listDocuments),
);

meRouter.post(
  "/documents",
  authenticate,
  authorize("STUDENT"),
  upload.array("files", 20),
  validateFiles(uploadSourcesSchema),
  validateBody(uploadDocumentsBodySchema),
  catchAsync(meController.uploadDocuments),
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
