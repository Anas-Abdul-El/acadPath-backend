import { UserRole, YearOfStudy } from "../../generated/prisma/client.js";
import AppErr from "../../libs/appErr.js";
import * as meRepo from "../../repositories/me.repo.js";
import type { MeData } from "../../types/me.dto.js";
import { getCatalogStatus } from "./university/index.js";

export const getMeData = async (userId: string): Promise<MeData> => {
  const userInfo = await meRepo.getUserWithProfile(userId);
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
      universityDocumentsUploaded:
        university?.sources.some((source) => source.uploadedById === user.id) ??
        false,
      yearOfStudySelected: yearOfStudy !== null,
      transcriptRequired: yearOfStudy !== YearOfStudy.NEW_STUDENT,
      transcriptUploaded: transcriptCount > 0,
      completed: onboardingCompletedAt !== null,
    },
  };
};
