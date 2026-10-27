import z from "zod";
import { CourseCategory, Term } from "../generated/prisma/enums.js";

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
