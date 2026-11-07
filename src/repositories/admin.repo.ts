import {
  CourseSource,
  Prisma,
  UserRole,
  type CourseRelationType,
} from "../generated/prisma/client.js";
import { prisma } from "../libs/prisma.js";
import type {
  AdminCourseBody,
  AdminMajorBody,
  AdminMajorUpdateBody,
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

export const findMajorByName = async (
  universityId: string,
  name: string,
  excludeId?: string,
) => {
  return prisma.major.findFirst({
    where: {
      universityId,
      name: { equals: name, mode: "insensitive" },
      ...(excludeId && { id: { not: excludeId } }),
    },
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

export const findMajorById = async (id: string) => {
  return prisma.major.findUnique({
    where: { id },
    select: { id: true, universityId: true, name: true },
  });
};

export const updateMajor = async (id: string, data: AdminMajorUpdateBody) => {
  return prisma.major.update({ where: { id }, data, select: majorSelect });
};

export const countMajorAcademicRecords = async (majorId: string) => {
  return prisma.academicRecord.count({ where: { course: { majorId } } });
};

export const deleteMajor = async (id: string) => {
  const usesMajorCourse = {
    semesters: {
      some: { courses: { some: { course: { majorId: id } } } },
    },
  };
  return prisma.$transaction([
    prisma.studyPlan.deleteMany({ where: usesMajorCourse }),
    prisma.major.delete({ where: { id } }),
  ]);
};

// ─── Courses ─────────────────────────────────────────────

const adminCourseSelect = {
  id: true,
  code: true,
  name: true,
  credits: true,
  category: true,
  majorId: true,
  description: true,
  offeredTerms: true,
  source: true,
  updatedAt: true,
  requisites: {
    select: {
      relationType: true,
      requiredCourse: { select: { id: true, code: true, name: true } },
    },
    orderBy: { requiredCourse: { code: "asc" } },
  },
  major: {
    select: {
      id: true,
      name: true,
      degreeType: true,
      university: { select: { id: true, name: true, shortName: true } },
    },
  },
  updatedBy: { select: { id: true, name: true } },
} as const satisfies Prisma.CourseSelect;

export interface CourseRequisite {
  requiredCourseId: string;
  relationType: CourseRelationType;
}

export const listAdminCourses = async (
  where: Prisma.CourseWhereInput,
  skip: number,
  take: number,
) => {
  return Promise.all([
    prisma.course.findMany({
      where,
      select: adminCourseSelect,
      orderBy: [{ code: "asc" }, { id: "asc" }],
      skip,
      take,
    }),
    prisma.course.count({ where }),
  ]);
};

export const getAdminCourse = async (id: string) => {
  return prisma.course.findUniqueOrThrow({
    where: { id },
    select: adminCourseSelect,
  });
};

export const findCourseById = async (id: string) => {
  return prisma.course.findUnique({
    where: { id },
    select: {
      id: true,
      majorId: true,
      code: true,
      requisites: {
        select: { relationType: true, requiredCourse: { select: { code: true } } },
      },
    },
  });
};

export const listMajorCourseCodes = async (majorId: string) => {
  return prisma.course.findMany({
    where: { majorId },
    select: { id: true, code: true },
  });
};

export const createCourse = async (
  fields: Omit<AdminCourseBody, "prerequisites" | "corequisites">,
  updatedById: string,
  requisites: CourseRequisite[],
) => {
  return prisma.course.create({
    data: {
      ...fields,
      source: CourseSource.ADMIN,
      updatedById,
      requisites: { create: requisites },
    },
    select: { id: true },
  });
};

/**
 * Updates a course. A requisites list replaces all its requisites. When the
 * course moves to another major, links from courses in its old major are removed.
 */
export const updateCourse = async (
  id: string,
  data: Prisma.CourseUncheckedUpdateInput,
  requisites: CourseRequisite[] | null,
  movedToMajorId: string | null,
) => {
  return prisma.$transaction([
    ...(requisites
      ? [
          prisma.coursePrerequisite.deleteMany({ where: { courseId: id } }),
          prisma.coursePrerequisite.createMany({
            data: requisites.map((r) => ({ ...r, courseId: id })),
          }),
        ]
      : []),
    ...(movedToMajorId
      ? [
          prisma.coursePrerequisite.deleteMany({
            where: {
              requiredCourseId: id,
              course: { majorId: { not: movedToMajorId } },
            },
          }),
        ]
      : []),
    prisma.course.update({ where: { id }, data, select: { id: true } }),
  ]);
};

export const countCourseUsage = async (courseId: string) => {
  const [records, plans] = await Promise.all([
    prisma.academicRecord.count({ where: { courseId } }),
    prisma.studyPlanCourse.count({ where: { courseId } }),
  ]);
  return records + plans;
};

export const deleteCourse = async (id: string) => {
  return prisma.course.delete({ where: { id }, select: { id: true } });
};

// ─── Students ────────────────────────────────────────────

const adminStudentSelect = {
  id: true,
  name: true,
  email: true,
  createdAt: true,
  sessions: {
    select: { lastUsedAt: true },
    orderBy: { lastUsedAt: "desc" },
    take: 1,
  },
  studentProfile: {
    select: {
      id: true,
      yearOfStudy: true,
      onboardingCompletedAt: true,
      university: { select: { id: true, name: true, shortName: true } },
      major: {
        select: {
          id: true,
          name: true,
          degreeType: true,
          totalRequiredCredits: true,
        },
      },
      _count: { select: { academicRecords: true, documents: true } },
      documents: {
        select: {
          id: true,
          type: true,
          fileName: true,
          status: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  },
} as const satisfies Prisma.UserSelect;

export const studentWhere = (where: Prisma.UserWhereInput) => ({
  AND: [activeStudent, where],
});

export const listAdminStudents = async (
  where: Prisma.UserWhereInput,
  skip: number,
  take: number,
) => {
  return Promise.all([
    prisma.user.findMany({
      where: studentWhere(where),
      select: adminStudentSelect,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip,
      take,
    }),
    prisma.user.count({ where: studentWhere(where) }),
  ]);
};

export const getAdminStudent = async (id: string) => {
  return prisma.user.findFirst({
    where: studentWhere({ id }),
    select: adminStudentSelect,
  });
};

export const listStudentRecordSummaries = async (profileIds: string[]) => {
  return prisma.academicRecord.findMany({
    where: { studentId: { in: profileIds } },
    select: {
      studentId: true,
      status: true,
      grade: true,
      course: { select: { credits: true } },
    },
  });
};

export const listStudentPlanTerms = async (profileIds: string[]) => {
  return prisma.studyPlan.findMany({
    where: { studentId: { in: profileIds } },
    select: {
      studentId: true,
      semesters: { select: { term: true, year: true } },
    },
    orderBy: { createdAt: "desc" },
  });
};
