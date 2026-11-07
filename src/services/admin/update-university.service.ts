import AppErr from "../../libs/appErr.js";
import * as adminRepo from "../../repositories/admin.repo.js";
import type { AdminUniversityUpdateBody } from "../../schemas/admin.schema.js";
import type { AdminUniversityDto } from "../../types/admin.dto.js";
import { toAdminUniversityDto } from "./universities.js";

/** Updates a university for PATCH /admin/universities/:universityId; names stay unique per country, ignoring case. */
export const updateUniversity = async (
  universityId: string,
  body: AdminUniversityUpdateBody,
): Promise<AdminUniversityDto> => {
  const current = await adminRepo.findUniversityById(universityId);
  if (!current) throw new AppErr("University not found", 404);

  if (body.name || body.country) {
    const duplicate = await adminRepo.findUniversityByNameAndCountry(
      body.name ?? current.name,
      body.country ?? current.country,
      universityId,
    );
    if (duplicate)
      throw new AppErr(
        "A university with this name already exists in this country",
        409,
      );
  }

  await adminRepo.updateUniversity(universityId, body);
  const [university, courseCounts] = await Promise.all([
    adminRepo.getAdminUniversity(universityId),
    adminRepo.countCoursesByUniversity([universityId]),
  ]);
  return toAdminUniversityDto(university, courseCounts.get(universityId) ?? 0);
};
