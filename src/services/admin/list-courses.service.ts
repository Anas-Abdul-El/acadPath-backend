import * as adminRepo from "../../repositories/admin.repo.js";
import type { AdminCoursesQuery } from "../../schemas/admin.schema.js";
import type { AdminCoursesOutput } from "../../types/admin.dto.js";
import { toAdminCourseDto } from "./courses.js";

/** Lists courses for GET /admin/courses by code; q matches code or name. */
export const listCourses = async ({
  page,
  pageSize,
  q,
  universityId,
  majorId,
  category,
  source,
}: AdminCoursesQuery): Promise<AdminCoursesOutput> => {
  const [courses, total] = await adminRepo.listAdminCourses(
    {
      ...(q && {
        OR: [
          { code: { contains: q, mode: "insensitive" } },
          { name: { contains: q, mode: "insensitive" } },
        ],
      }),
      ...(universityId && { major: { universityId } }),
      ...(majorId && { majorId }),
      ...(category && { category }),
      ...(source && { source }),
    },
    (page - 1) * pageSize,
    pageSize,
  );

  return {
    data: courses.map(toAdminCourseDto),
    meta: { page, pageSize, total },
  };
};
