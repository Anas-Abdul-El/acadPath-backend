import { ResourcePlatform } from "../../../generated/prisma/client.js";
import { RESOURCE_DISCOVERY_PROMPT } from "../../../libs/prompt.js";
import * as appRepo from "../../../repositories/app.repo.js";
import { learningResourcesDataSchema } from "../../../schemas/app.schema.js";
import { askAiForJson, normalizeCode } from "../../shared/index.js";

interface ResourceCourse {
  id: string;
  code: string;
  name: string;
  description: string | null;
}

type Candidate = Parameters<typeof appRepo.saveLearningResources>[0][number];

const platformHosts: Record<ResourcePlatform, string[]> = {
  YOUTUBE: ["youtube.com", "youtu.be"],
  UDEMY: ["udemy.com"],
  COURSERA: ["coursera.org"],
};

// The platform comes from the URL's host, not from what the AI claims.
const platformOf = (url: string) => {
  const host = new URL(url).hostname;
  const match = Object.entries(platformHosts).find(([, hosts]) =>
    hosts.some((h) => host === h || host.endsWith(`.${h}`)),
  );
  return match ? (match[0] as ResourcePlatform) : null;
};

// YouTube's oEmbed returns an error for videos and playlists that don't exist.
// Udemy and Coursera often block bots, so only a 404 or 410 counts as broken there.
const linkWorks = async (url: string, platform: ResourcePlatform) => {
  const target =
    platform === ResourcePlatform.YOUTUBE
      ? `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`
      : url;
  try {
    const res = await fetch(target, { signal: AbortSignal.timeout(8000) });
    return platform === ResourcePlatform.YOUTUBE
      ? res.ok
      : res.status !== 404 && res.status !== 410;
  } catch {
    return false;
  }
};

// Courses already sent to the AI since the server started, so a course with
// no good results doesn't trigger a new search on every request.
const searchedCourseIds = new Set<string>();

/**
 * Asks the AI (with web search) for learning resources for courses that have
 * none yet, drops links that don't work, and saves the rest unverified.
 */
export const findCourseResources = async (
  userId: string,
  courses: ResourceCourse[],
) => {
  const toSearch = courses.filter((c) => !searchedCourseIds.has(c.id));
  if (!toSearch.length) return;

  const profile = await appRepo.getSummaryProfile(userId);
  const { resources } = await askAiForJson(
    RESOURCE_DISCOVERY_PROMPT,
    {
      universityName: profile?.university?.name ?? null,
      majorName: profile?.major?.name ?? null,
      courses: toSearch.map(({ code, name, description }) => ({
        code,
        name,
        description,
      })),
    },
    learningResourcesDataSchema,
    "AI returned invalid learning resources",
    { webSearch: true },
  );
  // One entry per URL, merging the courses when the AI lists a link twice.
  const idByCode = new Map(toSearch.map((c) => [normalizeCode(c.code), c.id]));
  const byUrl = new Map<string, Candidate>();
  for (const { courses: codes, ...resource } of resources) {
    const platform = platformOf(resource.url);
    const courseIds = codes.flatMap(
      (code) => idByCode.get(normalizeCode(code)) ?? [],
    );
    if (!platform || !courseIds.length) continue;

    const existing = byUrl.get(resource.url);
    if (existing) existing.courseIds.push(...courseIds);
    else
      byUrl.set(resource.url, { ...resource, platform, courseIds, verified: false });
  }
  const candidates = [...byUrl.values()].map((c) => ({
    ...c,
    courseIds: [...new Set(c.courseIds)],
  }));

  const works = await Promise.all(
    candidates.map((r) => linkWorks(r.url, r.platform)),
  );
  const working = candidates.filter((_, i) => works[i]);
  if (working.length) await appRepo.saveLearningResources(working);

  for (const course of toSearch) searchedCourseIds.add(course.id);
};
