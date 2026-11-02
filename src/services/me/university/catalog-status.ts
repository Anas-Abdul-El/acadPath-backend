import type { ProcessingStatus } from "../../../generated/prisma/client.js";
import type * as meRepo from "../../../repositories/me.repo.js";
import type {
  CatalogStatus,
  MajorDto,
  UniversityData,
} from "../../../types/me.dto.js";

export type UniversityInfo = Awaited<ReturnType<typeof meRepo.getUniversityById>>;

interface SourceState {
  errorMessage: string | null;
  lastProcessedAt: Date | null;
  lastFetchedAt: Date | null;
}

export const getSourceStatus = (source: SourceState): ProcessingStatus => {
  if (source.errorMessage) return "FAILED";
  if (source.lastProcessedAt) return "COMPLETED";
  if (source.lastFetchedAt) return "PROCESSING";
  return "PENDING";
};

export const getCatalogStatus = (sources: SourceState[]): CatalogStatus => {
  const statuses = sources.map(getSourceStatus);
  if (statuses.includes("COMPLETED")) return "AVAILABLE";
  if (statuses.includes("PENDING") || statuses.includes("PROCESSING"))
    return "PROCESSING";
  return "UNAVAILABLE";
};

const getHostname = (url: string): string | null => {
  return URL.canParse(url) ? new URL(url).hostname : null;
};

export const toUniversityData = (
  university: UniversityInfo,
  major: MajorDto | null,
): UniversityData => {
  const {
    sources,
    majors: _,
    _count,
    courseCount,
    ...universityDto
  } = university;
  const newestCompleted = sources.find(
    (source) => getSourceStatus(source) === "COMPLETED",
  );

  return {
    university: universityDto,
    major,
    catalog: {
      status: getCatalogStatus(sources),
      title: newestCompleted?.title ?? null,
      source: newestCompleted ? getHostname(newestCompleted.url) : null,
      courseCount,
      majorCount: _count.majors,
    },
  };
};
