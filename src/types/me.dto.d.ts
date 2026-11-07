import type {
  DegreeType,
  ProcessingStatus,
  SourceType,
  StudentDocumentType,
  UserRole,
  YearOfStudy,
} from "../generated/prisma/enums.js";

export type CatalogStatus = "AVAILABLE" | "PROCESSING" | "UNAVAILABLE";

export interface UserDto {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface UniversityDto {
  id: string;
  name: string;
  shortName: string | null;
  country: string;
  city: string;
  website: string | null;
  catalogYear: string | null;
}

export interface MajorDto {
  id: string;
  universityId: string;
  name: string;
  degreeType: DegreeType;
  totalRequiredCredits: number | null;
}

export interface ProfileDto {
  university: UniversityDto | null;
  major: MajorDto | null;
  yearOfStudy: YearOfStudy | null;
  onboardingCompletedAt: string | null;
}

export interface OnboardingDto {
  universitySelected: boolean;
  catalogStatus: CatalogStatus | null;
  universityDocumentsUploaded: boolean;
  yearOfStudySelected: boolean;
  transcriptRequired: boolean;
  transcriptUploaded: boolean;
  completed: boolean;
}

export interface MeData {
  user: UserDto;
  profile: ProfileDto | null;
  onboarding: OnboardingDto | null;
}

export interface MeOutput {
  data: MeData;
}
export interface CatalogDto {
  status: CatalogStatus;
  title: string | null;
  source: string | null;
  courseCount: number;
  majorCount: number;
}

export interface UniversityData {
  university: UniversityDto;
  major: MajorDto | null;
  catalog: CatalogDto;
}

export interface UniversityOutput {
  data: UniversityData;
}

export interface SelectUniversityOutput {
  data: UniversityData & { replaced: boolean };
}

export type MissingData = "UNIVERSITY_AND_MAJOR" | "MAJOR";

export interface UniversitySourceDto {
  id: string;
  title: string | null;
  sourceType: SourceType;
  status: ProcessingStatus;
  errorMessage: string | null;
  createdAt: string;
}

export interface UniversitySourcesOutput {
  data: UniversitySourceDto[];
}

export interface StudentDocumentDto {
  id: string;
  type: StudentDocumentType;
  fileName: string;
  mimeType: string;
  fileSize: number;
  status: ProcessingStatus;
  errorMessage: string | null;
  processedAt: string | null;
  createdAt: string;
}

export interface StudentDocumentsOutput {
  data: StudentDocumentDto[];
}
