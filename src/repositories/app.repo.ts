import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../libs/prisma.js";

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

export const listAcademicRecords = async (userId: string) => {
  return prisma.academicRecord.findMany({
    where: { student: { userId } },
    select: {
      id: true,
      status: true,
      grade: true,
      expectedGrade: true,
      term: true,
      year: true,
      course: { select: courseSummarySelect },
    },
    orderBy: { year: "asc" },
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
              course: { select: { credits: true, category: true } },
            },
          },
        },
        orderBy: { year: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });
};
