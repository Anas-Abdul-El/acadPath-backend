import {
  AcademicRecordStatus,
  PlannedCourseStatus,
} from "../../../generated/prisma/client.js";
import * as appRepo from "../../../repositories/app.repo.js";
import type { CourseDto, StudyPlanDto } from "../../../types/app.dto.js";
import { splitRequisites, sumCredits, termKey } from "../../shared/index.js";

type PlanCourse = NonNullable<
  Awaited<ReturnType<typeof appRepo.getStudyPlan>>
>["semesters"][number]["courses"][number]["course"];

const toCourseDto = ({ requisites, ...course }: PlanCourse): CourseDto => ({
  ...course,
  ...splitRequisites(requisites),
});

export const getStudyPlan = async (
  userId: string,
): Promise<StudyPlanDto | null> => {
  const [plan, records] = await Promise.all([
    appRepo.getStudyPlan(userId),
    appRepo.listAcademicRecords(userId),
  ]);
  if (!plan) return null;

  const semesters = [...plan.semesters]
    .sort((a, b) => termKey(a) - termKey(b))
    .map((semester) => ({
      id: semester.id,
      term: semester.term,
      year: semester.year,
      rationale: semester.rationale,
      credits: sumCredits(
        semester.courses.filter(
          (c) => c.status !== PlannedCourseStatus.SKIPPED,
        ),
      ),
      courses: semester.courses.map((c) => ({
        id: c.id,
        status: c.status,
        course: toCourseDto(c.course),
      })),
    }));

  const plannedCredits = sumCredits(
    plan.semesters
      .flatMap((semester) => semester.courses)
      .filter((c) => c.status === PlannedCourseStatus.PLANNED),
  );
  const takenCredits = sumCredits(
    records.filter(
      (r) =>
        r.status === AcademicRecordStatus.COMPLETED ||
        r.status === AcademicRecordStatus.IN_PROGRESS,
    ),
  );
  const required = plan.student.major?.totalRequiredCredits ?? null;
  const last = semesters.at(-1);

  return {
    id: plan.id,
    name: plan.name,
    generatedAt: plan.createdAt,
    assumptions: plan.assumptions,
    notes: plan.notes,
    semesters,
    totals: {
      plannedCredits,
      creditsRequired: required,
      meetsDegreeTotal:
        required !== null ? takenCredits + plannedCredits >= required : null,
    },
    expectedGraduation: last ? { term: last.term, year: last.year } : null,
  };
};
