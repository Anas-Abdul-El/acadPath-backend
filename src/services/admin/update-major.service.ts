import AppErr from "../../libs/appErr.js";
import * as adminRepo from "../../repositories/admin.repo.js";
import type { AdminMajorUpdateBody } from "../../schemas/admin.schema.js";
import type { MajorDto } from "../../types/me.dto.js";

/** Updates a major for PATCH /admin/majors/:majorId; names stay unique per university, ignoring case. */
export const updateMajor = async (
  majorId: string,
  body: AdminMajorUpdateBody,
): Promise<MajorDto> => {
  const major = await adminRepo.findMajorById(majorId);
  if (!major) throw new AppErr("Major not found", 404);

  if (
    body.name &&
    (await adminRepo.findMajorByName(major.universityId, body.name, majorId))
  )
    throw new AppErr("This major already exists at this university", 409);

  return adminRepo.updateMajor(majorId, body);
};
