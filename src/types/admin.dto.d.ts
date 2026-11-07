import type {
  ProcessingStatus,
  SourceType,
} from "../generated/prisma/enums.js";
import type { CatalogStatus, MajorDto, UniversityDto } from "./me.dto.js";

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

export interface PageMetaDto {
  page: number;
  pageSize: number;
  total: number;
}

export interface AdminUniversityDto extends UniversityDto {
  createdAt: string;
  updatedAt: string;
  majorCount: number;
  courseCount: number;
  studentCount: number;
  catalogStatus: CatalogStatus;
}

export interface AdminUniversitiesOutput {
  data: AdminUniversityDto[];
  meta: PageMetaDto;
}

export interface AdminUniversityOutput {
  data: AdminUniversityDto;
}

export interface AdminMajorDto extends MajorDto {
  courseCount: number;
  studentCount: number;
}

export interface AdminUniversitySourceDto {
  id: string;
  title: string | null;
  url: string;
  sourceType: SourceType;
  status: ProcessingStatus;
  errorMessage: string | null;
  lastProcessedAt: string | null;
  createdAt: string;
}

export interface AdminUniversityDetailsDto extends AdminUniversityDto {
  majors: AdminMajorDto[];
  sources: AdminUniversitySourceDto[];
}

export interface AdminUniversityDetailsOutput {
  data: AdminUniversityDetailsDto;
}
