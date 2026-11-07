import type {
  AcademicRecordStatus,
  CourseCategory,
  LetterGrade,
  PlannedCourseStatus,
  ResourceDifficulty,
  ResourcePlatform,
  Term,
  YearOfStudy,
} from "../generated/prisma/enums.js";
import type { MajorDto } from "./me.dto.js";

export interface UniversitySummaryDto {
  id: string;
  name: string;
  shortName: string | null;
}

export interface CourseSummaryDto {
  id: string;
  code: string;
  name: string;
  credits: number;
  category: CourseCategory;
}

export interface TermDto {
  term: Term;
  year: number;
}

export interface CurrentTermDto extends TermDto {
  credits: number;
  courses: {
    recordId: string;
    course: CourseSummaryDto;
    expectedGrade: LetterGrade | null;
  }[];
}

export interface LastTermDto extends TermDto {
  gpa: number | null;
  courses: {
    course: CourseSummaryDto;
    status: AcademicRecordStatus;
    grade: LetterGrade | null;
  }[];
}

export interface TermHistoryDto extends TermDto {
  gpa: number | null;
  credits: number;
}

export interface RequirementProgressDto {
  category: CourseCategory;
  completedCredits: number;
  plannedCredits: number;
}

export interface AcademicSummaryDto {
  student: {
    name: string;
    university: UniversitySummaryDto | null;
    major: MajorDto | null;
    yearOfStudy: YearOfStudy | null;
  };
  gpa: {
    cumulative: number | null;
    changeSinceLastYear: number | null;
  };
  credits: {
    completed: number;
    inProgress: number;
    required: number | null;
    remaining: number | null;
  };
  graduation: {
    progressPercent: number | null;
    expected: TermDto | null;
  };
  currentTerm: CurrentTermDto | null;
  lastTerm: LastTermDto | null;
  termHistory: TermHistoryDto[];
  requirements: RequirementProgressDto[];
}

export interface AcademicSummaryOutput {
  data: AcademicSummaryDto;
}

export interface AcademicRecordDto extends TermDto {
  id: string;
  course: CourseSummaryDto;
  status: AcademicRecordStatus;
  grade: LetterGrade | null;
  expectedGrade: LetterGrade | null;
}

export interface AcademicRecordsOutput {
  data: AcademicRecordDto[];
}

export type StudentCourseStatus =
  | "COMPLETED"
  | "FAILED"
  | "IN_PROGRESS"
  | "PLANNED"
  | "NOT_TAKEN";

export interface CourseRefDto {
  id: string;
  code: string;
  name: string;
}

export interface RequisiteDto extends CourseRefDto {
  met: boolean;
}

export interface StudentStatusDto {
  status: StudentCourseStatus;
  statusDetail: {
    grade: LetterGrade | null;
    term: Term | null;
    year: number | null;
  };
}

export interface StudentCourseDto extends CourseSummaryDto, StudentStatusDto {
  majorId: string;
  description: string | null;
  offeredTerms: Term[];
  prerequisites: RequisiteDto[];
  corequisites: RequisiteDto[];
}

export interface StudentCoursesOutput {
  data: StudentCourseDto[];
}

export interface CourseDto extends CourseSummaryDto {
  majorId: string;
  description: string | null;
  offeredTerms: Term[];
  prerequisites: CourseRefDto[];
  corequisites: CourseRefDto[];
}

export interface LearningResourceDto {
  id: string;
  title: string;
  url: string;
  platform: ResourcePlatform;
  provider: string | null;
  format: string | null;
  description: string | null;
  duration: string | null;
  difficulty: ResourceDifficulty | null;
  topics: string[];
  verified: boolean;
  courses: CourseRefDto[];
}

export interface CourseDetailsDto extends CourseDto {
  requiredFor: CourseRefDto[];
  resources: LearningResourceDto[];
  studentStatus: StudentStatusDto | null;
}

export interface CourseDetailsOutput {
  data: CourseDetailsDto;
}

export interface StudyPlanCourseDto {
  id: string;
  status: PlannedCourseStatus;
  course: CourseDto;
}

export interface StudyPlanSemesterDto extends TermDto {
  id: string;
  rationale: string | null;
  credits: number;
  courses: StudyPlanCourseDto[];
}

export interface StudyPlanDto {
  id: string;
  name: string;
  generatedAt: Date;
  assumptions: string[];
  notes: string[];
  semesters: StudyPlanSemesterDto[];
  totals: {
    plannedCredits: number;
    creditsRequired: number | null;
    meetsDegreeTotal: boolean | null;
  };
  expectedGraduation: TermDto | null;
}

export interface StudyPlanOutput {
  data: StudyPlanDto | null;
}

export type ScenarioKind =
  | "fail"
  | "grade-change"
  | "retake"
  | "add"
  | "move-earlier"
  | "drop"
  | "swap";

export interface SemesterLoadDto {
  label: string;
  courses: string[];
  credits: number;
}

export interface PlanChangeDto {
  kind: "added" | "removed" | "moved" | "retake";
  code: string;
  title: string;
  from?: string;
  to?: string;
}

export interface ComparisonRowDto {
  label: string;
  current: string;
  scenario: string;
  effect: "better" | "worse" | "neutral";
}

export interface ScenarioAnalysisDto {
  status: "ok";
  kind: ScenarioKind;
  headline: string;
  summary: string;
  gpa: { label: string; current: number | null; scenario: number | null };
  credits: { label: string; current: number; scenario: number };
  graduation: { current: string; scenario: string; semestersDelta: number };
  planChanges: PlanChangeDto[];
  semesters: { current: SemesterLoadDto[]; scenario: SemesterLoadDto[] };
  comparison: ComparisonRowDto[];
  warnings: string[];
  assumptions: string[];
}

export interface UnclearScenarioDto {
  status: "unclear";
  message: string;
  suggestions: string[];
}

export type ScenarioResultDto = ScenarioAnalysisDto | UnclearScenarioDto;

export interface WhatIfOutput {
  data: ScenarioResultDto;
}

export interface FailedFocusDto {
  course: CourseSummaryDto;
  why: string;
  attempt: TermDto & { grade: LetterGrade | null; retakenIn: TermDto | null };
  resources: LearningResourceDto[];
}

export interface DifficultFocusDto {
  course: CourseSummaryDto;
  why: string;
  expectedGrade: LetterGrade;
  resources: LearningResourceDto[];
}

export interface RecommendationsDto {
  failed: FailedFocusDto[];
  difficult: DifficultFocusDto[];
}

export interface RecommendationsOutput {
  data: RecommendationsDto;
}
