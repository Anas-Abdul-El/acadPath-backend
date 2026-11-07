import AppErr from "../../libs/appErr.js";
import * as adminRepo from "../../repositories/admin.repo.js";
import type { AdminMajorBody } from "../../schemas/admin.schema.js";
import type { MajorDto } from "../../types/me.dto.js";

/** Creates a major for POST /admin/universities/:universityId/majors; names are unique per university, ignoring case. */
export const createMajor = async (
  universityId: string,
  body: AdminMajorBody,
): Promise<MajorDto> => {
  const university = await adminRepo.findUniversityById(universityId);
  if (!university) throw new AppErr("University not found", 404);

  if (await adminRepo.findMajorByName(universityId, body.name))
    throw new AppErr("This major already exists at this university", 409);

  return adminRepo.createMajor(universityId, body);
};
