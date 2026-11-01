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
