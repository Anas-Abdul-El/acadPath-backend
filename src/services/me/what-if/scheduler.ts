import { CourseRelationType } from "../../../generated/prisma/client.js";
import type { TermDto } from "../../../types/app.dto.js";
import { requisiteIds, type MajorCourse } from "../../shared/index.js";

export type PendingCourse = {
  course: MajorCourse;
  earliest: number;
  priority?: boolean;
  fails?: boolean;
  after?: PendingCourse;
};

export const scheduleCourses = (
  pending: PendingCourse[],
  doneIds: Set<string>,
  termAt: (index: number) => TermDto,
  maxCredits: number,
  maxSemesters: number,
) => {
  const remaining = [...pending];
  const done = new Set(doneIds);
  const placedAt = new Map<PendingCourse, number>();
  const semesters: { term: TermDto; courses: MajorCourse[] }[] = [];

  for (let index = 0; index < maxSemesters && remaining.length > 0; index++) {
    const term = termAt(index);
    const eligible = remaining
      .filter(
        (p) =>
          p.earliest <= index &&
          (!p.after || (placedAt.get(p.after) ?? index) < index) &&
          (!p.course.offeredTerms.length ||
            p.course.offeredTerms.includes(term.term)) &&
          requisiteIds(p.course, CourseRelationType.PREREQUISITE).every((id) =>
            done.has(id),
          ),
      )
      .sort(
        (a, b) =>
          Number(!!b.priority) - Number(!!a.priority) ||
          a.earliest - b.earliest,
      );

    const chosen: PendingCourse[] = [];
    let credits = 0;
    for (const p of eligible) {
      if (credits + p.course.credits > maxCredits) continue;
      chosen.push(p);
      credits += p.course.credits;
    }
    for (const p of chosen) {
      remaining.splice(remaining.indexOf(p), 1);
      placedAt.set(p, index);
      if (!p.fails) done.add(p.course.id);
    }
    semesters.push({ term, courses: chosen.map((p) => p.course) });
  }

  while (semesters.at(-1)?.courses.length === 0) semesters.pop();
  return {
    semesters,
    placedAt,
    unscheduled: remaining.map((p) => p.course.code),
  };
};
