import AppErr from "../../../libs/appErr.js";
import * as meRepo from "../../../repositories/me.repo.js";
import type { UniversitySourceDto } from "../../../types/me.dto.js";
import { getSourceStatus } from "./catalog-status.js";

export const getStudentUniversitySources = async (
  userId: string,
): Promise<UniversitySourceDto[]> => {
  const profile = await meRepo.getStudentUniversitySources(userId);
  if (!profile?.university)
    throw new AppErr("Select your university first", 422);

  return profile.university.sources.map((source) => ({
    id: source.id,
    title: source.title,
    sourceType: source.sourceType,
    status: getSourceStatus(source),
    errorMessage: source.errorMessage,
    createdAt: source.createdAt.toISOString(),
  }));
};
