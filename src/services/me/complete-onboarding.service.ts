import AppErr from "../../libs/appErr.js";
import * as meRepo from "../../repositories/me.repo.js";
import type { MeData } from "../../types/me.dto.js";
import { getMeData } from "./get-me.service.js";

export const completeOnboarding = async (userId: string): Promise<MeData> => {
  const me = await getMeData(userId);
  const { profile, onboarding } = me;
  if (!profile || !onboarding) throw new AppErr("Only students onboard", 403);
  if (onboarding.completed) return me;

  if (!onboarding.universitySelected || !profile.major)
    throw new AppErr("Select your university and major first", 422);
  if (onboarding.catalogStatus !== "AVAILABLE")
    throw new AppErr("Your university's course catalog isn't ready yet", 422);
  if (!onboarding.yearOfStudySelected)
    throw new AppErr("Select your year of study first", 422);
  if (onboarding.transcriptRequired && !onboarding.transcriptUploaded)
    throw new AppErr("Upload your transcript first", 422);

  await meRepo.completeOnboarding(userId);
  return getMeData(userId);
};
