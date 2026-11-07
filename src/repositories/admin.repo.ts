import { CourseSource, UserRole } from "../generated/prisma/client.js";
import { prisma } from "../libs/prisma.js";

const activeStudent = { role: UserRole.STUDENT, isDeleted: false };

export const countCatalog = async () => {
  const [students, universities, majors, courses, aiExtractedCourses] =
    await Promise.all([
      prisma.user.count({ where: activeStudent }),
      prisma.university.count(),
      prisma.major.count(),
      prisma.course.count(),
      prisma.course.count({ where: { source: CourseSource.AI_EXTRACTED } }),
    ]);
  return { students, universities, majors, courses, aiExtractedCourses };
};

export const listStudentSignupsSince = async (since: Date) => {
  return prisma.user.findMany({
    where: { ...activeStudent, createdAt: { gte: since } },
    select: { createdAt: true },
  });
};

export const listUniversitySourceStates = async () => {
  return prisma.university.findMany({
    select: {
      sources: {
        select: {
          errorMessage: true,
          lastProcessedAt: true,
          lastFetchedAt: true,
        },
      },
    },
  });
};
