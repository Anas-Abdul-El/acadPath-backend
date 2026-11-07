import type * as adminRepo from "../../repositories/admin.repo.js";
import type { AdminUniversityDto } from "../../types/admin.dto.js";
import { getCatalogStatus } from "../me/index.js";

type AdminUniversity = Awaited<
  ReturnType<typeof adminRepo.listAdminUniversities>
>[number];

export const toAdminUniversityDto = (
  { sources, _count, createdAt, updatedAt, ...university }: AdminUniversity,
  courseCount: number,
): AdminUniversityDto => ({
  ...university,
  createdAt: createdAt.toISOString(),
  updatedAt: updatedAt.toISOString(),
  majorCount: _count.majors,
  courseCount,
  studentCount: _count.students,
  catalogStatus: getCatalogStatus(sources),
});
