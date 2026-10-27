import { Router } from "express";
import {
  authenticate,
  upload,
  validateBody,
  validateFiles,
} from "../middlewares";
import {
  selectUniversitySchema,
  uploadSourcesSchema,
} from "../schemas/me.schema.js";
import catchAsync from "../utils/catchAsync";
import meController from "../controllers";

const meRouter: Router = Router();

meRouter.get("/", authenticate, catchAsync(meController.getMe));

meRouter.put(
  "/university",
  authenticate,
  validateBody(selectUniversitySchema),
  catchAsync(meController.selectUniversity),
);

meRouter.post(
  "/university/sources",
  authenticate,
  upload.array("files", 20),
  validateFiles(uploadSourcesSchema),
  catchAsync(meController.uploadSources),
);

export default meRouter;
