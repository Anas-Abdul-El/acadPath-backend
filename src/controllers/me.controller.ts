import type { Request, Response } from "express";
import AppErr from "../libs/appErr.js";
import * as completeOnboardingService from "../services/me/complete-onboarding.service.js";
import * as listDocumentsService from "../services/me/documents/list-documents.service.js";
import * as uploadDocumentsService from "../services/me/documents/upload-documents.service.js";
import * as getMeService from "../services/me/get-me.service.js";
import * as universitySourcesService from "../services/me/university/get-university-sources.service.js";
import * as selectUniversityService from "../services/me/university/select-university.service.js";
import * as uploadSourcesService from "../services/me/university/upload-university-sources.service.js";
import * as updateProfileService from "../services/me/update-profile.service.js";
import type {
  SelectUniversityBody,
  UpdateProfileBody,
  UploadDocumentsBody,
  UploadSourcesInput,
} from "../schemas/me.schema.js";
import type {
  MeOutput,
  SelectUniversityOutput,
  StudentDocumentsOutput,
  UniversityOutput,
  UniversitySourcesOutput,
} from "../types/me.dto.js";

export const getMeData = async (req: Request, res: Response<MeOutput>) => {
  const authUser = res.locals.user;
  if (!authUser) throw new AppErr("Missing or malformed access token", 401);

  const data = await getMeService.getMeData(authUser.id);

  res.send({ data });
};

export const selectUniversity = async (
  req: Request<unknown, unknown, SelectUniversityBody>,
  res: Response<SelectUniversityOutput>,
) => {
  const authUser = res.locals.user;
  if (!authUser) throw new AppErr("Missing or malformed access token", 401);

  const data = await selectUniversityService.selectUniversity(
    authUser.id,
    req.body,
  );

  res.send({ data });
};

export const uploadSources = async (
  req: Request,
  res: Response<UniversityOutput>,
) => {
  const authUser = res.locals.user;
  if (!authUser) throw new AppErr("Missing or malformed access token", 401);

  const files: UploadSourcesInput = res.locals.files;
  const data = await uploadSourcesService.uploadSources(authUser.id, files);

  res.send({ data });
};

export const updateProfile = async (
  req: Request<unknown, unknown, UpdateProfileBody>,
  res: Response<MeOutput>,
) => {
  const authUser = res.locals.user;
  if (!authUser) throw new AppErr("Missing or malformed access token", 401);

  const data = await updateProfileService.updateProfile(authUser.id, req.body);

  res.send({ data });
};

export const uploadDocuments = async (
  req: Request<unknown, unknown, UploadDocumentsBody>,
  res: Response<StudentDocumentsOutput>,
) => {
  const authUser = res.locals.user;
  if (!authUser) throw new AppErr("Missing or malformed access token", 401);

  const files: UploadSourcesInput = res.locals.files;
  const data = await uploadDocumentsService.uploadDocuments(
    authUser.id,
    req.body.type,
    files,
  );

  res.status(201).send({ data });
};

export const completeOnboarding = async (
  req: Request,
  res: Response<MeOutput>,
) => {
  const authUser = res.locals.user;
  if (!authUser) throw new AppErr("Missing or malformed access token", 401);

  const data = await completeOnboardingService.completeOnboarding(authUser.id);

  res.send({ data });
};

export const listDocuments = async (
  req: Request,
  res: Response<StudentDocumentsOutput>,
) => {
  const authUser = res.locals.user;
  if (!authUser) throw new AppErr("Missing or malformed access token", 401);

  const data = await listDocumentsService.listDocuments(authUser.id);

  res.send({ data });
};

export const getStudentUniversitySources = async (
  req: Request,
  res: Response<UniversitySourcesOutput>,
) => {
  const authUser = res.locals.user;
  if (!authUser) throw new AppErr("Missing or malformed access token", 401);

  const data = await universitySourcesService.getStudentUniversitySources(authUser.id);

  res.send({ data });
};
