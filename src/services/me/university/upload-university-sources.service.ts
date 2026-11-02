import { SourceType } from "../../../generated/prisma/client.js";
import AppErr from "../../../libs/appErr.js";
import * as meRepo from "../../../repositories/me.repo.js";
import type { UploadSourcesInput } from "../../../schemas/me.schema.js";
import type { UniversityData } from "../../../types/me.dto.js";
import {
  extractMajorDataFromFiles,
  saveMajorData,
  type SavedSource,
} from "./catalog-extraction.js";
import { toUniversityData } from "./catalog-status.js";
import { getSelection } from "./student-selection.js";

const toUploadedSources = (
  userId: string,
  files: UploadSourcesInput,
): SavedSource[] => {
  return files.map((file) => ({
    title: file.originalname,
    url: `${userId}/${file.originalname}`,
    type: file.sourceType === SourceType.PDF ? "pdf" : "image",
    uploadedById: userId,
  }));
};

export const uploadSources = async (
  userId: string,
  files: UploadSourcesInput,
): Promise<UniversityData> => {
  const { university, major } = await getSelection(userId);

  const majorData = await extractMajorDataFromFiles(
    { name: university.name, major: major.name },
    files,
  );
  if (!majorData.major)
    throw new AppErr(
      `Could not find ${major.name} in the uploaded files`,
      422,
    );

  const saved = await saveMajorData(
    university.id,
    major.name,
    majorData,
    toUploadedSources(userId, files),
  );
  const updated = await meRepo.getUniversityById(university.id, saved.name);

  return toUniversityData(updated, saved);
};
