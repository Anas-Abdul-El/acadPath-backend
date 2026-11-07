import z from "zod";
import {
  AcademicRecordStatus,
  CourseCategory,
  LetterGrade,
  ResourceDifficulty,
  ResourcePlatform,
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

/** whatIfSchema validates the POST /me/what-if body: a 10–500 character scenario. */
export const whatIfSchema = z.object({
  scenario: z
    .string({ error: "Describe a scenario" })
    .trim()
    .min(10, { error: "Use at least 10 characters" })
    .max(500, { error: "Use 500 characters or fewer" }),
});

/** WhatIfBody is the validated body: { scenario }. */
export type WhatIfBody = z.infer<typeof whatIfSchema>;

/** whatIfIntentSchema validates the what-if AI's reply: a parsed scenario or an unclear one. */
export const whatIfIntentSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("ok"),
    kind: z.enum([
      "fail",
      "grade-change",
      "retake",
      "add",
      "move-earlier",
      "drop",
      "swap",
    ]),
    courses: z.array(z.string().min(1)).min(1),
    grade: z.enum(LetterGrade).nullable().default(null),
    term: z
      .object({ term: z.enum(Term), year: z.number().int() })
      .nullable()
      .default(null),
  }),
  z.object({
    status: z.literal("unclear"),
    message: z.string().min(1),
    suggestions: z.array(z.string()).default([]),
  }),
]);

/** WhatIfIntent is the validated AI reply. */
export type WhatIfIntent = z.infer<typeof whatIfIntentSchema>;

const advisorMessageSchema = z.discriminatedUnion("role", [
  z.object({
    role: z.literal("student"),
    content: z
      .string({ error: "Write a message" })
      .trim()
      .min(1, { error: "Write a message" })
      .max(1000, { error: "Use 1000 characters or fewer" }),
  }),
  z.object({
    role: z.literal("assistant"),
    content: z.string().trim().min(1).max(8000),
  }),
]);

/** advisorChatSchema validates the POST /me/advisor/chat body: 1–20 messages, oldest first, ending with the student's. */
export const advisorChatSchema = z.object({
  messages: z
    .array(advisorMessageSchema, { error: "Send the chat messages" })
    .min(1, { error: "Send at least one message" })
    .max(20, { error: "Send 20 messages or fewer" })
    .refine((messages) => !messages.length || messages.at(-1)?.role === "student", {
      error: "The last message must be from the student",
    }),
});

/** AdvisorChatBody is the validated body: { messages }. */
export type AdvisorChatBody = z.infer<typeof advisorChatSchema>;

/** learningResourcesDataSchema validates the resource discovery AI's reply. */
export const learningResourcesDataSchema = z.object({
  resources: z.array(
    z.object({
      title: z.string().trim().min(1),
      url: z.url({ protocol: /^https$/ }),
      platform: z.enum(ResourcePlatform),
      provider: z.string().nullable().default(null),
      format: z.string().nullable().default(null),
      description: z.string().nullable().default(null),
      duration: z.string().nullable().default(null),
      difficulty: z.enum(ResourceDifficulty).nullable().catch(null),
      topics: z.array(z.string()).default([]),
      courses: z.array(z.string()),
    }),
  ),
});

/** LearningResourcesData is the validated AI reply: { resources }. */
export type LearningResourcesData = z.infer<typeof learningResourcesDataSchema>;
