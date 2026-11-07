import AppErr from "../../libs/appErr.js";
import * as adminRepo from "../../repositories/admin.repo.js";
import type { AdminStudentDetailsDto } from "../../types/admin.dto.js";
import { loadAcademics, toAdminStudentDto } from "./students.js";

/** Builds the student details sheet for GET /admin/students/:studentId: summary values and documents, never grades. */
export const getStudent = async (
  studentId: string,
): Promise<AdminStudentDetailsDto> => {
  const student = await adminRepo.getAdminStudent(studentId);
  if (!student) throw new AppErr("Student not found", 404);

  const profile = student.studentProfile;
  const academics = await loadAcademics(profile ? [profile] : []);

  return {
    ...toAdminStudentDto(student, academics),
    onboardingCompletedAt: profile?.onboardingCompletedAt?.toISOString() ?? null,
    documentsList: (profile?.documents ?? []).map((document) => ({
      ...document,
      createdAt: document.createdAt.toISOString(),
    })),
  };
};
