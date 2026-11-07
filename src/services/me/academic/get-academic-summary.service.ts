import {
  AcademicRecordStatus,
  CourseCategory,
  PlannedCourseStatus,
} from "../../../generated/prisma/client.js";
import AppErr from "../../../libs/appErr.js";
import * as appRepo from "../../../repositories/app.repo.js";
import type { AcademicSummaryDto } from "../../../types/app.dto.js";
import {
  sumCredits,
  round2,
  weightedGpa,
  type AcademicRecord,
  groupByTerm,
  termKey,
} from "../../shared/index.js";

const calculateGpa = (records: AcademicRecord[]) =>
  weightedGpa(
    records.map((record) => ({
      grade: record.grade,
      credits: record.course.credits,
    })),
  );

export const getAcademicSummary = async (
  userId: string,
): Promise<AcademicSummaryDto> => {
  const [profile, records, plan] = await Promise.all([
    appRepo.getSummaryProfile(userId),
    appRepo.listAcademicRecords(userId),
    appRepo.getLatestStudyPlan(userId),
  ]);
  if (!profile) throw new AppErr("Select your university first", 422);

  const finished = records.filter(
    (r) => r.status !== AcademicRecordStatus.IN_PROGRESS,
  );
  const completed = records.filter(
    (r) => r.status === AcademicRecordStatus.COMPLETED,
  );
  const inProgress = records.filter(
    (r) => r.status === AcademicRecordStatus.IN_PROGRESS,
  );

  const finishedTerms = groupByTerm(finished);
  const cumulative = calculateGpa(finished);
  const gpaBeforeLastYear = calculateGpa(
    finishedTerms.slice(0, -2).flatMap((group) => group.records),
  );

  const completedCredits = sumCredits(completed);
  const required = profile.major?.totalRequiredCredits ?? null;

  const semesters = [...(plan?.semesters ?? [])].sort(
    (a, b) => termKey(a) - termKey(b),
  );
  const lastSemester = semesters.at(-1);
  const plannedCourses = semesters
    .flatMap((semester) => semester.courses)
    .filter((c) => c.status === PlannedCourseStatus.PLANNED);

  const currentTerm = groupByTerm(inProgress).at(-1);
  const lastTerm = finishedTerms.at(-1);

  return {
    student: {
      name: profile.user.name,
      university: profile.university,
      major: profile.major,
      yearOfStudy: profile.yearOfStudy,
    },
    gpa: {
      cumulative,
      changeSinceLastYear:
        cumulative !== null && gpaBeforeLastYear !== null
          ? round2(cumulative - gpaBeforeLastYear)
          : null,
    },
    credits: {
      completed: completedCredits,
      inProgress: sumCredits(inProgress),
      required,
      remaining:
        required !== null ? Math.max(required - completedCredits, 0) : null,
    },
    graduation: {
      progressPercent: required
        ? Math.min(Math.round((completedCredits / required) * 100), 100)
        : null,
      expected: lastSemester
        ? { term: lastSemester.term, year: lastSemester.year }
        : null,
    },
    currentTerm: currentTerm
      ? {
          term: currentTerm.term,
          year: currentTerm.year,
          credits: sumCredits(currentTerm.records),
          courses: currentTerm.records.map((r) => ({
            recordId: r.id,
            course: r.course,
            expectedGrade: r.expectedGrade,
          })),
        }
      : null,
    lastTerm: lastTerm
      ? {
          term: lastTerm.term,
          year: lastTerm.year,
          gpa: calculateGpa(lastTerm.records),
          courses: lastTerm.records.map((r) => ({
            course: r.course,
            status: r.status,
            grade: r.grade,
          })),
        }
      : null,
    termHistory: finishedTerms.map((group) => ({
      term: group.term,
      year: group.year,
      gpa: calculateGpa(group.records),
      credits: sumCredits(group.records),
    })),
    requirements: Object.values(CourseCategory).map((category) => {
      const inCategory = (c: { course: { category: CourseCategory } }) =>
        c.course.category === category;
      const categoryCompleted = sumCredits(completed.filter(inCategory));
      return {
        category,
        completedCredits: categoryCompleted,
        plannedCredits:
          categoryCompleted +
          sumCredits(inProgress.filter(inCategory)) +
          sumCredits(plannedCourses.filter(inCategory)),
      };
    }),
  };
};
