import { YearOfStudy } from "../../generated/prisma/enums.js";
import * as meRepo from "../../repositories/me.repo.js";
import type { YearOfStudyBody } from "../../schemas/me.schema.js";
import type { YearOfStudyOutput } from "../../types/me.dto.js";

/**
 * Saves the year of study for PUT /me/year-of-study. Changing it never removes
 * documents already uploaded; it only changes whether a transcript is required.
 */
export const updateYearOfStudy = async (
  userId: string,
  { yearOfStudy }: YearOfStudyBody,
): Promise<YearOfStudyOutput["data"]> => {
  await meRepo.updateProfile(userId, { yearOfStudy });
  return {
    yearOfStudy,
    transcriptRequired: yearOfStudy !== YearOfStudy.NEW_STUDENT,
  };
};
