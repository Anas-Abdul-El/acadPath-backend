import { AcademicRecordStatus, PlannedCourseStatus } from "../../generated/prisma/client.js";
import type * as appRepo from "../../repositories/app.repo.js";
import type { StudentStatusDto, TermDto } from "../../types/app.dto.js";
import { termKey } from "./terms.js";

export type AcademicRecord = Awaited<
  ReturnType<typeof appRepo.listAcademicRecords>
>[number];

export type LatestStudyPlan = Awaited<ReturnType<typeof appRepo.getLatestStudyPlan>>;

export const buildStudentProgress = (
  records: AcademicRecord[],
  plan: LatestStudyPlan,
) => {
  const recordsByCourse = new Map<string, AcademicRecord[]>();
  for (const record of [...records].sort((a, b) => termKey(b) - termKey(a))) {
    const courseRecords = recordsByCourse.get(record.course.id) ?? [];
    courseRecords.push(record);
    recordsByCourse.set(record.course.id, courseRecords);
  }

  const plannedTerms = new Map<string, TermDto>();
  const semesters = [...(plan?.semesters ?? [])].sort(
    (a, b) => termKey(a) - termKey(b),
  );
  for (const semester of semesters) {
    for (const planned of semester.courses) {
      if (planned.status !== PlannedCourseStatus.PLANNED) continue;
      if (plannedTerms.has(planned.course.id)) continue;
      plannedTerms.set(planned.course.id, {
        term: semester.term,
        year: semester.year,
      });
    }
  }

  const findRecord = (courseId: string, status: AcademicRecordStatus) =>
    recordsByCourse.get(courseId)?.find((r) => r.status === status);

  const getStudentStatus = (courseId: string): StudentStatusDto => {
    for (const status of [
      AcademicRecordStatus.COMPLETED,
      AcademicRecordStatus.IN_PROGRESS,
      AcademicRecordStatus.FAILED,
    ]) {
      const record = findRecord(courseId, status);
      if (record) {
        return {
          status,
          statusDetail: {
            grade: record.grade,
            term: record.term,
            year: record.year,
          },
        };
      }
    }

    const planned = plannedTerms.get(courseId);
    if (planned) {
      return { status: "PLANNED", statusDetail: { grade: null, ...planned } };
    }

    return {
      status: "NOT_TAKEN",
      statusDetail: { grade: null, term: null, year: null },
    };
  };

  const isCompleted = (courseId: string) =>
    !!findRecord(courseId, AcademicRecordStatus.COMPLETED);

  const isInProgress = (courseId: string) =>
    !!findRecord(courseId, AcademicRecordStatus.IN_PROGRESS);

  return { getStudentStatus, isCompleted, isInProgress };
};
