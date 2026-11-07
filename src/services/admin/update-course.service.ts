import { CourseRelationType } from "../../generated/prisma/client.js";
import AppErr from "../../libs/appErr.js";
import * as adminRepo from "../../repositories/admin.repo.js";
import type { AdminCourseUpdateBody } from "../../schemas/admin.schema.js";
import type { AdminCourseDto } from "../../types/admin.dto.js";
import {
  duplicateCodeError,
  hasCode,
  resolveRequisites,
  toAdminCourseDto,
} from "./courses.js";

/**
 * Updates a course for PATCH /admin/courses/:courseId and records the caller
 * as its editor. A sent requisite list replaces the old one. When the course
 * moves to another major, its requisites must exist there too, and links from
 * courses in the old major are removed.
 */
export const updateCourse = async (
  userId: string,
  courseId: string,
  { prerequisites, corequisites, ...fields }: AdminCourseUpdateBody,
): Promise<AdminCourseDto> => {
  const course = await adminRepo.findCourseById(courseId);
  if (!course) throw new AppErr("Course not found", 404);

  const majorId = fields.majorId ?? course.majorId;
  const moved = majorId !== course.majorId;
  if (moved && !(await adminRepo.findMajorById(majorId)))
    throw new AppErr("Major not found", 404);

  const code = fields.code ?? course.code;
  const replacesRequisites = moved || !!prerequisites || !!corequisites;
  let requisites: adminRepo.CourseRequisite[] | null = null;

  if (replacesRequisites || fields.code) {
    const majorCourses = (await adminRepo.listMajorCourseCodes(majorId)).filter(
      (c) => c.id !== courseId,
    );
    if ((moved || fields.code) && hasCode(majorCourses, code))
      throw duplicateCodeError(code);

    const currentCodes = (type: CourseRelationType) =>
      course.requisites
        .filter((r) => r.relationType === type)
        .map((r) => r.requiredCourse.code);
    if (replacesRequisites)
      requisites = resolveRequisites(majorCourses, code, {
        prerequisites:
          prerequisites ?? currentCodes(CourseRelationType.PREREQUISITE),
        corequisites:
          corequisites ?? currentCodes(CourseRelationType.COREQUISITE),
      });
  }

  await adminRepo.updateCourse(
    courseId,
    { ...fields, updatedById: userId },
    requisites,
    moved ? majorId : null,
  );
  return toAdminCourseDto(await adminRepo.getAdminCourse(courseId));
};
