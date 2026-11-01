import type {
  AcademicRecordStatus,
  CourseCategory,
  LetterGrade,
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
