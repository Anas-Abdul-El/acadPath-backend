import AppErr from "../../../libs/appErr.js";
import * as meRepo from "../../../repositories/me.repo.js";

export const getSelection = async (userId: string) => {
  const profile = await meRepo.getSelection(userId);
  if (!profile?.university || !profile.major)
    throw new AppErr("Select your university first", 422);

  return {
    id: profile.id,
    university: profile.university,
    major: profile.major,
  };
};
