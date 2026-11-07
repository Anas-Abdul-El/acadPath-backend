import * as adminRepo from "../../repositories/admin.repo.js";
import type { AdminUniversitiesQuery } from "../../schemas/admin.schema.js";
import type { AdminUniversitiesOutput } from "../../types/admin.dto.js";
import { getCatalogStatus } from "../me/index.js";
import { toAdminUniversityDto } from "./universities.js";

/**
 * Lists universities for GET /admin/universities, by name. q matches name,
 * shortName, city or country. The catalog status isn't stored, so the filter
 * and the page are applied after loading the matching universities.
 */
export const listUniversities = async ({
  page,
  pageSize,
  q,
  country,
  catalogStatus,
}: AdminUniversitiesQuery): Promise<AdminUniversitiesOutput> => {
  const contains = (value: string) => ({
    contains: value,
    mode: "insensitive" as const,
  });
  const universities = (
    await adminRepo.listAdminUniversities({
      ...(q && {
        OR: [
          { name: contains(q) },
          { shortName: contains(q) },
          { city: contains(q) },
          { country: contains(q) },
        ],
      }),
      ...(country && { country: { equals: country, mode: "insensitive" } }),
    })
  ).filter(
    (u) => !catalogStatus || getCatalogStatus(u.sources) === catalogStatus,
  );

  const pageItems = universities.slice((page - 1) * pageSize, page * pageSize);
  const courseCounts = await adminRepo.countCoursesByUniversity(
    pageItems.map((u) => u.id),
  );

  return {
    data: pageItems.map((u) =>
      toAdminUniversityDto(u, courseCounts.get(u.id) ?? 0),
    ),
    meta: { page, pageSize, total: universities.length },
  };
};
