import AppErr from "../../../libs/appErr.js";
import * as appRepo from "../../../repositories/app.repo.js";
import type { UpdatePlanCourseBody } from "../../../schemas/app.schema.js";
import type { StudyPlanCourseDto } from "../../../types/app.dto.js";
import { toCourseDto } from "./get-study-plan.service.js";

/** Skips or restores a planned course for PATCH /me/study-plan/courses/:planCourseId; it must be in one of the caller's plans. */
export const updatePlanCourse = async (
  userId: string,
  planCourseId: string,
  { status }: UpdatePlanCourseBody,
): Promise<StudyPlanCourseDto> => {
  const planCourse = await appRepo.findStudentPlanCourse(userId, planCourseId);
  if (!planCourse) throw new AppErr("Planned course not found", 404);

  const { course, ...updated } = await appRepo.updatePlanCourseStatus(
    planCourseId,
    status,
  );
  return { ...updated, course: toCourseDto(course) };
};
