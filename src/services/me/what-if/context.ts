import {
  AcademicRecordStatus,
  PlannedCourseStatus,
} from "../../../generated/prisma/client.js";
import AppErr from "../../../libs/appErr.js";
import * as appRepo from "../../../repositories/app.repo.js";
import type { SemesterLoadDto, TermDto } from "../../../types/app.dto.js";
import {
  buildStudentProgress,
  groupByTerm,
  nextSemester,
  normalizeCode,
  sumCredits,
  termKey,
  termLabel,
  type MajorCourse,
} from "../../shared/index.js";
import type { Plan } from "./scenarios.js";
import type { PendingCourse } from "./scheduler.js";

export const toLoad = (
  term: TermDto,
  list: MajorCourse[],
): SemesterLoadDto => ({
  label: termLabel(term),
  courses: list.map((course) => course.code),
  credits: list.reduce((sum, course) => sum + course.credits, 0),
});

export const loadWhatIfContext = async (userId: string) => {
  const profile = await appRepo.getStudentMajorId(userId);
  if (!profile?.majorId) throw new AppErr("Select your major first", 422);

  const [courses, records, plan] = await Promise.all([
    appRepo.listMajorCoursesWithRequisites(profile.majorId, {}),
    appRepo.listAcademicRecords(userId),
    appRepo.getStudyPlan(userId),
  ]);
  const planSemesters = [...(plan?.semesters ?? [])].sort(
    (a, b) => termKey(a) - termKey(b),
  );
  const firstSemester = planSemesters[0];
  if (!plan || !firstSemester)
    throw new AppErr("Generate a study plan first", 422);

  const { getStudentStatus } = buildStudentProgress(records, plan);
  const statusOf = (course: MajorCourse) => getStudentStatus(course.id);
  const courseById = new Map(courses.map((course) => [course.id, course]));
  const courseByCode = new Map(
    courses.map((course) => [normalizeCode(course.code), course]),
  );

  const termAt = (index: number) => {
    let term: TermDto = { term: firstSemester.term, year: firstSemester.year };
    for (let i = 0; i < index; i++) term = nextSemester(term);
    return term;
  };

  const indexOf = (target: TermDto) => {
    let index = 0;
    while (termKey(termAt(index)) < termKey(target) && index < 40) index++;
    return index;
  };

  const pending: PendingCourse[] = planSemesters.flatMap((semester) =>
    semester.courses.flatMap((planned) => {
      const course = courseById.get(planned.course.id);
      return planned.status === PlannedCourseStatus.PLANNED && course
        ? [{ course, earliest: indexOf(semester) }]
        : [];
    }),
  );
  const lastIndex = Math.max(0, ...pending.map((p) => p.earliest));
  const currentLoads = Array.from({ length: lastIndex + 1 }, (_, index) =>
    toLoad(
      termAt(index),
      pending.filter((p) => p.earliest === index).map((p) => p.course),
    ),
  );

  const inProgress = records.filter(
    (r) => r.status === AcademicRecordStatus.IN_PROGRESS,
  );
  const completed = records.filter(
    (r) => r.status === AcademicRecordStatus.COMPLETED,
  );
  const currentTerm = groupByTerm(inProgress).at(-1);

  const base: Plan = {
    pending,
    done: new Set([...completed, ...inProgress].map((r) => r.course.id)),
    entries: records.map((r) => {
      const current = r.status === AcademicRecordStatus.IN_PROGRESS;
      return {
        courseId: r.course.id,
        credits: r.course.credits,
        grade: current ? r.expectedGrade : r.grade,
        current,
      };
    }),
    currentTermCredits: sumCredits(inProgress),
  };

  const firstInProgress = inProgress[0]?.course.code;
  const lastPlanned = pending.at(-1)?.course.code;
  const firstNotTaken = courses.find(
    (course) => statusOf(course).status === "NOT_TAKEN",
  )?.code;

  const examples = [
    firstInProgress && `What if I fail ${firstInProgress} this semester?`,
    lastPlanned && `What if I take ${lastPlanned} earlier?`,
    firstNotTaken && `What if I add ${firstNotTaken} next semester?`,
  ].filter((example): example is string => !!example);

  return {
    courses,
    courseByCode,
    statusOf,
    termAt,
    indexOf,
    base,
    currentLoads,
    currentLabel: currentTerm ? termLabel(currentTerm) : null,
    completedCredits: sumCredits(completed),
    maxCredits: Math.max(16, ...currentLoads.map((load) => load.credits)),
    maxSemesters: currentLoads.length + 6,
    examples,
  };
};

export type WhatIfContext = Awaited<ReturnType<typeof loadWhatIfContext>>;
