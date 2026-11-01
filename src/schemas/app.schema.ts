import z from "zod";
import { AcademicRecordStatus, Term } from "../generated/prisma/enums.js";

export const academicRecordsQuerySchema = z.object({
  status: z.enum(AcademicRecordStatus).optional(),
  term: z.enum(Term).optional(),
  year: z.coerce.number().int().positive().optional(),
});

export type AcademicRecordsQuery = z.infer<typeof academicRecordsQuerySchema>;
