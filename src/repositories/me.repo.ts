import {
  CourseRelationType,
  CourseSource,
  Prisma,
  SourceType,
  StudentDocumentType,
} from "../generated/prisma/client.js";
import { prisma } from "../libs/prisma.js";
import type { MajorData } from "../schemas/me.schema.js";

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

export const findUniversity = async ({
  name,
  country,
  major,
}: {
  name: string;
  country: string;
  major: string;
}) => {
  const university = await prisma.university.findFirst({
    where: {
      OR: [
        { name: { equals: name, mode: "insensitive" } },
        { shortName: { equals: name, mode: "insensitive" } },
      ],
      country: { equals: country, mode: "insensitive" },
    },
    select: universitySelect(major),
  });
  if (!university) return null;

  const courseCount = await prisma.course.count({
    where: { major: { universityId: university.id } },
  });

  return { ...university, courseCount };
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

const sourceTypes = {
  pdf: SourceType.PDF,
  html: SourceType.HTML,
  image: SourceType.IMAGE,
};

export const saveMajorData = async (
  universityId: string,
  major: NonNullable<MajorData["major"]>,
  courses: MajorData["courses"],
  sources: { title?: string; url: string; type: "pdf" | "html" | "image" }[],
) => {
  return prisma.$transaction(async (tx) => {
    const savedMajor = await tx.major.upsert({
      where: { universityId_name: { universityId, name: major.name } },
      create: {
        universityId,
        name: major.name,
        totalRequiredCredits: major.totalRequiredCredits,
      },
      update: {},
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
        lastFetchedAt: now,
        lastProcessedAt: now,
      })),
      skipDuplicates: true,
    });

    return savedMajor;
  });
};
