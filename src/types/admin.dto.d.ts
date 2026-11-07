import type {
  CourseSource,
  DegreeType,
  ProcessingStatus,
  SourceType,
  StudentDocumentType,
  YearOfStudy,
} from "../generated/prisma/enums.js";
import type {
  CourseDto,
  TermDto,
  UniversitySummaryDto,
} from "./app.dto.js";
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

export interface AdminMajorsOutput {
  data: AdminMajorDto[];
}

export interface AdminMajorOutput {
  data: MajorDto;
}

export interface AdminMajorRefDto {
  id: string;
  name: string;
  degreeType: DegreeType;
}

export interface AdminCourseDto extends CourseDto {
  university: UniversitySummaryDto;
  major: AdminMajorRefDto;
  source: CourseSource;
  updatedAt: string;
  updatedBy: { id: string; name: string } | null;
}

export interface AdminCoursesOutput {
  data: AdminCourseDto[];
  meta: PageMetaDto;
}

export interface AdminCourseOutput {
  data: AdminCourseDto;
}

export type StudentStage = "PROCESSED" | "UPLOADED" | "NONE";

export interface AdminStudentDto {
  id: string;
  name: string;
  email: string;
  university: UniversitySummaryDto | null;
  major: AdminMajorRefDto | null;
  yearOfStudy: YearOfStudy | null;
  registeredAt: string;
  lastActiveAt: string | null;
  stage: StudentStage;
  academic: {
    gpa: number | null;
    creditsCompleted: number;
    creditsRequired: number | null;
    expectedGraduation: TermDto | null;
  } | null;
  documents: { transcripts: number };
}

export interface AdminStudentsOutput {
  data: AdminStudentDto[];
  meta: PageMetaDto;
}

export interface AdminStudentDetailsDto extends AdminStudentDto {
  onboardingCompletedAt: string | null;
  documentsList: {
    id: string;
    type: StudentDocumentType;
    fileName: string;
    status: ProcessingStatus;
    createdAt: string;
  }[];
}

export interface AdminStudentDetailsOutput {
  data: AdminStudentDetailsDto;
}
