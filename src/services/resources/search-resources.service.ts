import logger from "../../config/logger.js";
import { RESOURCE_SEARCH_PROMPT } from "../../libs/prompt.js";
import * as appRepo from "../../repositories/app.repo.js";
import {
  learningResourcesDataSchema,
  type ResourceSearchBody,
} from "../../schemas/app.schema.js";
import type {
  LearningResourceDto,
  ResourceSearchDto,
} from "../../types/app.dto.js";
import {
  askAiForJson,
  linkWorks,
  normalizeCode,
  platformOf,
} from "../shared/index.js";

type MajorCourse = Awaited<
  ReturnType<typeof appRepo.listMajorCourseSummaries>
>[number];

const minStoredResults = 3;
const maxResults = 20;

const matchCourse = (courses: MajorCourse[], query: string) => {
  const code = normalizeCode(query);
  const name = query.toLowerCase();
  return (
    courses.find((c) => normalizeCode(c.code) === code) ??
    courses.find((c) => c.name.toLowerCase() === name) ??
    null
  );
};

const findNewResources = async (
  userId: string,
  { query, goal, platforms }: ResourceSearchBody,
  course: MajorCourse | null,
) => {
  const profile = await appRepo.getSummaryProfile(userId);
  const { resources } = await askAiForJson(
    RESOURCE_SEARCH_PROMPT,
    {
      universityName: profile?.university?.name ?? null,
      majorName: profile?.major?.name ?? null,
      query,
      goal: goal ?? null,
      platforms,
      course: course
        ? { code: course.code, name: course.name, description: course.description }
        : null,
    },
    learningResourcesDataSchema,
    "AI returned invalid learning resources",
    { webSearch: true },
  );

  const byUrl = new Map(
    resources.flatMap(({ courses: _, ...resource }) => {
      const platform = platformOf(resource.url);
      if (!platform || !platforms.includes(platform)) return [];
      return [[resource.url, { ...resource, platform }] as const];
    }),
  );
  const candidates = [...byUrl.values()];
  const works = await Promise.all(
    candidates.map((r) => linkWorks(r.url, r.platform)),
  );
  const working = candidates
    .filter((_, i) => works[i])
    .map((r) => ({
      ...r,
      verified: false,
      courseIds: course ? [course.id] : [],
    }));
  return working.length ? appRepo.saveLearningResources(working) : [];
};

/**
 * Searches learning resources for POST /resources/search.
 *
 * Recognizes the query as a course in the student's major when it's that
 * course's code or name, then returns stored resources linked to the course or
 * mentioning the query, course-linked and verified ones first. When few match,
 * or the student gave a goal, the AI searches the web and the working links it
 * finds are saved unverified and added after them.
 */
export const searchResources = async (
  userId: string,
  body: ResourceSearchBody,
): Promise<ResourceSearchDto> => {
  const student = await appRepo.getStudentMajorId(userId);
  const courses = student?.majorId
    ? await appRepo.listMajorCourseSummaries(student.majorId)
    : [];
  const course = matchCourse(courses, body.query);

  const stored = (
    await appRepo.searchStoredResources({
      platforms: body.platforms,
      courseId: course?.id ?? null,
      terms: course ? [body.query, course.name] : [body.query],
    })
  ).sort(
    (a, b) =>
      Number(b.courses.some((c) => c.id === course?.id)) -
      Number(a.courses.some((c) => c.id === course?.id)),
  );

  let found: LearningResourceDto[] = [];
  if (stored.length < minStoredResults || body.goal) {
    try {
      found = await findNewResources(userId, body, course);
    } catch (error) {
      if (!stored.length) throw error;
      logger.warn("Could not search for new learning resources", { error });
    }
  }

  const storedIds = new Set(stored.map((r) => r.id));
  const results = [...stored, ...found.filter((r) => !storedIds.has(r.id))];

  let matchedCourse = null;
  if (course) {
    const { description: _, ...summary } = course;
    matchedCourse = summary;
  }
  return { results: results.slice(0, maxResults), matchedCourse };
};
