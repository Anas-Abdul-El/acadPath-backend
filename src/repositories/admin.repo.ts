import { CourseSource, Prisma, UserRole } from "../generated/prisma/client.js";
import { prisma } from "../libs/prisma.js";
import type {
  AdminMajorBody,
  AdminUniversityBody,
  AdminUniversityUpdateBody,
} from "../schemas/admin.schema.js";

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

const adminUniversitySelect = {
  id: true,
  name: true,
  shortName: true,
  country: true,
  city: true,
  website: true,
  catalogYear: true,
  createdAt: true,
  updatedAt: true,
  sources: {
    select: { errorMessage: true, lastProcessedAt: true, lastFetchedAt: true },
  },
  _count: {
    select: {
      majors: true,
      students: { where: { user: { isDeleted: false } } },
    },
  },
} as const satisfies Prisma.UniversitySelect;

export const listAdminUniversities = async (where: Prisma.UniversityWhereInput) => {
  return prisma.university.findMany({
    where,
    select: adminUniversitySelect,
    orderBy: { name: "asc" },
  });
};

export const getAdminUniversity = async (id: string) => {
  return prisma.university.findUniqueOrThrow({
    where: { id },
    select: adminUniversitySelect,
  });
};

export const countCoursesByUniversity = async (universityIds: string[]) => {
  const majors = await prisma.major.findMany({
    where: { universityId: { in: universityIds } },
    select: { universityId: true, _count: { select: { courses: true } } },
  });
  const counts = new Map<string, number>();
  for (const { universityId, _count } of majors)
    counts.set(universityId, (counts.get(universityId) ?? 0) + _count.courses);
  return counts;
};

const majorSelect = {
  id: true,
  universityId: true,
  name: true,
  degreeType: true,
  totalRequiredCredits: true,
} as const satisfies Prisma.MajorSelect;

const adminMajorSelect = {
  ...majorSelect,
  _count: {
    select: {
      courses: true,
      students: { where: { user: { isDeleted: false } } },
    },
  },
} as const satisfies Prisma.MajorSelect;

export const getAdminUniversityDetails = async (id: string) => {
  return prisma.university.findUnique({
    where: { id },
    select: {
      ...adminUniversitySelect,
      majors: { select: adminMajorSelect, orderBy: { name: "asc" } },
      sources: {
        select: {
          id: true,
          title: true,
          url: true,
          sourceType: true,
          errorMessage: true,
          lastProcessedAt: true,
          lastFetchedAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
};

export const findUniversityById = async (id: string) => {
  return prisma.university.findUnique({
    where: { id },
    select: { id: true, name: true, country: true },
  });
};

export const findUniversityByNameAndCountry = async (
  name: string,
  country: string,
  excludeId?: string,
) => {
  return prisma.university.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      country: { equals: country, mode: "insensitive" },
      ...(excludeId && { id: { not: excludeId } }),
    },
    select: { id: true },
  });
};

export const createUniversity = async (data: AdminUniversityBody) => {
  return prisma.university.create({ data, select: { id: true } });
};

export const updateUniversity = async (
  id: string,
  data: AdminUniversityUpdateBody,
) => {
  return prisma.university.update({ where: { id }, data, select: { id: true } });
};

export const countUniversityAcademicRecords = async (universityId: string) => {
  return prisma.academicRecord.count({
    where: { course: { major: { universityId } } },
  });
};

export const deleteUniversity = async (id: string) => {
  const usesUniversityCourse = {
    semesters: {
      some: { courses: { some: { course: { major: { universityId: id } } } } },
    },
  };
  return prisma.$transaction([
    prisma.studyPlan.deleteMany({ where: usesUniversityCourse }),
    prisma.university.delete({ where: { id } }),
  ]);
};

export const listUniversityMajors = async (universityId: string) => {
  return prisma.major.findMany({
    where: { universityId },
    select: adminMajorSelect,
    orderBy: { name: "asc" },
  });
};

export const findMajorByName = async (universityId: string, name: string) => {
  return prisma.major.findFirst({
    where: { universityId, name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
};

export const createMajor = async (
  universityId: string,
  data: AdminMajorBody,
) => {
  return prisma.major.create({
    data: { ...data, universityId },
    select: majorSelect,
  });
};
