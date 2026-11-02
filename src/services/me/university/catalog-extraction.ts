import { z } from "zod";
import { SourceType } from "../../../generated/prisma/client.js";
import AppErr from "../../../libs/appErr.js";
import { aiMessage, geminiMessage, parseAiJson } from "../../../libs/model.js";
import {
  COURSE_EXTRACTION_PROMPT,
  IMAGE_EXTRACTION_PROMPT,
  SOURCE_DISCOVERY_PROMPT,
} from "../../../libs/prompt.js";
import * as meRepo from "../../../repositories/me.repo.js";
import {
  majorDataSchema,
  type MajorData,
  type SelectUniversityBody,
  type UploadSourcesInput,
} from "../../../schemas/me.schema.js";
import type { MajorDto } from "../../../types/me.dto.js";
import detectContentType from "../../../utils/detectContentType.js";
import parsePdf from "../../../utils/pdfParser.js";
import { fetchAndParse } from "../../../utils/scraper.js";

const sourcesSchema = z.object({
  sources: z.array(z.url({ protocol: /^https?$/ })),
});

export const findMajorSources = async (
  input: SelectUniversityBody,
): Promise<string[]> => {
  const reply = await aiMessage(
    SOURCE_DISCOVERY_PROMPT,
    JSON.stringify({
      universityName: input.name.trim(),
      universityCity: input.city.trim(),
      universityCountry: input.country.trim(),
      majorName: input.major.trim(),
    }),
  );

  const result = sourcesSchema.safeParse(parseAiJson(reply));
  if (!result.success)
    throw new AppErr("AI returned an invalid list of sources", 502);

  return result.data.sources;
};

export interface ParsedSource {
  url: string;
  type: "pdf" | "html";
  text: string;
}

export interface SavedSource {
  title?: string;
  url: string;
  type: "pdf" | "html" | "image";
  uploadedById?: string;
}

const parseSource = async (url: string): Promise<ParsedSource | null> => {
  try {
    const type = await detectContentType(url);
    if (type === "pdf")
      return { url, type, text: await parsePdf({ type: "url", url }) };
    if (type === "html")
      return { url, type, text: (await fetchAndParse(url)).text };
    return null;
  } catch {
    return null;
  }
};

export const parseSources = async (urls: string[]): Promise<ParsedSource[]> => {
  const parsed = await Promise.all(urls.map(parseSource));
  return parsed.filter(
    (source): source is ParsedSource =>
      source !== null && source.text.length > 0,
  );
};

export type MajorInput = Pick<SelectUniversityBody, "name" | "major">;

export const extractMajorData = async (
  input: MajorInput,
  sources: ParsedSource[],
): Promise<MajorData> => {
  if (sources.length === 0) return { major: null, courses: [] };

  const reply = await aiMessage(
    COURSE_EXTRACTION_PROMPT,
    JSON.stringify({
      universityName: input.name.trim(),
      majorName: input.major.trim(),
      sources,
    }),
  );

  const result = majorDataSchema.safeParse(parseAiJson(reply));
  if (!result.success) throw new AppErr("AI returned invalid major data", 502);

  return result.data;
};

export type UploadedFile = UploadSourcesInput[number];

export const parseUploadedPdf = async (file: UploadedFile): Promise<ParsedSource> => {
  try {
    const text = await parsePdf({ type: "buffer", buffer: file.buffer });
    return { url: file.originalname, type: "pdf", text };
  } catch {
    throw new AppErr(`Could not read ${file.originalname}`, 422);
  }
};

const extractMajorDataFromPdfs = async (
  input: MajorInput,
  files: UploadedFile[],
): Promise<MajorData> => {
  const parsed = await Promise.all(files.map(parseUploadedPdf));
  return extractMajorData(
    input,
    parsed.filter((source) => source.text.length > 0),
  );
};

const extractMajorDataFromImages = async (
  input: MajorInput,
  files: UploadedFile[],
): Promise<MajorData> => {
  if (files.length === 0) return { major: null, courses: [] };

  const reply = await geminiMessage(
    IMAGE_EXTRACTION_PROMPT,
    JSON.stringify({
      universityName: input.name.trim(),
      majorName: input.major.trim(),
    }),
    files.map((file) => ({ buffer: file.buffer, mimeType: file.mimetype })),
  );

  const result = majorDataSchema.safeParse(parseAiJson(reply));
  if (!result.success) throw new AppErr("AI returned invalid major data", 502);

  return result.data;
};

export const extractMajorDataFromFiles = async (
  input: MajorInput,
  files: UploadSourcesInput,
): Promise<MajorData> => {
  const pdfs = files.filter((file) => file.sourceType === SourceType.PDF);
  const images = files.filter((file) => file.sourceType === SourceType.IMAGE);

  const [fromPdfs, fromImages] = await Promise.all([
    extractMajorDataFromPdfs(input, pdfs),
    extractMajorDataFromImages(input, images),
  ]);

  const courses = new Map(
    [...fromImages.courses, ...fromPdfs.courses].map((course) => [
      course.code,
      course,
    ]),
  );

  return {
    major: fromPdfs.major ?? fromImages.major,
    courses: [...courses.values()],
  };
};

export const saveMajorData = async (
  universityId: string,
  majorName: string,
  majorData: MajorData,
  sources: SavedSource[],
): Promise<MajorDto> => {
  return meRepo.saveMajorData(
    universityId,
    {
      name: majorName.trim(),
      totalRequiredCredits: majorData.major?.totalRequiredCredits ?? null,
    },
    majorData.courses,
    sources,
  );
};
