import {
  CourseRelationType,
  CourseSource,
  Prisma,
  SourceType,
  StudentDocumentType,
} from "../generated/prisma/client.js";
import { prisma } from "../libs/prisma.js";
import type { MajorData, UpdateProfileBody } from "../schemas/me.schema.js";

export const getUserInfo = async (id: string) => {
  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      studentProfile: {
        select: {
          yearOfStudy: true,
          onboardingCompletedAt: true,
          university: {
            select: {
              id: true,
              name: true,
              shortName: true,
              country: true,
              city: true,
              website: true,
              catalogYear: true,
              sources: {
                select: {
                  errorMessage: true,
                  lastProcessedAt: true,
                  lastFetchedAt: true,
                  uploadedById: true,
                },
              },
            },
          },
          major: {
            select: {
              id: true,
              universityId: true,
              name: true,
              degreeType: true,
              totalRequiredCredits: true,
            },
          },
          _count: {
            select: {
              documents: { where: { type: StudentDocumentType.TRANSCRIPT } },
            },
          },
        },
      },
    },
  });
};

const universitySelect = (major: string) =>
  ({
    id: true,
    name: true,
    shortName: true,
    country: true,
    city: true,
    website: true,
    catalogYear: true,
    sources: {
      select: {
        title: true,
        url: true,
        errorMessage: true,
        lastProcessedAt: true,
        lastFetchedAt: true,
      },
      orderBy: { lastProcessedAt: { sort: "desc", nulls: "last" } },
    },
    majors: {
      where: { name: { equals: major, mode: "insensitive" } },
      select: {
        id: true,
        universityId: true,
        name: true,
        degreeType: true,
        totalRequiredCredits: true,
      },
      take: 1,
    },
    _count: { select: { majors: true } },
  }) as const satisfies Prisma.UniversitySelect;

export const listUniversities = async () => {
  return prisma.university.findMany({
    select: { id: true, name: true, shortName: true, country: true },
  });
};

export const createUniversity = async ({
  name,
  country,
  city,
  major,
}: {
  name: string;
  country: string;
  city: string;
  major: string;
}) => {
  const { id } = await prisma.university.upsert({
    where: { name_country: { name, country } },
    create: { name, country, city },
    update: {},
    select: { id: true },
  });

  return getUniversityById(id, major);
};

export const getUniversityById = async (id: string, major: string) => {
  const university = await prisma.university.findUniqueOrThrow({
    where: { id },
    select: universitySelect(major),
  });

  const courseCount = await prisma.course.count({
    where: { major: { universityId: id } },
  });

  return { ...university, courseCount };
};

export const saveSelection = async (
  userId: string,
  universityId: string,
  majorId: string | null,
) => {
  return prisma.studentProfile.upsert({
    where: { userId },
    create: { userId, universityId, majorId },
    update: { universityId, majorId },
    select: { id: true },
  });
};

export const updateProfile = async (
  userId: string,
  data: UpdateProfileBody,
) => {
  return prisma.studentProfile.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
    select: { id: true },
  });
};

export const getSelection = async (userId: string) => {
  return prisma.studentProfile.findUnique({
    where: { userId },
    select: {
      university: { select: { id: true, name: true } },
      major: { select: { id: true, name: true } },
    },
  });
};

export const getUniversitySources = async (userId: string) => {
  return prisma.studentProfile.findUnique({
    where: { userId },
    select: {
      university: {
        select: {
          sources: {
            select: {
              id: true,
              title: true,
              sourceType: true,
              errorMessage: true,
              lastFetchedAt: true,
              lastProcessedAt: true,
              createdAt: true,
            },
            orderBy: { createdAt: "desc" },
          },
        },
      },
    },
  });
};

const sourceTypes = {
  pdf: SourceType.PDF,
  html: SourceType.HTML,
  image: SourceType.IMAGE,
};

export const saveMajorData = async (
  universityId: string,
  major: NonNullable<MajorData["major"]>,
  courses: MajorData["courses"],
  sources: {
    title?: string;
    url: string;
    type: "pdf" | "html" | "image";
    uploadedById?: string;
  }[],
) => {
  return prisma.$transaction(async (tx) => {
    const savedMajor = await tx.major.upsert({
      where: { universityId_name: { universityId, name: major.name } },
      create: {
        universityId,
        name: major.name,
        totalRequiredCredits: major.totalRequiredCredits,
      },
      update:
        major.totalRequiredCredits === null
          ? {}
          : { totalRequiredCredits: major.totalRequiredCredits },
      select: {
        id: true,
        universityId: true,
        name: true,
        degreeType: true,
        totalRequiredCredits: true,
      },
    });

    await tx.course.createMany({
      data: courses.map((course) => ({
        majorId: savedMajor.id,
        code: course.code,
        name: course.name,
        description: course.description,
        credits: course.credits,
        category: course.category,
        offeredTerms: course.offeredTerms,
        source: CourseSource.AI_EXTRACTED,
      })),
      skipDuplicates: true,
    });

    const savedCourses = await tx.course.findMany({
      where: { majorId: savedMajor.id },
      select: { id: true, code: true },
    });
    const idByCode = new Map(savedCourses.map((c) => [c.code, c.id]));

    const requisites = courses.flatMap((course) => {
      const courseId = idByCode.get(course.code);
      if (!courseId) return [];

      return [
        ...course.prerequisites.map((code) => ({
          code,
          relationType: CourseRelationType.PREREQUISITE,
        })),
        ...course.corequisites.map((code) => ({
          code,
          relationType: CourseRelationType.COREQUISITE,
        })),
      ].flatMap(({ code, relationType }) => {
        const requiredCourseId = idByCode.get(code);
        if (!requiredCourseId || requiredCourseId === courseId) return [];
        return [{ courseId, requiredCourseId, relationType }];
      });
    });

    await tx.coursePrerequisite.createMany({
      data: requisites,
      skipDuplicates: true,
    });

    const now = new Date();
    await tx.courseMaterialSource.createMany({
      data: sources.map((source) => ({
        universityId,
        title: source.title ?? null,
        url: source.url,
        sourceType: sourceTypes[source.type],
        uploadedById: source.uploadedById ?? null,
        lastFetchedAt: now,
        lastProcessedAt: now,
      })),
      skipDuplicates: true,
    });

    return savedMajor;
  });
};
