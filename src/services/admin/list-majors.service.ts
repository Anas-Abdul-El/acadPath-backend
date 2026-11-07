import AppErr from "../../libs/appErr.js";
import * as adminRepo from "../../repositories/admin.repo.js";
import type { AdminMajorDto } from "../../types/admin.dto.js";
import { toAdminMajorDto } from "./universities.js";

/** Lists a university's majors by name for GET /admin/universities/:universityId/majors. */
export const listMajors = async (
  universityId: string,
): Promise<AdminMajorDto[]> => {
  const university = await adminRepo.findUniversityById(universityId);
  if (!university) throw new AppErr("University not found", 404);

  const majors = await adminRepo.listUniversityMajors(universityId);
  return majors.map(toAdminMajorDto);
};
