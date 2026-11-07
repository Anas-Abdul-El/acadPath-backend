import AppErr from "../../libs/appErr.js";
import * as adminRepo from "../../repositories/admin.repo.js";
import type { AdminUniversityDetailsDto } from "../../types/admin.dto.js";
import { getSourceStatus } from "../me/index.js";
import { toAdminUniversityDto } from "./universities.js";

/** Builds the university details sheet for GET /admin/universities/:universityId: majors by name, newest sources first. */
export const getUniversity = async (
  universityId: string,
): Promise<AdminUniversityDetailsDto> => {
  const university = await adminRepo.getAdminUniversityDetails(universityId);
  if (!university) throw new AppErr("University not found", 404);

  const { majors, sources, ...rest } = university;
  const courseCount = majors.reduce((sum, m) => sum + m._count.courses, 0);

  return {
    ...toAdminUniversityDto({ ...rest, sources }, courseCount),
    majors: majors.map(({ _count, ...major }) => ({
      ...major,
      courseCount: _count.courses,
      studentCount: _count.students,
    })),
    sources: sources.map((source) => ({
      id: source.id,
      title: source.title,
      url: source.url,
      sourceType: source.sourceType,
      status: getSourceStatus(source),
      errorMessage: source.errorMessage,
      lastProcessedAt: source.lastProcessedAt?.toISOString() ?? null,
      createdAt: source.createdAt.toISOString(),
    })),
  };
};
