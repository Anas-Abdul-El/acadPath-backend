import z from "zod";
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

const optionalText = (schema: z.ZodString) =>
  schema.nullish().transform((value) => value || null);

/**
 * adminUniversitySchema validates the POST /admin/universities body. Every
 * field is trimmed and an empty or missing optional field is stored as null.
 */
export const adminUniversitySchema = z.object({
  name: z
    .string({ error: "University name is required" })
    .trim()
    .min(1, { error: "University name is required" })
    .min(3, { error: "Enter the university's full name" })
    .max(120, { error: "Use 120 characters or fewer" }),
  shortName: optionalText(
    z.string().trim().max(12, { error: "Use 12 characters or fewer" }),
  ),
  country: z
    .string({ error: "Country is required" })
    .trim()
    .min(1, { error: "Country is required" })
    .min(2, { error: "Enter the full country name" })
    .max(60, { error: "Use 60 characters or fewer" })
    .regex(PLACE_NAME, { error: "Use letters only" }),
  city: z
    .string({ error: "City is required" })
    .trim()
    .min(1, { error: "City is required" })
    .max(80, { error: "Use 80 characters or fewer" })
    .regex(PLACE_NAME, { error: "Use letters only" }),
  website: optionalText(
    z
      .string()
      .trim()
      .refine(
        (value) =>
          value === "" ||
          z.url({ protocol: /^https?$/ }).safeParse(value).success,
        { error: "Enter a full address starting with https://" },
      ),
  ),
  catalogYear: optionalText(
    z
      .string()
      .trim()
      .refine((value) => value === "" || /^\d{4}[–-]\d{2}$/.test(value), {
        error: "Use the format 2025–26",
      }),
  ),
});

/** AdminUniversityBody is the validated body. */
export type AdminUniversityBody = z.infer<typeof adminUniversitySchema>;
