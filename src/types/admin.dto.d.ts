import type { ProcessingStatus } from "../generated/prisma/enums.js";
import type { CatalogStatus } from "./me.dto.js";

export interface AdminStatsDto {
  counts: {
    students: number;
    universities: number;
    majors: number;
    courses: number;
    aiExtractedCourses: number;
  };
  registrationsByMonth: { month: string; count: number }[];
  universitiesByCatalogStatus: Record<CatalogStatus, number>;
  sourcesByStatus: Record<ProcessingStatus, number>;
}

export interface AdminStatsOutput {
  data: AdminStatsDto;
}
