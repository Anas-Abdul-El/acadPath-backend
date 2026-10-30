import type { Request, Response } from "express";
import AppErr from "../libs/appErr.js";
import * as meService from "../services/me.service.js";
import type {
  SelectUniversityBody,
  UploadSourcesInput,
} from "../schemas/me.schema.js";
import type { MeOutput, UniversityOutput } from "../types/me.dto.js";

export const getMe = async (req: Request, res: Response<MeOutput>) => {
  const authUser = res.locals.user;
  if (!authUser) throw new AppErr("Missing or malformed access token", 401);

  const data = await meService.getMe(authUser.id);

  res.send({ data });
};

export const selectUniversity = async (
  req: Request<unknown, unknown, SelectUniversityBody>,
  res: Response<UniversityOutput>,
) => {
  const found = await meService.findUniversity(req.body);
  const university =
    found.university ?? (await meService.createUniversity(req.body));

  if (found.major) {
    return res.send({
      data: meService.toUniversityData(university, found.major),
    });
  }

  const sources = await meService.findMajorSources(req.body);
  const parsedSources = await meService.parseSources(sources);
  const majorData = await meService.extractMajorData(req.body, parsedSources);

  const major = await meService.saveMajorData(
    university.id,
    majorData,
    parsedSources,
  );
  const updated = await meService.getUniversityById(
    university.id,
    major?.name ?? req.body.major,
  );

  res.send({ data: meService.toUniversityData(updated, major) });
};

export const uploadSources = async (
  req: Request<unknown, unknown, SelectUniversityBody>,
  res: Response<UniversityOutput>,
) => {
  const files: UploadSourcesInput = res.locals.files;

  const found = await meService.findUniversity(req.body);
  const university =
    found.university ?? (await meService.createUniversity(req.body));

  const majorData = await meService.extractMajorDataFromFiles(req.body, files);
  if (!majorData.major)
    throw new AppErr(
      `Could not find ${req.body.major} in the uploaded files`,
      422,
    );

  const major = await meService.saveMajorData(
    university.id,
    majorData,
    meService.toUploadedSources(files),
  );
  const updated = await meService.getUniversityById(
    university.id,
    major?.name ?? req.body.major,
  );

  res.send({ data: meService.toUniversityData(updated, major) });
};
