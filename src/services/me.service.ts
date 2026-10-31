import { randomUUID } from "node:crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import {
  type ProcessingStatus,
  SourceType,
  type StudentDocumentType,
  UserRole,
  YearOfStudy,
} from "../generated/prisma/client.js";
import { z } from "zod";
import {
  majorDataSchema,
  transcriptDataSchema,
  type MajorData,
  type SelectUniversityBody,
  type TranscriptData,
  type UpdateProfileBody,
  type UploadSourcesInput,
} from "../schemas/me.schema.js";
import AppErr from "../libs/appErr.js";
import { aiMessage, geminiMessage } from "../libs/model.js";
import { ASSETS_BUCKET, s3 } from "../libs/storage.js";
import {
  COURSE_EXTRACTION_PROMPT,
  IMAGE_EXTRACTION_PROMPT,
  SOURCE_DISCOVERY_PROMPT,
  TRANSCRIPT_EXTRACTION_PROMPT,
} from "../libs/prompt.js";
import detectContentType from "../utils/detectContentType.js";
import parsePdf from "../utils/pdfParser.js";
import { fetchAndParse } from "../utils/scraper.js";
import * as meRepo from "../repositories/me.repo.js";
import type {
  CatalogStatus,
  MajorDto,
  MeData,
  StudentDocumentDto,
  UniversityData,
  UniversitySourceDto,
} from "../types/me.dto.js";

type UniversityInfo = Awaited<ReturnType<typeof meRepo.getUniversityById>>;

interface SourceState {
  errorMessage: string | null;
  lastProcessedAt: Date | null;
  lastFetchedAt: Date | null;
}

const getSourceStatus = (source: SourceState): ProcessingStatus => {
  if (source.errorMessage) return "FAILED";
  if (source.lastProcessedAt) return "COMPLETED";
  if (source.lastFetchedAt) return "PROCESSING";
  return "PENDING";
};

const getCatalogStatus = (sources: SourceState[]): CatalogStatus => {
  const statuses = sources.map(getSourceStatus);
  if (statuses.includes("COMPLETED")) return "AVAILABLE";
  if (statuses.includes("PENDING") || statuses.includes("PROCESSING"))
    return "PROCESSING";
  return "UNAVAILABLE";
};

export const getMe = async (userId: string): Promise<MeData> => {
  const userInfo = await meRepo.getUserInfo(userId);
  if (!userInfo) throw new AppErr("User not found", 401);

  const { studentProfile, ...user } = userInfo;
  if (user.role === UserRole.ADMIN)
    return { user, profile: null, onboarding: null };

  const university = studentProfile?.university ?? null;
  const yearOfStudy = studentProfile?.yearOfStudy ?? null;
  const onboardingCompletedAt = studentProfile?.onboardingCompletedAt ?? null;
  const transcriptCount = studentProfile?._count.documents ?? 0;

  let universityDto = null;
  if (university) {
    const { sources: _, ...rest } = university;
    universityDto = rest;
  }

  return {
    user,
    profile: {
      university: universityDto,
      major: studentProfile?.major ?? null,
      yearOfStudy,
      onboardingCompletedAt: onboardingCompletedAt?.toISOString() ?? null,
    },
    onboarding: {
      universitySelected: university !== null,
      catalogStatus: university ? getCatalogStatus(university.sources) : null,
      universityDocumentsUploaded:
        university?.sources.some((source) => source.uploadedById === user.id) ??
        false,
      yearOfStudySelected: yearOfStudy !== null,
      transcriptRequired: yearOfStudy !== YearOfStudy.NEW_STUDENT,
      transcriptUploaded: transcriptCount > 0,
      completed: onboardingCompletedAt !== null,
    },
  };
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

const clean = (value: string): string => value.trim().replace(/\s+/g, " ");

const normalize = (value: string): string =>
  clean(value)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/^the /, "");

export const findUniversity = async (input: {
  name: string;
  country: string;
  major: string;
}): Promise<{ university: UniversityInfo | null; major: MajorDto | null }> => {
  const name = normalize(input.name);
  const country = normalize(input.country);

  const universities = await meRepo.listUniversities();
  const match = universities.find(
    (university) =>
      normalize(university.country) === country &&
      (normalize(university.name) === name ||
        (university.shortName !== null &&
          normalize(university.shortName) === name)),
  );
  if (!match) return { university: null, major: null };

  const university = await meRepo.getUniversityById(
    match.id,
    input.major.trim(),
  );
  return { university, major: university.majors[0] ?? null };
};

export const createUniversity = async (input: {
  name: string;
  country: string;
  city: string;
  major: string;
}): Promise<UniversityInfo> => {
  return meRepo.createUniversity({
    name: clean(input.name),
    country: clean(input.country),
    city: clean(input.city),
    major: input.major.trim(),
  });
};

const parseAiJson = (reply: string | null): unknown => {
  try {
    return JSON.parse(reply?.replace(/^```(?:json)?|```$/g, "").trim() ?? "");
  } catch {
    return null;
  }
};

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

type MajorInput = Pick<SelectUniversityBody, "name" | "major">;

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

type UploadedFile = UploadSourcesInput[number];

const parseUploadedPdf = async (file: UploadedFile): Promise<ParsedSource> => {
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

export const getUniversityById = async (
  id: string,
  major: string,
): Promise<UniversityInfo> => {
  return meRepo.getUniversityById(id, major);
};

export const saveSelection = async (
  userId: string,
  universityId: string,
  majorId: string | null,
): Promise<boolean> => {
  const previous = await meRepo.getSelection(userId);
  await meRepo.saveSelection(userId, universityId, majorId);

  const previousId = previous?.university?.id ?? null;
  return previousId !== null && previousId !== universityId;
};

export const getSelection = async (userId: string) => {
  const profile = await meRepo.getSelection(userId);
  if (!profile?.university || !profile.major)
    throw new AppErr("Select your university first", 422);

  return {
    id: profile.id,
    university: profile.university,
    major: profile.major,
  };
};

export const updateProfile = async (
  userId: string,
  data: UpdateProfileBody,
): Promise<MeData> => {
  await meRepo.updateProfile(userId, data);
  return getMe(userId);
};

export const completeOnboarding = async (userId: string): Promise<MeData> => {
  const me = await getMe(userId);
  const { profile, onboarding } = me;
  if (!profile || !onboarding) throw new AppErr("Only students onboard", 403);
  if (onboarding.completed) return me;

  if (!onboarding.universitySelected || !profile.major)
    throw new AppErr("Select your university and major first", 422);
  if (onboarding.catalogStatus !== "AVAILABLE")
    throw new AppErr("Your university's course catalog isn't ready yet", 422);
  if (!onboarding.yearOfStudySelected)
    throw new AppErr("Select your year of study first", 422);
  if (onboarding.transcriptRequired && !onboarding.transcriptUploaded)
    throw new AppErr("Upload your transcript first", 422);

  await meRepo.completeOnboarding(userId);
  return getMe(userId);
};

export const getUniversitySources = async (
  userId: string,
): Promise<UniversitySourceDto[]> => {
  const profile = await meRepo.getUniversitySources(userId);
  if (!profile?.university)
    throw new AppErr("Select your university first", 422);

  return profile.university.sources.map((source) => ({
    id: source.id,
    title: source.title,
    sourceType: source.sourceType,
    status: getSourceStatus(source),
    errorMessage: source.errorMessage,
    createdAt: source.createdAt.toISOString(),
  }));
};

export const toUploadedSources = (
  userId: string,
  files: UploadSourcesInput,
): SavedSource[] => {
  return files.map((file) => ({
    title: file.originalname,
    url: `${userId}/${file.originalname}`,
    type: file.sourceType === SourceType.PDF ? "pdf" : "image",
    uploadedById: userId,
  }));
};

type StoredFile = UploadedFile & { key: string };

type MatchedRecord = Parameters<typeof meRepo.saveDocuments>[2][number];

export const extractTranscriptFromFiles = async (
  input: MajorInput,
  files: UploadSourcesInput,
): Promise<TranscriptData> => {
  const documents: { fileName: string; text: string }[] = [];
  const attachments: { buffer: Buffer; mimeType: string }[] = [];

  for (const file of files) {
    if (file.sourceType === SourceType.PDF) {
      const { text } = await parseUploadedPdf(file);
      if (text.length > 0) {
        documents.push({ fileName: file.originalname, text });
        continue;
      }
    }
    attachments.push({ buffer: file.buffer, mimeType: file.mimetype });
  }

  const reply = await geminiMessage(
    TRANSCRIPT_EXTRACTION_PROMPT,
    JSON.stringify({
      universityName: input.name.trim(),
      majorName: input.major.trim(),
      documents,
    }),
    attachments,
  );

  const result = transcriptDataSchema.safeParse(parseAiJson(reply));
  if (!result.success)
    throw new AppErr("AI returned invalid transcript data", 502);

  return result.data;
};

const normalizeCode = (code: string): string =>
  code.toUpperCase().replace(/\s+/g, "");

export const matchRecords = async (
  major: { id: string; name: string },
  records: TranscriptData["records"],
): Promise<MatchedRecord[]> => {
  const courses = await meRepo.listMajorCourses(major.id);
  const idByCode = new Map(
    courses.map((course) => [normalizeCode(course.code), course.id]),
  );

  const matched = new Map<string, MatchedRecord>();
  for (const record of records) {
    const courseId = idByCode.get(normalizeCode(record.code));
    if (!courseId) continue;

    matched.set(`${courseId}-${record.term}-${record.year}`, {
      courseId,
      status: record.status,
      grade: record.status === "IN_PROGRESS" ? null : record.grade,
      term: record.term,
      year: record.year,
    });
  }

  if (matched.size === 0)
    throw new AppErr(
      `None of the courses in the uploaded files are in ${major.name}`,
      422,
    );

  return [...matched.values()];
};

const extensions: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export const uploadDocuments = async (
  studentId: string,
  files: UploadSourcesInput,
): Promise<StoredFile[]> => {
  return Promise.all(
    files.map(async (file) => {
      const key = `documents/${studentId}/${randomUUID()}.${extensions[file.mimetype] ?? "bin"}`;
      await s3.send(
        new PutObjectCommand({
          Bucket: ASSETS_BUCKET,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
        }),
      );
      return { ...file, key };
    }),
  );
};

const toDocumentDto = (
  document: Awaited<ReturnType<typeof meRepo.listDocuments>>[number],
): StudentDocumentDto => ({
  ...document,
  processedAt: document.processedAt?.toISOString() ?? null,
  createdAt: document.createdAt.toISOString(),
});

export const saveDocuments = async (
  studentId: string,
  type: StudentDocumentType,
  files: StoredFile[],
  records: MatchedRecord[],
): Promise<StudentDocumentDto[]> => {
  const saved = await meRepo.saveDocuments(
    studentId,
    files.map((file) => ({
      type,
      fileName: file.originalname,
      fileUrl: file.key,
      mimeType: file.mimetype,
      fileSize: file.size,
    })),
    records,
  );

  return saved.map(toDocumentDto);
};

export const getDocuments = async (
  userId: string,
): Promise<StudentDocumentDto[]> => {
  const documents = await meRepo.listDocuments(userId);
  return documents.map(toDocumentDto);
};
