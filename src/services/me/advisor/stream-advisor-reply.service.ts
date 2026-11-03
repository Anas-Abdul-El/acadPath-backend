import {
  CourseRelationType,
  PlannedCourseStatus,
} from "../../../generated/prisma/client.js";
import AppErr from "../../../libs/appErr.js";
import { aiStream } from "../../../libs/model.js";
import { ADVISOR_PROMPT } from "../../../libs/prompt.js";
import * as appRepo from "../../../repositories/app.repo.js";
import type { AdvisorChatBody } from "../../../schemas/app.schema.js";
import {
  buildStudentProgress,
  gradeLabel,
  requisiteCodes,
  termKey,
  termLabel,
} from "../../shared/index.js";
import { getAcademicSummary } from "../academic/get-academic-summary.service.js";

const buildAdvisorContext = async (userId: string) => {
  const summary = await getAcademicSummary(userId);
  const major = summary.student.major;
  if (!major) throw new AppErr("Select your major first", 422);

  const [courses, records, plan] = await Promise.all([
    appRepo.listMajorCoursesWithRequisites(major.id, {}),
    appRepo.listAcademicRecords(userId),
    appRepo.getLatestStudyPlan(userId),
  ]);
  const { getStudentStatus } = buildStudentProgress(records, plan);
  const codeById = new Map(courses.map((course) => [course.id, course.code]));

  return {
    student: {
      university: summary.student.university?.name ?? null,
      major: major.name,
      degreeType: major.degreeType,
      yearOfStudy: summary.student.yearOfStudy,
    },
    gpa: summary.gpa,
    credits: summary.credits,
    currentTerm: summary.currentTerm ? termLabel(summary.currentTerm) : null,
    courses: courses.map((course) => {
      const { status, statusDetail } = getStudentStatus(course.id);
      return {
        code: course.code,
        name: course.name,
        credits: course.credits,
        category: course.category,
        offeredTerms: course.offeredTerms,
        prerequisites: requisiteCodes(course, CourseRelationType.PREREQUISITE),
        corequisites: requisiteCodes(course, CourseRelationType.COREQUISITE),
        description: course.description,
        status,
        term:
          statusDetail.term && statusDetail.year
            ? termLabel({ term: statusDetail.term, year: statusDetail.year })
            : null,
        grade: statusDetail.grade ? gradeLabel(statusDetail.grade) : null,
      };
    }),
    studyPlan: plan
      ? [...plan.semesters]
          .sort((a, b) => termKey(a) - termKey(b))
          .map((semester) => ({
            term: termLabel(semester),
            courses: semester.courses
              .filter((c) => c.status === PlannedCourseStatus.PLANNED)
              .flatMap((c) => codeById.get(c.course.id) ?? []),
          }))
      : null,
  };
};

export const streamAdvisorReply = async (
  userId: string,
  { messages }: AdvisorChatBody,
  signal: AbortSignal,
): Promise<AsyncGenerator<string>> => {
  const context = await buildAdvisorContext(userId);

  return aiStream(
    ADVISOR_PROMPT + JSON.stringify(context),
    messages.map(({ role, content }) => ({
      role: role === "student" ? "user" : "assistant",
      content,
    })),
    signal,
  );
};
