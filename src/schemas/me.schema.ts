import z from "zod";
import {
  CourseCategory,
  SourceType,
  Term,
} from "../generated/prisma/enums.js";

const MAX_SOURCE_FILE_SIZE = 25 * 1024 * 1024;
const MAX_SOURCES_TOTAL_SIZE = 150 * 1024 * 1024;

const signature = (buffer: Buffer, start: number, end: number): string =>
  buffer.subarray(start, end).toString("latin1");

const detectSourceType = (buffer: Buffer): SourceType | null => {
  if (signature(buffer, 0, 4) === "%PDF") return SourceType.PDF;

  const isPng = signature(buffer, 0, 8) === "\x89PNG\r\n\x1a\n";
  const isJpeg = signature(buffer, 0, 3) === "\xff\xd8\xff";
  const isWebp =
    signature(buffer, 0, 4) === "RIFF" && signature(buffer, 8, 12) === "WEBP";
  if (isPng || isJpeg || isWebp) return SourceType.IMAGE;

  return null;
};

const sourceFileSchema = z
  .object({
    originalname: z.string(),
    size: z
      .number()
      .int()
      .positive({ error: "File is empty" })
      .max(MAX_SOURCE_FILE_SIZE, { error: "Each file must be 25 MB or smaller" }),
    mimetype: z.string(),
    buffer: z.instanceof(Buffer),
  })
  .transform((file, ctx) => {
    const sourceType = detectSourceType(file.buffer);
    if (!sourceType) {
      ctx.issues.push({
        code: "custom",
        message: "File must be a PDF, PNG, JPEG or WebP",
        input: file,
      });
      return z.NEVER;
    }

    return { ...file, sourceType };
  });

/**
 * uploadSourcesSchema validates the files of POST /me/university/sources.
 * 1–20 non-empty files, ≤ 25 MB each and ≤ 150 MB total. The type is read
 * from the file's bytes, not its extension or mimetype.
 */
export const uploadSourcesSchema = z
  .array(sourceFileSchema, { error: "Upload at least one file" })
  .min(1, { error: "Upload at least one file" })
  .max(20, { error: "Upload at most 20 files" })
  .refine(
    (files) =>
      files.reduce((total, file) => total + file.size, 0) <=
      MAX_SOURCES_TOTAL_SIZE,
    { error: "Files must be 150 MB or smaller in total" },
  );

/** UploadSourcesInput is the validated files, each with its detected sourceType. */
export type UploadSourcesInput = z.infer<typeof uploadSourcesSchema>;

/**
 * selectUniversitySchema validates the PUT /me/university request body.
 * Every field is required and trimmed.
 */
export const selectUniversitySchema = z.object({
  name: z.string({ error: "University name is required" }).trim().min(1, {
    error: "University name is required",
  }),
  country: z.string({ error: "Country is required" }).trim().min(1, {
    error: "Country is required",
  }),
  city: z.string({ error: "City is required" }).trim().min(1, {
    error: "City is required",
  }),
  major: z.string({ error: "Major is required" }).trim().min(1, {
    error: "Major is required",
  }),
});

/** SelectUniversityBody is the validated body: { name, country, city, major }. */
export type SelectUniversityBody = z.infer<typeof selectUniversitySchema>;

/**
 * majorDataSchema validates the course extraction AI's reply.
 * major is null when the sources had nothing about the requested major.
 */
export const majorDataSchema = z.object({
  major: z
    .object({
      name: z.string().min(1),
      totalRequiredCredits: z.number().int().min(1).max(300).nullable(),
    })
    .nullable(),
  courses: z.array(
    z.object({
      code: z.string().min(1),
      name: z.string().min(1),
      description: z.string().nullable(),
      credits: z.number().int().min(0),
      category: z.enum(CourseCategory),
      offeredTerms: z.array(z.enum(Term)).default([]),
      prerequisites: z.array(z.string()),
      corequisites: z.array(z.string()),
    }),
  ),
});

/** MajorData is the validated AI reply: { major, courses }. */
export type MajorData = z.infer<typeof majorDataSchema>;
