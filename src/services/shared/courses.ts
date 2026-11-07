import { CourseRelationType } from "../../generated/prisma/client.js";
import type * as appRepo from "../../repositories/app.repo.js";

export type MajorCourse = Awaited<
  ReturnType<typeof appRepo.listMajorCoursesWithRequisites>
>[number];

export const normalizeCode = (code: string) => code.toUpperCase().replace(/\s+/g, "");

export const sumCredits = (items: { course: { credits: number } }[]) =>
  items.reduce((sum, item) => sum + item.course.credits, 0);

export const requisitesOf = (course: MajorCourse, type: CourseRelationType) => {
  const corequisiteIds = new Set(
    course.requisites
      .filter((r) => r.relationType === CourseRelationType.COREQUISITE)
      .map((r) => r.requiredCourse.id),
  );
  return course.requisites
    .filter((r) => r.relationType === type)
    .filter(
      (r) =>
        type === CourseRelationType.COREQUISITE ||
        !corequisiteIds.has(r.requiredCourse.id),
    )
    .map((r) => r.requiredCourse);
};

export const requisiteIds = (course: MajorCourse, type: CourseRelationType) =>
  requisitesOf(course, type).map((r) => r.id);

export const requisiteCodes = (course: MajorCourse, type: CourseRelationType) =>
  requisitesOf(course, type).map((r) => r.code);

export const splitRequisites = <T>(
  requisites: { relationType: CourseRelationType; requiredCourse: T }[],
) => ({
  prerequisites: requisites
    .filter((r) => r.relationType === CourseRelationType.PREREQUISITE)
    .map((r) => r.requiredCourse),
  corequisites: requisites
    .filter((r) => r.relationType === CourseRelationType.COREQUISITE)
    .map((r) => r.requiredCourse),
});
