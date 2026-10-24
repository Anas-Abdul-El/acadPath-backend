import {
  type ProcessingStatus,
  UserRole,
  YearOfStudy,
} from "../generated/prisma/client.js";
import AppErr from "../libs/appErr.js";
import * as meRepo from "../repositories/me.repo.js";
import type { CatalogStatus, MeData } from "../types/me.dto.js";

interface SourceState {
  errorMessage: string | null;
  lastProcessedAt: Date | null;
  lastFetchedAt: Date | null;
}

const getSourceStatus = (source: SourceState): ProcessingStatus => {
  if (source.errorMessage) return "FAILED";
  if (source.lastProcessedAt) return "COMPLETED";
  if (source.lastFetchedAt) return "PROCESSING";
  return "PENDING";
};

const getCatalogStatus = (sources: SourceState[]): CatalogStatus => {
  const statuses = sources.map(getSourceStatus);
  if (statuses.includes("COMPLETED")) return "AVAILABLE";
  if (statuses.includes("PENDING") || statuses.includes("PROCESSING"))
    return "PROCESSING";
  return "UNAVAILABLE";
};

export const getMe = async (userId: string): Promise<MeData> => {
  const userInfo = await meRepo.getUserInfo(userId);
  if (!userInfo) throw new AppErr("User not found", 401);

  const { studentProfile, ...user } = userInfo;
  if (user.role === UserRole.ADMIN)
    return { user, profile: null, onboarding: null };

  const university = studentProfile?.university ?? null;
  const yearOfStudy = studentProfile?.yearOfStudy ?? null;
  const onboardingCompletedAt = studentProfile?.onboardingCompletedAt ?? null;
  const transcriptCount = studentProfile?._count.documents ?? 0;

  let universityDto = null;
  if (university) {
    const { sources: _, ...rest } = university;
    universityDto = rest;
  }

  return {
    user,
    profile: {
      university: universityDto,
      major: studentProfile?.major ?? null,
      yearOfStudy,
      onboardingCompletedAt: onboardingCompletedAt?.toISOString() ?? null,
    },
    onboarding: {
      universitySelected: university !== null,
      catalogStatus: university ? getCatalogStatus(university.sources) : null,
      universityDocumentsUploaded: (university?.sources.length ?? 0) > 0,
      yearOfStudySelected: yearOfStudy !== null,
      transcriptRequired: yearOfStudy !== YearOfStudy.NEW_STUDENT,
      transcriptUploaded: transcriptCount > 0,
      completed: onboardingCompletedAt !== null,
    },
  };
};
