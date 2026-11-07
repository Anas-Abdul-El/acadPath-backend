import type { Prisma } from "../../generated/prisma/client.js";
import * as adminRepo from "../../repositories/admin.repo.js";
import type { AdminStudentsQuery } from "../../schemas/admin.schema.js";
import type {
  AdminStudentsOutput,
  StudentStage,
} from "../../types/admin.dto.js";
import { loadAcademics, toAdminStudentDto } from "./students.js";

const stageWhere: Record<StudentStage, Prisma.UserWhereInput> = {
  PROCESSED: { studentProfile: { academicRecords: { some: {} } } },
  UPLOADED: {
    studentProfile: {
      academicRecords: { none: {} },
      documents: { some: {} },
    },
  },
  NONE: {
    OR: [
      { studentProfile: null },
      {
        studentProfile: {
          academicRecords: { none: {} },
          documents: { none: {} },
        },
      },
    ],
  },
};

/**
 * Lists students for GET /admin/students, newest registrations first. q
 * matches name or email. The stage is PROCESSED with academic records,
 * UPLOADED with documents only, and NONE otherwise.
 */
export const listStudents = async ({
  page,
  pageSize,
  q,
  universityId,
  stage,
}: AdminStudentsQuery): Promise<AdminStudentsOutput> => {
  const [students, total] = await adminRepo.listAdminStudents(
    {
      AND: [
        q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
              ],
            }
          : {},
        universityId ? { studentProfile: { universityId } } : {},
        stage ? stageWhere[stage] : {},
      ],
    },
    (page - 1) * pageSize,
    pageSize,
  );

  const academics = await loadAcademics(
    students.flatMap((s) => (s.studentProfile ? [s.studentProfile] : [])),
  );
  return {
    data: students.map((s) => toAdminStudentDto(s, academics)),
    meta: { page, pageSize, total },
  };
};
