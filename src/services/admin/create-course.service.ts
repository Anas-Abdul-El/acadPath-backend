import AppErr from "../../libs/appErr.js";
import * as adminRepo from "../../repositories/admin.repo.js";
import type { AdminCourseBody } from "../../schemas/admin.schema.js";
import type { AdminCourseDto } from "../../types/admin.dto.js";
import {
  duplicateCodeError,
  hasCode,
  resolveRequisites,
  toAdminCourseDto,
} from "./courses.js";

/** Creates a course for POST /admin/courses with source ADMIN, edited by the caller. */
export const createCourse = async (
  userId: string,
  { prerequisites, corequisites, ...fields }: AdminCourseBody,
): Promise<AdminCourseDto> => {
  const major = await adminRepo.findMajorById(fields.majorId);
  if (!major) throw new AppErr("Major not found", 404);

  const majorCourses = await adminRepo.listMajorCourseCodes(fields.majorId);
  if (hasCode(majorCourses, fields.code)) throw duplicateCodeError(fields.code);

  const requisites = resolveRequisites(majorCourses, fields.code, {
    prerequisites,
    corequisites,
  });
  const { id } = await adminRepo.createCourse(fields, userId, requisites);
  return toAdminCourseDto(await adminRepo.getAdminCourse(id));
};
