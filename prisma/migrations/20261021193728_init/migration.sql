-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('STUDENT', 'ADMIN');

-- CreateEnum
CREATE TYPE "YearOfStudy" AS ENUM ('NEW_STUDENT', 'YEAR_1', 'YEAR_2', 'YEAR_3', 'YEAR_4', 'YEAR_5_PLUS');

-- CreateEnum
CREATE TYPE "DegreeType" AS ENUM ('BACHELOR', 'MASTER', 'DOCTORATE', 'ASSOCIATE', 'OTHER');

-- CreateEnum
CREATE TYPE "Term" AS ENUM ('FALL', 'SPRING', 'SUMMER');

-- CreateEnum
CREATE TYPE "CourseCategory" AS ENUM ('MAJOR_REQUIREMENT', 'MAJOR_ELECTIVE', 'MATH_SCIENCE', 'GENERAL_EDUCATION');

-- CreateEnum
CREATE TYPE "CourseRelationType" AS ENUM ('PREREQUISITE', 'COREQUISITE');

-- CreateEnum
CREATE TYPE "CourseSource" AS ENUM ('CATALOG_IMPORT', 'AI_EXTRACTED', 'ADMIN');

-- CreateEnum
CREATE TYPE "LetterGrade" AS ENUM ('A', 'A_MINUS', 'B_PLUS', 'B', 'B_MINUS', 'C_PLUS', 'C', 'C_MINUS', 'D_PLUS', 'D', 'F');

-- CreateEnum
CREATE TYPE "AcademicRecordStatus" AS ENUM ('COMPLETED', 'FAILED', 'IN_PROGRESS');

-- CreateEnum
CREATE TYPE "PlannedCourseStatus" AS ENUM ('PLANNED', 'COMPLETED', 'IN_PROGRESS', 'SKIPPED');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('HTML', 'PDF', 'IMAGE');

-- CreateEnum
CREATE TYPE "ProcessingStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "StudentDocumentType" AS ENUM ('TRANSCRIPT', 'DEGREE_AUDIT', 'PORTAL_SCREENSHOT', 'OTHER');

-- CreateEnum
CREATE TYPE "ResourcePlatform" AS ENUM ('YOUTUBE', 'UDEMY', 'COURSERA');

-- CreateEnum
CREATE TYPE "ResourceDifficulty" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'STUDENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "University" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "country" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "website" TEXT,
    "catalogYear" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "University_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Major" (
    "id" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "degreeType" "DegreeType" NOT NULL DEFAULT 'BACHELOR',
    "totalRequiredCredits" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Major_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "majorId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "credits" INTEGER NOT NULL,
    "category" "CourseCategory" NOT NULL,
    "offeredTerms" "Term"[] DEFAULT ARRAY[]::"Term"[],
    "source" "CourseSource" NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoursePrerequisite" (
    "courseId" TEXT NOT NULL,
    "requiredCourseId" TEXT NOT NULL,
    "relationType" "CourseRelationType" NOT NULL DEFAULT 'PREREQUISITE',

    CONSTRAINT "CoursePrerequisite_pkey" PRIMARY KEY ("courseId","requiredCourseId","relationType")
);

-- CreateTable
CREATE TABLE "CourseMaterialSource" (
    "id" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "title" TEXT,
    "url" TEXT NOT NULL,
    "sourceType" "SourceType" NOT NULL,
    "lastFetchedAt" TIMESTAMP(3),
    "lastProcessedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseMaterialSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "universityId" TEXT,
    "majorId" TEXT,
    "yearOfStudy" "YearOfStudy",
    "onboardingCompletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicRecord" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "status" "AcademicRecordStatus" NOT NULL,
    "grade" "LetterGrade",
    "expectedGrade" "LetterGrade",
    "term" "Term" NOT NULL,
    "year" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademicRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentDocument" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "type" "StudentDocumentType" NOT NULL DEFAULT 'OTHER',
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "status" "ProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyPlan" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Study plan',
    "assumptions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyPlanSemester" (
    "id" TEXT NOT NULL,
    "studyPlanId" TEXT NOT NULL,
    "term" "Term" NOT NULL,
    "year" INTEGER NOT NULL,
    "rationale" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudyPlanSemester_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyPlanCourse" (
    "id" TEXT NOT NULL,
    "semesterId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "status" "PlannedCourseStatus" NOT NULL DEFAULT 'PLANNED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyPlanCourse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningResource" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "platform" "ResourcePlatform" NOT NULL,
    "provider" TEXT,
    "format" TEXT,
    "description" TEXT,
    "duration" TEXT,
    "difficulty" "ResourceDifficulty",
    "topics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningResource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_CourseToLearningResource" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CourseToLearningResource_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_refreshTokenHash_key" ON "Session"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "University_country_idx" ON "University"("country");

-- CreateIndex
CREATE UNIQUE INDEX "University_name_country_key" ON "University"("name", "country");

-- CreateIndex
CREATE INDEX "Major_universityId_idx" ON "Major"("universityId");

-- CreateIndex
CREATE UNIQUE INDEX "Major_universityId_name_key" ON "Major"("universityId", "name");

-- CreateIndex
CREATE INDEX "Course_majorId_category_idx" ON "Course"("majorId", "category");

-- CreateIndex
CREATE INDEX "Course_updatedById_idx" ON "Course"("updatedById");

-- CreateIndex
CREATE UNIQUE INDEX "Course_majorId_code_key" ON "Course"("majorId", "code");

-- CreateIndex
CREATE INDEX "CoursePrerequisite_requiredCourseId_idx" ON "CoursePrerequisite"("requiredCourseId");

-- CreateIndex
CREATE INDEX "CourseMaterialSource_universityId_idx" ON "CourseMaterialSource"("universityId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseMaterialSource_universityId_url_key" ON "CourseMaterialSource"("universityId", "url");

-- CreateIndex
CREATE UNIQUE INDEX "StudentProfile_userId_key" ON "StudentProfile"("userId");

-- CreateIndex
CREATE INDEX "StudentProfile_universityId_idx" ON "StudentProfile"("universityId");

-- CreateIndex
CREATE INDEX "StudentProfile_majorId_idx" ON "StudentProfile"("majorId");

-- CreateIndex
CREATE INDEX "AcademicRecord_studentId_status_idx" ON "AcademicRecord"("studentId", "status");

-- CreateIndex
CREATE INDEX "AcademicRecord_studentId_year_term_idx" ON "AcademicRecord"("studentId", "year", "term");

-- CreateIndex
CREATE INDEX "AcademicRecord_courseId_idx" ON "AcademicRecord"("courseId");

-- CreateIndex
CREATE INDEX "StudentDocument_studentId_status_idx" ON "StudentDocument"("studentId", "status");

-- CreateIndex
CREATE INDEX "StudentDocument_studentId_type_idx" ON "StudentDocument"("studentId", "type");

-- CreateIndex
CREATE INDEX "StudyPlan_studentId_idx" ON "StudyPlan"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "StudyPlanSemester_studyPlanId_year_term_key" ON "StudyPlanSemester"("studyPlanId", "year", "term");

-- CreateIndex
CREATE INDEX "StudyPlanCourse_courseId_idx" ON "StudyPlanCourse"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "StudyPlanCourse_semesterId_courseId_key" ON "StudyPlanCourse"("semesterId", "courseId");

-- CreateIndex
CREATE UNIQUE INDEX "LearningResource_url_key" ON "LearningResource"("url");

-- CreateIndex
CREATE INDEX "LearningResource_platform_idx" ON "LearningResource"("platform");

-- CreateIndex
CREATE INDEX "_CourseToLearningResource_B_index" ON "_CourseToLearningResource"("B");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Major" ADD CONSTRAINT "Major_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_majorId_fkey" FOREIGN KEY ("majorId") REFERENCES "Major"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoursePrerequisite" ADD CONSTRAINT "CoursePrerequisite_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoursePrerequisite" ADD CONSTRAINT "CoursePrerequisite_requiredCourseId_fkey" FOREIGN KEY ("requiredCourseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseMaterialSource" ADD CONSTRAINT "CourseMaterialSource_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_majorId_fkey" FOREIGN KEY ("majorId") REFERENCES "Major"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicRecord" ADD CONSTRAINT "AcademicRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicRecord" ADD CONSTRAINT "AcademicRecord_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentDocument" ADD CONSTRAINT "StudentDocument_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyPlan" ADD CONSTRAINT "StudyPlan_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyPlanSemester" ADD CONSTRAINT "StudyPlanSemester_studyPlanId_fkey" FOREIGN KEY ("studyPlanId") REFERENCES "StudyPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyPlanCourse" ADD CONSTRAINT "StudyPlanCourse_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "StudyPlanSemester"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyPlanCourse" ADD CONSTRAINT "StudyPlanCourse_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CourseToLearningResource" ADD CONSTRAINT "_CourseToLearningResource_A_fkey" FOREIGN KEY ("A") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CourseToLearningResource" ADD CONSTRAINT "_CourseToLearningResource_B_fkey" FOREIGN KEY ("B") REFERENCES "LearningResource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

