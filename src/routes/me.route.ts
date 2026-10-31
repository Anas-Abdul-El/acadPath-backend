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
  uploadSourcesSchema,
} from "../schemas/me.schema.js";
import catchAsync from "../utils/catchAsync";
import meController from "../controllers";

const meRouter: Router = Router();

meRouter.get("/", authenticate, catchAsync(meController.getMe));

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
  catchAsync(meController.getUniversitySources),
);

meRouter.post(
  "/university/sources",
  authenticate,
  authorize("STUDENT"),
  upload.array("files", 20),
  validateFiles(uploadSourcesSchema),
  catchAsync(meController.uploadSources),
);

meRouter.patch(
  "/profile",
  authenticate,
  authorize("STUDENT"),
  validateBody(updateProfileSchema),
  catchAsync(meController.updateProfile),
);

export default meRouter;
