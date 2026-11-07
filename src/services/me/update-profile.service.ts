import * as meRepo from "../../repositories/me.repo.js";
import type { UpdateProfileBody } from "../../schemas/me.schema.js";
import type { MeData } from "../../types/me.dto.js";
import { getMeData } from "./get-me.service.js";

export const updateProfile = async (
  userId: string,
  data: UpdateProfileBody,
): Promise<MeData> => {
  await meRepo.updateProfile(userId, data);
  return getMeData(userId);
};
