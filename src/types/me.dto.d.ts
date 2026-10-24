import type {
  DegreeType,
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