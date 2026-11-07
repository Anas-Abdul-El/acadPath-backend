import type * as adminRepo from "../../repositories/admin.repo.js";
import type {
  AdminMajorDto,
  AdminUniversityDto,
} from "../../types/admin.dto.js";
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

type AdminMajor = Awaited<
  ReturnType<typeof adminRepo.listUniversityMajors>
>[number];

export const toAdminMajorDto = ({
  _count,
  ...major
}: AdminMajor): AdminMajorDto => ({
  ...major,
  courseCount: _count.courses,
  studentCount: _count.students,
});
