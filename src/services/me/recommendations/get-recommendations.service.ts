import {
  AcademicRecordStatus,
  type LetterGrade,
} from "../../../generated/prisma/client.js";
import * as appRepo from "../../../repositories/app.repo.js";
import type {
  DifficultFocusDto,
  FailedFocusDto,
  LearningResourceDto,
  RecommendationsDto,
} from "../../../types/app.dto.js";
import {
  gradeLabel,
  gradePoints,
  termKey,
  termLabel,
} from "../../shared/index.js";

type FocusCourse = Awaited<ReturnType<typeof appRepo.listFocusCourses>>[number];

// Grades at or below C+ count as weak.
const weakGradePoints = gradePoints.C_PLUS;

// How many unlocked courses to name in "Required for ..." before "and N more".
const maxUnlocksShown = 3;

const isWeak = (grade: LetterGrade | null): grade is LetterGrade =>
  grade !== null && gradePoints[grade] <= weakGradePoints;

const codes = (courses: { code: string }[]) =>
  courses.map((course) => course.code).join(", ");

/**
 * Builds the student's focus list for GET /me/recommendations.
 *
 * - failed: courses whose latest attempt was a fail and that haven't been passed
 *   since, with the term of the retake if one exists.
 * - difficult: in-progress courses with a weak expected grade, worst first.
 *
 * Each item carries a short `why` built from the student's grades and the
 * course's prerequisites, plus the learning resources linked to the course.
 */
export const getRecommendations = async (
  userId: string,
): Promise<RecommendationsDto> => {
  const records = (await appRepo.listAcademicRecords(userId)).sort(
    (a, b) => termKey(a) - termKey(b),
  );

  // Courses the student has passed at least once.
  const passed = new Set(
    records
      .filter((r) => r.status === AcademicRecordStatus.COMPLETED)
      .map((r) => r.course.id),
  );

  // Most recent grade per course, used to spot weak prerequisites.
  const latestGrade = new Map<string, LetterGrade>();
  for (const record of records) {
    if (record.grade) latestGrade.set(record.course.id, record.grade);
  }

  // Keep only the latest failed attempt per course, then drop courses passed later.
  const latestFailed = new Map<string, (typeof records)[number]>();
  for (const record of records) {
    if (record.status === AcademicRecordStatus.FAILED)
      latestFailed.set(record.course.id, record);
  }
  const failedRecords = [...latestFailed.values()].filter(
    (r) => !passed.has(r.course.id),
  );

  // Retakes of failed courses are already listed under failed, so skip them here.
  const difficultRecords = records
    .filter(
      (r) =>
        r.status === AcademicRecordStatus.IN_PROGRESS &&
        isWeak(r.expectedGrade) &&
        !latestFailed.has(r.course.id),
    )
    .sort(
      (a, b) =>
        gradePoints[a.expectedGrade as LetterGrade] -
        gradePoints[b.expectedGrade as LetterGrade],
    );

  const courseIds = [
    ...failedRecords.map((r) => r.course.id),
    ...difficultRecords.map((r) => r.course.id),
  ];
  if (!courseIds.length) return { failed: [], difficult: [] };

  // Fetch prerequisite info and resources only for the courses being recommended.

  const [courses, resources] = await Promise.all([
    appRepo.listFocusCourses(courseIds),
    appRepo.listCourseResources(courseIds),
  ]);
  const courseById = new Map(courses.map((course) => [course.id, course]));

  const resourcesFor = (courseId: string): LearningResourceDto[] =>
    resources.filter((resource) =>
      resource.courses.some((course) => course.id === courseId),
    );

  // "Required for ..." when other courses list this one as a prerequisite.
  const unlocksNote = (course: FocusCourse | undefined) => {
    const unlocks = course?.requiredFor.map((r) => r.course) ?? [];
    if (!unlocks.length) return null;

    const shown = codes(unlocks.slice(0, maxUnlocksShown));
    const more = unlocks.length - maxUnlocksShown;
    return more > 0
      ? `Required for ${shown} and ${more} more.`
      : `Required for ${shown}.`;
  };

  // "Builds on ..." for prerequisites the student got a weak grade in.
  const weakPrereqsNote = (course: FocusCourse | undefined) => {
    const weak = (course?.requisites ?? []).flatMap(({ requiredCourse }) => {
      const grade = latestGrade.get(requiredCourse.id) ?? null;
      return isWeak(grade)
        ? [`${requiredCourse.code} (${gradeLabel(grade)})`]
        : [];
    });
    return weak.length ? `Builds on ${weak.join(", ")}.` : null;
  };

  const failed: FailedFocusDto[] = failedRecords.map((record) => {
    const course = courseById.get(record.course.id);
    // The first attempt after the failed one counts as the retake.
    const retake = records.find(
      (r) => r.course.id === record.course.id && termKey(r) > termKey(record),
    );
    const retakenIn = retake ? { term: retake.term, year: retake.year } : null;

    const why = [
      `Failed in ${termLabel(record)}${record.grade ? ` with ${gradeLabel(record.grade)}` : ""}.`,
      retakenIn ? `Retaking in ${termLabel(retakenIn)}.` : "Not retaken yet.",
      unlocksNote(course),
    ]
      .filter(Boolean)
      .join(" ");

    return {
      course: record.course,
      why,
      attempt: {
        term: record.term,
        year: record.year,
        grade: record.grade,
        retakenIn,
      },
      resources: resourcesFor(record.course.id),
    };
  });

  const difficult: DifficultFocusDto[] = difficultRecords.map((record) => {
    const course = courseById.get(record.course.id);
    const expectedGrade = record.expectedGrade as LetterGrade;

    const why = [
      `Expected grade is ${gradeLabel(expectedGrade)}.`,
      weakPrereqsNote(course),
      unlocksNote(course),
    ]
      .filter(Boolean)
      .join(" ");

    return {
      course: record.course,
      why,
      expectedGrade,
      resources: resourcesFor(record.course.id),
    };
  });

  return { failed, difficult };
};
