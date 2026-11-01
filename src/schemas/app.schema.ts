import z from "zod";
import {
  AcademicRecordStatus,
  CourseCategory,
  Term,
} from "../generated/prisma/enums.js";

export const academicRecordsQuerySchema = z.object({
  status: z.enum(AcademicRecordStatus).optional(),
  term: z.enum(Term).optional(),
  year: z.coerce.number().int().positive().optional(),
});

export type AcademicRecordsQuery = z.infer<typeof academicRecordsQuerySchema>;

export const studentCoursesQuerySchema = z.object({
  q: z.string().trim().optional(),
  category: z.enum(CourseCategory).optional(),
  status: z
    .enum(["COMPLETED", "FAILED", "IN_PROGRESS", "PLANNED", "NOT_TAKEN"])
    .optional(),
});

export type StudentCoursesQuery = z.infer<typeof studentCoursesQuerySchema>;

export const courseParamsSchema = z.object({
  courseId: z.uuid(),
});

export type CourseParams = z.infer<typeof courseParamsSchema>;

/**
 * generateStudyPlanSchema validates the optional POST /me/study-plan/generate body.
 * maxCreditsPerSemester is 12–18 and defaults to 16.
 */
export const generateStudyPlanSchema = z
  .object({
    maxCreditsPerSemester: z
      .number({ error: "Max credits per semester must be a number" })
      .int({ error: "Max credits per semester must be a whole number" })
      .min(12, { error: "Max credits per semester must be at least 12" })
      .max(18, { error: "Max credits per semester must be at most 18" })
      .default(16),
  })
  .default({ maxCreditsPerSemester: 16 });

/** GenerateStudyPlanBody is the validated body: { maxCreditsPerSemester }. */
export type GenerateStudyPlanBody = z.infer<typeof generateStudyPlanSchema>;

/** studyPlanDataSchema validates the study planning AI's reply. */
export const studyPlanDataSchema = z.object({
  assumptions: z.array(z.string()).default([]),
  notes: z.array(z.string()).default([]),
  semesters: z.array(
    z.object({
      term: z.enum(Term),
      year: z.number().int().min(2000).max(2100),
      rationale: z.string().nullable().default(null),
      courses: z.array(z.string()),
    }),
  ),
});

/** StudyPlanData is the validated AI reply: { assumptions, notes, semesters }. */
export type StudyPlanData = z.infer<typeof studyPlanDataSchema>;
