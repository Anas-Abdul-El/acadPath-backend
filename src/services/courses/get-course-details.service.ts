import { UserRole } from "../../generated/prisma/client.js";
import AppErr from "../../libs/appErr.js";
import * as appRepo from "../../repositories/app.repo.js";
import type { CourseDetailsDto, StudentStatusDto } from "../../types/app.dto.js";
import { splitRequisites, buildStudentProgress } from "../shared/index.js";

export const getCourseDetails = async (
  courseId: string,
  userId: string,
  role: UserRole,
): Promise<CourseDetailsDto> => {
  const course = await appRepo.getCourseDetails(courseId);
  if (!course) throw new AppErr("Course not found", 404);

  let studentStatus: StudentStatusDto | null = null;
  if (role === UserRole.STUDENT) {
    const [records, plan] = await Promise.all([
      appRepo.listAcademicRecords(userId),
      appRepo.getLatestStudyPlan(userId),
    ]);
    studentStatus = buildStudentProgress(records, plan).getStudentStatus(
      course.id,
    );
  }

  const { requisites, requiredFor, ...rest } = course;
  return {
    ...rest,
    ...splitRequisites(requisites),
    requiredFor: requiredFor.map((r) => r.course),
    studentStatus,
  };
};
