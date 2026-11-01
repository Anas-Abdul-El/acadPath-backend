import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../libs/prisma.js";
import type {
  AcademicRecordsQuery,
  StudentCoursesQuery,
} from "../schemas/app.schema.js";

const courseSummarySelect = {
  id: true,
  code: true,
  name: true,
  credits: true,
  category: true,
} as const satisfies Prisma.CourseSelect;

export const getSummaryProfile = async (userId: string) => {
  return prisma.studentProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      yearOfStudy: true,
      user: { select: { name: true } },
      university: { select: { id: true, name: true, shortName: true } },
      major: {
        select: {
          id: true,
          universityId: true,
          name: true,
          degreeType: true,
          totalRequiredCredits: true,
        },
      },
    },
  });
};

export const listAcademicRecords = async (
  userId: string,
  filters: AcademicRecordsQuery = {},
) => {
  return prisma.academicRecord.findMany({
    where: {
      student: { userId },
      ...(filters.status && { status: filters.status }),
      ...(filters.term && { term: filters.term }),
      ...(filters.year && { year: filters.year }),
    },
    select: {
      id: true,
      status: true,
      grade: true,
      expectedGrade: true,
      term: true,
      year: true,
      course: { select: courseSummarySelect },
    },
    orderBy: [{ year: "asc" }, { course: { code: "asc" } }],
  });
};

export const getLatestStudyPlan = async (userId: string) => {
  return prisma.studyPlan.findFirst({
    where: { student: { userId } },
    select: {
      id: true,
      semesters: {
        select: {
          term: true,
          year: true,
          courses: {
            select: {
              status: true,
              course: { select: { id: true, credits: true, category: true } },
            },
          },
        },
        orderBy: { year: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });
};

export const getStudentMajorId = async (userId: string) => {
  return prisma.studentProfile.findUnique({
    where: { userId },
    select: { majorId: true },
  });
};

export const listMajorCoursesWithRequisites = async (
  majorId: string,
  filters: StudentCoursesQuery,
) => {
  return prisma.course.findMany({
    where: {
      majorId,
      ...(filters.category && { category: filters.category }),
      ...(filters.q && {
        OR: [
          { code: { contains: filters.q, mode: "insensitive" } },
          { name: { contains: filters.q, mode: "insensitive" } },
          { description: { contains: filters.q, mode: "insensitive" } },
        ],
      }),
    },
    select: {
      ...courseSummarySelect,
      majorId: true,
      description: true,
      offeredTerms: true,
      requisites: {
        select: {
          relationType: true,
          requiredCourse: { select: { id: true, code: true, name: true } },
        },
        orderBy: { requiredCourse: { code: "asc" } },
      },
    },
    orderBy: { code: "asc" },
  });
};
