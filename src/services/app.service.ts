import {
  AcademicRecordStatus,
  CourseCategory,
  type LetterGrade,
  PlannedCourseStatus,
  type Term,
} from "../generated/prisma/client.js";
import AppErr from "../libs/appErr.js";
import * as appRepo from "../repositories/app.repo.js";
import type { AcademicRecordsQuery } from "../schemas/app.schema.js";
import type {
  AcademicRecordDto,
  AcademicSummaryDto,
  TermDto,
} from "../types/app.dto.js";

type AcademicRecord = Awaited<
  ReturnType<typeof appRepo.listAcademicRecords>
>[number];

const gradePoints: Record<LetterGrade, number> = {
  A: 4.0,
  A_MINUS: 3.7,
  B_PLUS: 3.3,
  B: 3.0,
  B_MINUS: 2.7,
  C_PLUS: 2.3,
  C: 2.0,
  C_MINUS: 1.7,
  D_PLUS: 1.3,
  D: 1.0,
  F: 0.0,
};

const termOrder: Record<Term, number> = { SPRING: 0, SUMMER: 1, FALL: 2 };

const termKey = ({ term, year }: TermDto) => year * 3 + termOrder[term];

const round2 = (value: number) => Math.round(value * 100) / 100;

const sumCredits = (items: { course: { credits: number } }[]) =>
  items.reduce((sum, item) => sum + item.course.credits, 0);

const calculateGpa = (records: AcademicRecord[]) => {
  let points = 0;
  let credits = 0;
  for (const record of records) {
    if (!record.grade) continue;
    points += gradePoints[record.grade] * record.course.credits;
    credits += record.course.credits;
  }
  return credits ? round2(points / credits) : null;
};

const groupByTerm = (records: AcademicRecord[]) => {
  const groups = new Map<number, TermDto & { records: AcademicRecord[] }>();
  for (const record of records) {
    const key = termKey(record);
    const group = groups.get(key) ?? {
      term: record.term,
      year: record.year,
      records: [],
    };
    group.records.push(record);
    groups.set(key, group);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, group]) => group);
};

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

export const listAcademicRecords = async (
  userId: string,
  filters: AcademicRecordsQuery,
): Promise<AcademicRecordDto[]> => {
  const records = await appRepo.listAcademicRecords(userId, filters);
  return records.sort((a, b) => termKey(a) - termKey(b));
};
