import AppErr from "../../libs/appErr.js";
import * as adminRepo from "../../repositories/admin.repo.js";
import type { AdminUniversityBody } from "../../schemas/admin.schema.js";
import type { AdminUniversityDto } from "../../types/admin.dto.js";
import { toAdminUniversityDto } from "./universities.js";

/** Creates a university for POST /admin/universities; names are unique per country, ignoring case. */
export const createUniversity = async (
  body: AdminUniversityBody,
): Promise<AdminUniversityDto> => {
  const existing = await adminRepo.findUniversityByNameAndCountry(
    body.name,
    body.country,
  );
  if (existing)
    throw new AppErr(
      "A university with this name already exists in this country",
      409,
    );

  const { id } = await adminRepo.createUniversity(body);
  return toAdminUniversityDto(await adminRepo.getAdminUniversity(id), 0);
};
