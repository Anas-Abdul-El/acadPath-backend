import {
  AcademicRecordStatus,
  StudentDocumentType,
} from "../../generated/prisma/client.js";
import * as adminRepo from "../../repositories/admin.repo.js";
import type { AdminStudentDto, StudentStage } from "../../types/admin.dto.js";
import { termKey, weightedGpa } from "../shared/index.js";

type AdminStudent = NonNullable<
  Awaited<ReturnType<typeof adminRepo.getAdminStudent>>
>;
type Profile = NonNullable<AdminStudent["studentProfile"]>;
type Academic = NonNullable<AdminStudentDto["academic"]>;

const stageOf = (profile: Profile | null): StudentStage =>
  profile?._count.academicRecords
    ? "PROCESSED"
    : profile?._count.documents
      ? "UPLOADED"
      : "NONE";

/**
 * Computes the academic summary for the given profiles: GPA over finished
 * records, completed credits, and the last term of the newest study plan.
 */
export const loadAcademics = async (
  profiles: Profile[],
): Promise<Map<string, Academic>> => {
  const ids = profiles.map((p) => p.id);
  if (!ids.length) return new Map();

  const [records, plans] = await Promise.all([
    adminRepo.listStudentRecordSummaries(ids),
    adminRepo.listStudentPlanTerms(ids),
  ]);

  return new Map(
    profiles.map((profile) => {
      const own = records.filter((r) => r.studentId === profile.id);
      const semesters =
        plans.find((p) => p.studentId === profile.id)?.semesters ?? [];
      const last = semesters.reduce<(typeof semesters)[number] | null>(
        (latest, s) => (!latest || termKey(s) > termKey(latest) ? s : latest),
        null,
      );

      return [
        profile.id,
        {
          gpa: weightedGpa(
            own
              .filter((r) => r.status !== AcademicRecordStatus.IN_PROGRESS)
              .map((r) => ({ grade: r.grade, credits: r.course.credits })),
          ),
          creditsCompleted: own
            .filter((r) => r.status === AcademicRecordStatus.COMPLETED)
            .reduce((sum, r) => sum + r.course.credits, 0),
          creditsRequired: profile.major?.totalRequiredCredits ?? null,
          expectedGraduation: last ? { term: last.term, year: last.year } : null,
        },
      ];
    }),
  );
};

export const toAdminStudentDto = (
  { id, name, email, createdAt, sessions, studentProfile: profile }: AdminStudent,
  academics: Map<string, Academic>,
): AdminStudentDto => {
  const stage = stageOf(profile);
  const major = profile?.major;
  return {
    id,
    name,
    email,
    university: profile?.university ?? null,
    major: major
      ? { id: major.id, name: major.name, degreeType: major.degreeType }
      : null,
    yearOfStudy: profile?.yearOfStudy ?? null,
    registeredAt: createdAt.toISOString(),
    lastActiveAt: sessions[0]?.lastUsedAt.toISOString() ?? null,
    stage,
    academic:
      stage === "PROCESSED" && profile
        ? (academics.get(profile.id) ?? null)
        : null,
    documents: {
      transcripts:
        profile?.documents.filter(
          (d) => d.type === StudentDocumentType.TRANSCRIPT,
        ).length ?? 0,
    },
  };
};
