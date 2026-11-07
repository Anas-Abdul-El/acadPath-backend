import z from "zod";
import {
  CourseCategory,
  CourseSource,
  DegreeType,
  Term,
} from "../generated/prisma/enums.js";
import { PLACE_NAME } from "./me.schema.js";

/** adminStatsQuerySchema validates the GET /admin/stats query: months is 1–24 and defaults to 8. */
export const adminStatsQuerySchema = z.object({
  months: z.coerce
    .number({ error: "Months must be a number" })
    .int({ error: "Months must be a whole number" })
    .min(1, { error: "Months must be at least 1" })
    .max(24, { error: "Months must be at most 24" })
    .default(8),
});

/** AdminStatsQuery is the validated query: { months }. */
export type AdminStatsQuery = z.infer<typeof adminStatsQuerySchema>;

/** paginationQuerySchema validates the page, pageSize and q params shared by admin list routes. */
export const paginationQuerySchema = z.object({
  page: z.coerce
    .number({ error: "Page must be a number" })
    .int({ error: "Page must be a whole number" })
    .min(1, { error: "Page must be at least 1" })
    .default(1),
  pageSize: z.coerce
    .number({ error: "Page size must be a number" })
    .int({ error: "Page size must be a whole number" })
    .min(1, { error: "Page size must be at least 1" })
    .max(100, { error: "Page size must be at most 100" })
    .default(20),
  q: z
    .string()
    .trim()
    .optional()
    .transform((q) => q || undefined),
});

/** adminUniversitiesQuerySchema validates the GET /admin/universities query. */
export const adminUniversitiesQuerySchema = paginationQuerySchema.extend({
  country: z
    .string()
    .trim()
    .optional()
    .transform((country) => country || undefined),
  catalogStatus: z
    .enum(["AVAILABLE", "PROCESSING", "UNAVAILABLE"], {
      error: "Catalog status must be AVAILABLE, PROCESSING or UNAVAILABLE",
    })
    .optional(),
});

/** AdminUniversitiesQuery is the validated query: { page, pageSize, q?, country?, catalogStatus? }. */
export type AdminUniversitiesQuery = z.infer<typeof adminUniversitiesQuerySchema>;

const universityName = z
  .string({ error: "University name is required" })
  .trim()
  .min(1, { error: "University name is required" })
  .min(3, { error: "Enter the university's full name" })
  .max(120, { error: "Use 120 characters or fewer" });

const universityCountry = z
  .string({ error: "Country is required" })
  .trim()
  .min(1, { error: "Country is required" })
  .min(2, { error: "Enter the full country name" })
  .max(60, { error: "Use 60 characters or fewer" })
  .regex(PLACE_NAME, { error: "Use letters only" });

const universityCity = z
  .string({ error: "City is required" })
  .trim()
  .min(1, { error: "City is required" })
  .max(80, { error: "Use 80 characters or fewer" })
  .regex(PLACE_NAME, { error: "Use letters only" });

const universityShortName = z
  .string()
  .trim()
  .max(12, { error: "Use 12 characters or fewer" });

const universityWebsite = z
  .string()
  .trim()
  .refine(
    (value) =>
      value === "" || z.url({ protocol: /^https?$/ }).safeParse(value).success,
    { error: "Enter a full address starting with https://" },
  );

const universityCatalogYear = z
  .string()
  .trim()
  .refine((value) => value === "" || /^\d{4}[–-]\d{2}$/.test(value), {
    error: "Use the format 2025–26",
  });

const optionalText = (schema: z.ZodType<string>) =>
  schema.nullish().transform((value) => value || null);

const clearableText = (schema: z.ZodType<string>) =>
  schema
    .nullable()
    .transform((value) => value || null)
    .exactOptional();

/**
 * adminUniversitySchema validates the POST /admin/universities body. Every
 * field is trimmed and an empty or missing optional field is stored as null.
 */
export const adminUniversitySchema = z.object({
  name: universityName,
  shortName: optionalText(universityShortName),
  country: universityCountry,
  city: universityCity,
  website: optionalText(universityWebsite),
  catalogYear: optionalText(universityCatalogYear),
});

/** AdminUniversityBody is the validated body. */
export type AdminUniversityBody = z.infer<typeof adminUniversitySchema>;

/**
 * adminUniversityUpdateSchema validates the PATCH /admin/universities/:universityId
 * body: any of the POST fields, at least one. Omitted fields stay unchanged,
 * and null or "" clears an optional field. Unknown fields are rejected.
 */
export const adminUniversityUpdateSchema = z
  .strictObject({
    name: universityName.exactOptional(),
    shortName: clearableText(universityShortName),
    country: universityCountry.exactOptional(),
    city: universityCity.exactOptional(),
    website: clearableText(universityWebsite),
    catalogYear: clearableText(universityCatalogYear),
  })
  .refine((body) => Object.keys(body).length > 0, {
    error: "Send at least one field to update",
  });

/** AdminUniversityUpdateBody is the validated body. */
export type AdminUniversityUpdateBody = z.infer<
  typeof adminUniversityUpdateSchema
>;

/** universityParamsSchema validates the :universityId route param. */
export const universityParamsSchema = z.object({
  universityId: z.uuid({ error: "Invalid university id" }),
});

export type UniversityParams = z.infer<typeof universityParamsSchema>;

const majorName = z
  .string({ error: "Major name is required" })
  .trim()
  .min(1, { error: "Major name is required" })
  .min(2, { error: "Enter the major's full name" })
  .max(100, { error: "Use 100 characters or fewer" });

const majorDegreeType = z.enum(DegreeType, {
  error: "Select a valid degree type",
});

const majorTotalCredits = z
  .number({ error: "Total credits must be a number" })
  .int({ error: "Total credits must be a whole number" })
  .min(1, { error: "Total credits must be at least 1" })
  .max(300, { error: "Total credits must be at most 300" })
  .nullable();

/** adminMajorSchema validates the POST /admin/universities/:universityId/majors body. */
export const adminMajorSchema = z.object({
  name: majorName,
  degreeType: majorDegreeType.default(DegreeType.BACHELOR),
  totalRequiredCredits: majorTotalCredits
    .optional()
    .transform((credits) => credits ?? null),
});

/** AdminMajorBody is the validated body: { name, degreeType, totalRequiredCredits }. */
export type AdminMajorBody = z.infer<typeof adminMajorSchema>;

/** adminMajorUpdateSchema validates the PATCH /admin/majors/:majorId body: any of the POST fields, at least one. */
export const adminMajorUpdateSchema = z
  .strictObject({
    name: majorName.exactOptional(),
    degreeType: majorDegreeType.exactOptional(),
    totalRequiredCredits: majorTotalCredits.exactOptional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    error: "Send at least one field to update",
  });

/** AdminMajorUpdateBody is the validated body. */
export type AdminMajorUpdateBody = z.infer<typeof adminMajorUpdateSchema>;

/** majorParamsSchema validates the :majorId route param. */
export const majorParamsSchema = z.object({
  majorId: z.uuid({ error: "Invalid major id" }),
});

export type MajorParams = z.infer<typeof majorParamsSchema>;

const COURSE_CODE = /^[A-Z]{2,5} \d{3,4}[A-Z]?$/;

/** Formats "cs3110", "cs-3110" or "CS  3110" as "CS 3110", like the frontend. */
const formatCourseCode = (value: string) => {
  const compact = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const match = compact.match(/^([A-Z]+)(\d+[A-Z]?)$/);
  return match ? `${match[1]} ${match[2]}` : value.trim().toUpperCase();
};

const courseCode = z
  .string({ error: "Enter a course code" })
  .trim()
  .min(1, { error: "Enter a course code" })
  .transform(formatCourseCode)
  .refine((code) => COURSE_CODE.test(code), {
    error: "Use a code like CS 3110 or MATH 101",
  });

const courseName = z
  .string({ error: "Enter the course name" })
  .trim()
  .min(3, { error: "Enter the course name" })
  .max(100, { error: "Use 100 characters or fewer" });

const courseDescription = z
  .string({ error: "Write a description" })
  .trim()
  .min(20, { error: "Write at least a sentence (20+ characters)" })
  .max(400, { error: "Keep the description under 400 characters" });

const courseCredits = z
  .number({ error: "Enter credit hours" })
  .int({ error: "Use a whole number" })
  .min(0, { error: "Credits can't be negative" })
  .max(8, { error: "Courses carry at most 8 credits" });

const courseCategory = z.enum(CourseCategory, {
  error: "Choose a category",
});

const offeredTerms = z
  .array(z.enum(Term, { error: "Choose FALL, SPRING or SUMMER" }), {
    error: "Send the offered terms as a list",
  })
  .transform((terms) => [...new Set(terms)]);

const requisiteCodes = z
  .array(z.string({ error: "Course codes must be text" }).trim(), {
    error: "Send course codes as a list",
  })
  .transform((codes) => [...new Set(codes.filter(Boolean).map(formatCourseCode))])
  .superRefine((codes, ctx) => {
    const invalid = codes.filter((code) => !COURSE_CODE.test(code));
    if (invalid.length)
      ctx.addIssue({
        code: "custom",
        message: `Check the format of ${invalid.join(", ")}`,
      });
  });

/**
 * adminCourseSchema validates the POST /admin/courses body. Codes are
 * formatted like "CS 3110"; prerequisites and corequisites are codes of
 * courses in the same major, checked by the service.
 */
export const adminCourseSchema = z.object({
  majorId: z.uuid({ error: "Choose a major" }),
  code: courseCode,
  name: courseName,
  description: courseDescription,
  credits: courseCredits,
  category: courseCategory,
  offeredTerms: offeredTerms.default([]),
  prerequisites: requisiteCodes.default([]),
  corequisites: requisiteCodes.default([]),
});

/** AdminCourseBody is the validated body. */
export type AdminCourseBody = z.infer<typeof adminCourseSchema>;

/**
 * adminCourseUpdateSchema validates the PATCH /admin/courses/:courseId body:
 * any of the POST fields, at least one. A sent requisite list replaces the old one.
 */
export const adminCourseUpdateSchema = z
  .strictObject({
    majorId: z.uuid({ error: "Choose a major" }).exactOptional(),
    code: courseCode.exactOptional(),
    name: courseName.exactOptional(),
    description: courseDescription.exactOptional(),
    credits: courseCredits.exactOptional(),
    category: courseCategory.exactOptional(),
    offeredTerms: offeredTerms.exactOptional(),
    prerequisites: requisiteCodes.exactOptional(),
    corequisites: requisiteCodes.exactOptional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    error: "Send at least one field to update",
  });

/** AdminCourseUpdateBody is the validated body. */
export type AdminCourseUpdateBody = z.infer<typeof adminCourseUpdateSchema>;

/** adminCoursesQuerySchema validates the GET /admin/courses query. */
export const adminCoursesQuerySchema = paginationQuerySchema.extend({
  universityId: z.uuid({ error: "Invalid university id" }).optional(),
  majorId: z.uuid({ error: "Invalid major id" }).optional(),
  category: z.enum(CourseCategory, { error: "Invalid category" }).optional(),
  source: z.enum(CourseSource, { error: "Invalid source" }).optional(),
});

/** AdminCoursesQuery is the validated query. */
export type AdminCoursesQuery = z.infer<typeof adminCoursesQuerySchema>;

/** adminCourseParamsSchema validates the :courseId route param. */
export const adminCourseParamsSchema = z.object({
  courseId: z.uuid({ error: "Invalid course id" }),
});

export type AdminCourseParams = z.infer<typeof adminCourseParamsSchema>;

/** adminStudentsQuerySchema validates the GET /admin/students query; q matches name or email. */
export const adminStudentsQuerySchema = paginationQuerySchema.extend({
  universityId: z.uuid({ error: "Invalid university id" }).optional(),
  stage: z
    .enum(["PROCESSED", "UPLOADED", "NONE"], {
      error: "Stage must be PROCESSED, UPLOADED or NONE",
    })
    .optional(),
});

/** AdminStudentsQuery is the validated query. */
export type AdminStudentsQuery = z.infer<typeof adminStudentsQuerySchema>;

/** studentParamsSchema validates the :studentId route param (a User id). */
export const studentParamsSchema = z.object({
  studentId: z.uuid({ error: "Invalid student id" }),
});

export type StudentParams = z.infer<typeof studentParamsSchema>;
