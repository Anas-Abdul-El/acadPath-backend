import * as meRepo from "../../../repositories/me.repo.js";
import type { SelectUniversityBody } from "../../../schemas/me.schema.js";
import type { MajorDto, UniversityData } from "../../../types/me.dto.js";
import {
  extractMajorData,
  findMajorSources,
  parseSources,
  saveMajorData,
} from "./catalog-extraction.js";
import { toUniversityData, type UniversityInfo } from "./catalog-status.js";

const collapseWhitespace = (value: string): string =>
  value.trim().replace(/\s+/g, " ");

const normalizeForComparison = (value: string): string =>
  collapseWhitespace(value)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/^the /, "");

const findUniversity = async (input: {
  name: string;
  country: string;
  major: string;
}): Promise<{ university: UniversityInfo | null; major: MajorDto | null }> => {
  const name = normalizeForComparison(input.name);
  const country = normalizeForComparison(input.country);

  const universities = await meRepo.listUniversities();
  const match = universities.find(
    (university) =>
      normalizeForComparison(university.country) === country &&
      (normalizeForComparison(university.name) === name ||
        (university.shortName !== null &&
          normalizeForComparison(university.shortName) === name)),
  );
  if (!match) return { university: null, major: null };

  const university = await meRepo.getUniversityById(
    match.id,
    input.major.trim(),
  );
  return { university, major: university.majors[0] ?? null };
};

const findOrCreateUniversity = async (input: {
  name: string;
  country: string;
  city: string;
  major: string;
}): Promise<UniversityInfo> => {
  return meRepo.findOrCreateUniversity({
    name: collapseWhitespace(input.name),
    country: collapseWhitespace(input.country),
    city: collapseWhitespace(input.city),
    major: input.major.trim(),
  });
};

const saveUniversitySelection = async (
  userId: string,
  universityId: string,
  majorId: string | null,
): Promise<boolean> => {
  const previous = await meRepo.getSelection(userId);
  await meRepo.saveUniversitySelection(userId, universityId, majorId);

  const previousId = previous?.university?.id ?? null;
  return previousId !== null && previousId !== universityId;
};

export const selectUniversity = async (
  userId: string,
  body: SelectUniversityBody,
): Promise<UniversityData & { replaced: boolean }> => {
  const found = await findUniversity(body);
  const university =
    found.university ?? (await findOrCreateUniversity(body));

  if (found.major) {
    const replaced = await saveUniversitySelection(
      userId,
      university.id,
      found.major.id,
    );
    return { ...toUniversityData(university, found.major), replaced };
  }

  const sources = await findMajorSources(body);
  const parsedSources = await parseSources(sources);
  const majorData = await extractMajorData(body, parsedSources);

  const major = await saveMajorData(
    university.id,
    majorData.major?.name ?? body.major,
    majorData,
    parsedSources,
  );
  const replaced = await saveUniversitySelection(
    userId,
    university.id,
    major.id,
  );
  const updated = await meRepo.getUniversityById(university.id, major.name);

  return { ...toUniversityData(updated, major), replaced };
};
