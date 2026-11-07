import { ZodError } from "zod";
import { CourseRelationType } from "../../generated/prisma/client.js";
import AppErr from "../../libs/appErr.js";
import type * as adminRepo from "../../repositories/admin.repo.js";
import type { AdminCourseDto } from "../../types/admin.dto.js";
import { normalizeCode, splitRequisites } from "../shared/index.js";

type AdminCourse = Awaited<ReturnType<typeof adminRepo.getAdminCourse>>;

export const toAdminCourseDto = ({
  requisites,
  major: { university, ...major },
  updatedAt,
  ...course
}: AdminCourse): AdminCourseDto => ({
  ...course,
  ...splitRequisites(requisites),
  university,
  major,
  updatedAt: updatedAt.toISOString(),
});

export const duplicateCodeError = (code: string) =>
  new AppErr(`${code} already exists in this major`, 409);

export const hasCode = (courses: { code: string }[], code: string) =>
  courses.some((c) => normalizeCode(c.code) === normalizeCode(code));

/**
 * Turns prerequisite and corequisite codes into course ids within the major.
 * Throws a 400 with details on the field for a course that requires itself or
 * a code that isn't in the major.
 */
export const resolveRequisites = (
  majorCourses: { id: string; code: string }[],
  code: string,
  lists: { prerequisites: string[]; corequisites: string[] },
): adminRepo.CourseRequisite[] => {
  const idByCode = new Map(
    majorCourses.map((c) => [normalizeCode(c.code), c.id]),
  );
  const issues: { path: string[]; message: string }[] = [];
  const requisites: adminRepo.CourseRequisite[] = [];

  for (const [field, relationType] of [
    ["prerequisites", CourseRelationType.PREREQUISITE],
    ["corequisites", CourseRelationType.COREQUISITE],
  ] as const) {
    const codes = lists[field];
    const unknown = codes.filter(
      (c) =>
        normalizeCode(c) !== normalizeCode(code) &&
        !idByCode.has(normalizeCode(c)),
    );
    if (codes.some((c) => normalizeCode(c) === normalizeCode(code)))
      issues.push({ path: [field], message: "A course can't require itself" });
    else if (unknown.length)
      issues.push({
        path: [field],
        message: `${unknown.join(", ")} ${unknown.length === 1 ? "isn't" : "aren't"} in this major's courses`,
      });
    else
      for (const c of codes)
        requisites.push({
          requiredCourseId: idByCode.get(normalizeCode(c)) as string,
          relationType,
        });
  }

  if (issues.length)
    throw new AppErr(
      new ZodError(
        issues.map((issue) => ({ ...issue, code: "custom", input: undefined })),
      ),
    );
  return requisites;
};
