import type { Request, Response } from "express";
import AppErr from "../libs/appErr.js";
import * as meService from "../services/me.service.js";
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

export const getMe = async (req: Request, res: Response<MeOutput>) => {
  const authUser = res.locals.user;
  if (!authUser) throw new AppErr("Missing or malformed access token", 401);

  const data = await meService.getMe(authUser.id);

  res.send({ data });
};

export const selectUniversity = async (
  req: Request<unknown, unknown, SelectUniversityBody>,
  res: Response<SelectUniversityOutput>,
) => {
  const authUser = res.locals.user;
  if (!authUser) throw new AppErr("Missing or malformed access token", 401);

  const found = await meService.findUniversity(req.body);
  const university =
    found.university ?? (await meService.createUniversity(req.body));

  if (found.major) {
    const replaced = await meService.saveSelection(
      authUser.id,
      university.id,
      found.major.id,
    );
    return res.send({
      data: {
        ...meService.toUniversityData(university, found.major),
        replaced,
      },
    });
  }

  const sources = await meService.findMajorSources(req.body);
  const parsedSources = await meService.parseSources(sources);
  const majorData = await meService.extractMajorData(req.body, parsedSources);

  const major = await meService.saveMajorData(
    university.id,
    majorData.major?.name ?? req.body.major,
    majorData,
    parsedSources,
  );
  const replaced = await meService.saveSelection(
    authUser.id,
    university.id,
    major.id,
  );
  const updated = await meService.getUniversityById(university.id, major.name);

  res.send({ data: { ...meService.toUniversityData(updated, major), replaced } });
};

export const uploadSources = async (
  req: Request,
  res: Response<UniversityOutput>,
) => {
  const authUser = res.locals.user;
  if (!authUser) throw new AppErr("Missing or malformed access token", 401);

  const files: UploadSourcesInput = res.locals.files;
  const { university, major } = await meService.getSelection(authUser.id);

  const majorData = await meService.extractMajorDataFromFiles(
    { name: university.name, major: major.name },
    files,
  );
  if (!majorData.major)
    throw new AppErr(
      `Could not find ${major.name} in the uploaded files`,
      422,
    );

  const saved = await meService.saveMajorData(
    university.id,
    major.name,
    majorData,
    meService.toUploadedSources(authUser.id, files),
  );
  const updated = await meService.getUniversityById(university.id, saved.name);

  res.send({ data: meService.toUniversityData(updated, saved) });
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
  const { id, university, major } = await meService.getSelection(authUser.id);

  const transcript = await meService.extractTranscriptFromFiles(
    { name: university.name, major: major.name },
    files,
  );
  const records = await meService.matchRecords(major, transcript.records);
  const stored = await meService.uploadDocuments(id, files);
  const data = await meService.saveDocuments(id, req.body.type, stored, records);

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

export const getDocuments = async (
  req: Request,
  res: Response<StudentDocumentsOutput>,
) => {
  const authUser = res.locals.user;
  if (!authUser) throw new AppErr("Missing or malformed access token", 401);

  const data = await meService.getDocuments(authUser.id);

  res.send({ data });
};

export const getUniversitySources = async (
  req: Request,
  res: Response<UniversitySourcesOutput>,
) => {
  const authUser = res.locals.user;
  if (!authUser) throw new AppErr("Missing or malformed access token", 401);

  const data = await meService.getUniversitySources(authUser.id);

  res.send({ data });
};
