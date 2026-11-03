import type { Request, Response } from "express";
import AppErr from "../libs/appErr.js";
import * as meService from "../services/me/index.js";
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

  const data = await meService.getMeData(authUser.id);

  res.send({ data });
};

export const selectUniversity = async (
  req: Request<unknown, unknown, SelectUniversityBody>,
  res: Response<SelectUniversityOutput>,
) => {
  const authUser = res.locals.user;
  if (!authUser) throw new AppErr("Missing or malformed access token", 401);

  const data = await meService.selectUniversity(
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
  const data = await meService.uploadSources(authUser.id, files);

  res.send({ data });
};

export const updateProfile = async (
  req: Request<unknown, unknown, UpdateProfileBody>,
  res: Response<MeOutput>,
) => {
  const authUser = res.locals.user;
  if (!authUser) throw new AppErr("Missing or malformed access token", 401);

  const data = await meService.updateProfile(authUser.id, req.body);

  res.send({ data });
};

export const uploadDocuments = async (
  req: Request<unknown, unknown, UploadDocumentsBody>,
  res: Response<StudentDocumentsOutput>,
) => {
  const authUser = res.locals.user;
  if (!authUser) throw new AppErr("Missing or malformed access token", 401);

  const files: UploadSourcesInput = res.locals.files;
  const data = await meService.uploadDocuments(
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

  const data = await meService.completeOnboarding(authUser.id);

  res.send({ data });
};

export const listDocuments = async (
  req: Request,
  res: Response<StudentDocumentsOutput>,
) => {
  const authUser = res.locals.user;
  if (!authUser) throw new AppErr("Missing or malformed access token", 401);

  const data = await meService.listDocuments(authUser.id);

  res.send({ data });
};

export const getStudentUniversitySources = async (
  req: Request,
  res: Response<UniversitySourcesOutput>,
) => {
  const authUser = res.locals.user;
  if (!authUser) throw new AppErr("Missing or malformed access token", 401);

  const data = await meService.getStudentUniversitySources(authUser.id);

  res.send({ data });
};
