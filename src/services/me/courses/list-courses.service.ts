import AppErr from "../../../libs/appErr.js";
import * as appRepo from "../../../repositories/app.repo.js";
import type { StudentCoursesQuery } from "../../../schemas/app.schema.js";
import type { StudentCourseDto } from "../../../types/app.dto.js";
import { splitRequisites, buildStudentProgress } from "../../shared/index.js";

export const listCourses = async (
  userId: string,
  filters: StudentCoursesQuery,
): Promise<StudentCourseDto[]> => {
  const profile = await appRepo.getStudentMajorId(userId);
  if (!profile?.majorId) throw new AppErr("Select your major first", 422);

  const [courses, records, plan] = await Promise.all([
    appRepo.listMajorCoursesWithRequisites(profile.majorId, filters),
    appRepo.listAcademicRecords(userId),
    appRepo.getLatestStudyPlan(userId),
  ]);
  const { getStudentStatus, isCompleted, isInProgress } = buildStudentProgress(
    records,
    plan,
  );

  const result: StudentCourseDto[] = courses.map(
    ({ requisites, ...course }) => {
      const { prerequisites, corequisites } = splitRequisites(requisites);
      return {
        ...course,
        prerequisites: prerequisites.map((required) => ({
          ...required,
          met: isCompleted(required.id),
        })),
        corequisites: corequisites.map((required) => ({
          ...required,
          met: isCompleted(required.id) || isInProgress(required.id),
        })),
        ...getStudentStatus(course.id),
      };
    },
  );

  return filters.status
    ? result.filter((course) => course.status === filters.status)
    : result;
};
