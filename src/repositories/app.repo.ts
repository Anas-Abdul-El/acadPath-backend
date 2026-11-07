import {
  CourseRelationType,
  Prisma,
  type ResourcePlatform,
  type Term,
} from "../generated/prisma/client.js";
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

const courseRefSelect = {
  id: true,
  code: true,
  name: true,
} as const satisfies Prisma.CourseSelect;

const learningResourceSelect = {
  id: true,
  title: true,
  url: true,
  platform: true,
  provider: true,
  format: true,
  description: true,
  duration: true,
  difficulty: true,
  topics: true,
  verified: true,
  courses: { select: courseRefSelect, orderBy: { code: "asc" } },
} as const satisfies Prisma.LearningResourceSelect;

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

export const getStudyPlan = async (userId: string) => {
  return prisma.studyPlan.findFirst({
    where: { student: { userId } },
    select: {
      id: true,
      name: true,
      assumptions: true,
      notes: true,
      createdAt: true,
      student: {
        select: { major: { select: { totalRequiredCredits: true } } },
      },
      semesters: {
        select: {
          id: true,
          term: true,
          year: true,
          rationale: true,
          courses: {
            select: {
              id: true,
              status: true,
              course: {
                select: {
                  ...courseSummarySelect,
                  majorId: true,
                  description: true,
                  offeredTerms: true,
                  requisites: {
                    select: {
                      relationType: true,
                      requiredCourse: { select: courseRefSelect },
                    },
                    orderBy: { requiredCourse: { code: "asc" } },
                  },
                },
              },
            },
            orderBy: { course: { code: "asc" } },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
};

export const createStudyPlan = async (
  studentId: string,
  plan: {
    assumptions: string[];
    notes: string[];
    semesters: {
      term: Term;
      year: number;
      rationale: string | null;
      courseIds: string[];
    }[];
  },
) => {
  return prisma.studyPlan.create({
    data: {
      studentId,
      assumptions: plan.assumptions,
      notes: plan.notes,
      semesters: {
        create: plan.semesters.map(({ courseIds, ...semester }) => ({
          ...semester,
          courses: {
            create: courseIds.map((courseId) => ({ courseId })),
          },
        })),
      },
    },
    select: { id: true },
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

export const getCourseDetails = async (courseId: string) => {
  return prisma.course.findUnique({
    where: { id: courseId },
    select: {
      ...courseSummarySelect,
      majorId: true,
      description: true,
      offeredTerms: true,
      requisites: {
        select: {
          relationType: true,
          requiredCourse: { select: courseRefSelect },
        },
        orderBy: { requiredCourse: { code: "asc" } },
      },
      requiredFor: {
        where: { relationType: CourseRelationType.PREREQUISITE },
        select: { course: { select: courseRefSelect } },
        orderBy: { course: { code: "asc" } },
      },
      resources: {
        select: learningResourceSelect,
        orderBy: { title: "asc" },
      },
    },
  });
};

export const listFocusCourses = async (courseIds: string[]) => {
  return prisma.course.findMany({
    where: { id: { in: courseIds } },
    select: {
      ...courseSummarySelect,
      description: true,
      requisites: {
        where: { relationType: CourseRelationType.PREREQUISITE },
        select: { requiredCourse: { select: courseRefSelect } },
        orderBy: { requiredCourse: { code: "asc" } },
      },
      requiredFor: {
        where: { relationType: CourseRelationType.PREREQUISITE },
        select: { course: { select: courseRefSelect } },
        orderBy: { course: { code: "asc" } },
      },
    },
    orderBy: { code: "asc" },
  });
};

export const saveLearningResources = async (
  resources: (Omit<Prisma.LearningResourceCreateInput, "courses"> & {
    courseIds: string[];
  })[],
) => {
  return Promise.all(
    resources.map(({ courseIds, ...resource }) => {
      const courses = { connect: courseIds.map((id) => ({ id })) };
      return prisma.learningResource.upsert({
        where: { url: resource.url },
        create: { ...resource, courses },
        update: { courses },
        select: learningResourceSelect,
      });
    }),
  );
};

export const listMajorCourseSummaries = async (majorId: string) => {
  return prisma.course.findMany({
    where: { majorId },
    select: { ...courseSummarySelect, description: true },
    orderBy: { code: "asc" },
  });
};

export const searchStoredResources = async ({
  platforms,
  courseId,
  terms,
}: {
  platforms: ResourcePlatform[];
  courseId: string | null;
  terms: string[];
}) => {
  return prisma.learningResource.findMany({
    where: {
      platform: { in: platforms },
      OR: [
        ...(courseId ? [{ courses: { some: { id: courseId } } }] : []),
        ...terms.flatMap((term) => [
          { title: { contains: term, mode: "insensitive" as const } },
          { description: { contains: term, mode: "insensitive" as const } },
        ]),
      ],
    },
    select: learningResourceSelect,
    orderBy: [{ verified: "desc" }, { title: "asc" }],
    take: 50,
  });
};

export const listCourseResources = async (courseIds: string[]) => {
  return prisma.learningResource.findMany({
    where: { courses: { some: { id: { in: courseIds } } } },
    select: learningResourceSelect,
    orderBy: [{ verified: "desc" }, { title: "asc" }],
  });
};

const quizCourseSelect = {
  code: true,
  name: true,
  description: true,
} as const satisfies Prisma.CourseSelect;

export const getQuizResource = async (resourceId: string) => {
  return prisma.learningResource.findUnique({
    where: { id: resourceId },
    select: {
      title: true,
      platform: true,
      provider: true,
      description: true,
      difficulty: true,
      topics: true,
      courses: { select: quizCourseSelect, orderBy: { code: "asc" } },
    },
  });
};

export const getQuizCourse = async (courseId: string) => {
  return prisma.course.findUnique({
    where: { id: courseId },
    select: quizCourseSelect,
  });
};
