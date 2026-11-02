import { AcademicRecordStatus, CourseRelationType } from "../../../generated/prisma/client.js";
import AppErr from "../../../libs/appErr.js";
import { STUDY_PLAN_PROMPT } from "../../../libs/prompt.js";
import * as appRepo from "../../../repositories/app.repo.js";
import {
  studyPlanDataSchema,
  type GenerateStudyPlanBody,
  type StudyPlanData,
} from "../../../schemas/app.schema.js";
import type { StudyPlanDto, TermDto } from "../../../types/app.dto.js";
import {
  normalizeCode,
  requisiteCodes,
  requisiteIds,
  sumCredits,
  type MajorCourse,
} from "../../shared/courses.js";
import { askAiForJson } from "../../shared/ai.js";
import { calendarTerm, nextSemester, termKey } from "../../shared/terms.js";
import { getStudyPlan } from "./get-study-plan.service.js";

const checkPlan = (
  semesters: StudyPlanData["semesters"],
  remaining: MajorCourse[],
  takenIds: Set<string>,
  firstTerm: TermDto,
  maxCredits: number,
) => {
  const courseByCode = new Map(
    remaining.map((course) => [normalizeCode(course.code), course]),
  );
  const done = new Set(takenIds);
  const usedTerms = new Set<number>();
  const leftOut = new Set<MajorCourse>();
  const checked: Parameters<typeof appRepo.createStudyPlan>[1]["semesters"] =
    [];

  for (const semester of [...semesters].sort(
    (a, b) => termKey(a) - termKey(b),
  )) {
    const key = termKey(semester);
    if (key < termKey(firstTerm) || usedTerms.has(key)) continue;
    usedTerms.add(key);

    const picked: MajorCourse[] = [];
    let credits = 0;
    for (const code of semester.courses) {
      const course = courseByCode.get(normalizeCode(code));
      if (!course || done.has(course.id) || picked.includes(course)) continue;

      const offered =
        course.offeredTerms.length === 0 ||
        course.offeredTerms.includes(semester.term);
      const prerequisitesMet = requisiteIds(
        course,
        CourseRelationType.PREREQUISITE,
      ).every((id) => done.has(id));
      if (
        !offered ||
        !prerequisitesMet ||
        credits + course.credits > maxCredits
      ) {
        leftOut.add(course);
        continue;
      }

      picked.push(course);
      credits += course.credits;
    }

    const pickedIds = new Set(picked.map((course) => course.id));
    const kept = picked.filter((course) => {
      const met = requisiteIds(course, CourseRelationType.COREQUISITE).every(
        (id) => done.has(id) || pickedIds.has(id),
      );
      if (!met) leftOut.add(course);
      return met;
    });
    if (kept.length === 0) continue;

    for (const course of kept) {
      done.add(course.id);
      leftOut.delete(course);
    }
    checked.push({
      term: semester.term,
      year: semester.year,
      rationale: semester.rationale,
      courseIds: kept.map((course) => course.id),
    });
  }

  const leftOutCodes = [...leftOut]
    .filter((course) => !done.has(course.id))
    .map((course) => course.code);

  return { semesters: checked, leftOutCodes };
};

export const generateStudyPlan = async (
  userId: string,
  { maxCreditsPerSemester }: GenerateStudyPlanBody,
): Promise<StudyPlanDto> => {
  const profile = await appRepo.getSummaryProfile(userId);
  if (!profile?.major) throw new AppErr("Select your major first", 422);

  const [courses, records] = await Promise.all([
    appRepo.listMajorCoursesWithRequisites(profile.major.id, {}),
    appRepo.listAcademicRecords(userId),
  ]);
  if (courses.length === 0)
    throw new AppErr("Your major has no courses yet", 422);

  const taken = records.filter(
    (r) =>
      r.status === AcademicRecordStatus.COMPLETED ||
      r.status === AcademicRecordStatus.IN_PROGRESS,
  );
  const takenIds = new Set(taken.map((r) => r.course.id));
  const remaining = courses.filter((course) => !takenIds.has(course.id));
  if (remaining.length === 0)
    throw new AppErr("You have no courses left to plan", 422);

  const latestTerm = [
    calendarTerm(new Date()),
    ...records.map(({ term, year }) => ({ term, year })),
  ].reduce((latest, t) => (termKey(t) > termKey(latest) ? t : latest));
  const firstTerm = nextSemester(latestTerm);

  const aiPlan = await askAiForJson(
    STUDY_PLAN_PROMPT,
    {
      universityName: profile.university?.name ?? null,
      majorName: profile.major.name,
      totalRequiredCredits: profile.major.totalRequiredCredits,
      creditsTaken: sumCredits(taken),
      maxCreditsPerSemester,
      firstTerm,
      takenCourses: taken.map((r) => r.course.code),
      remainingCourses: remaining.map((course) => ({
        code: course.code,
        name: course.name,
        credits: course.credits,
        category: course.category,
        offeredTerms: course.offeredTerms,
        prerequisites: requisiteCodes(
          course,
          CourseRelationType.PREREQUISITE,
        ),
        corequisites: requisiteCodes(course, CourseRelationType.COREQUISITE),
      })),
    },
    studyPlanDataSchema,
    "AI returned an invalid study plan",
  );

  const { semesters, leftOutCodes } = checkPlan(
    aiPlan.semesters,
    remaining,
    takenIds,
    firstTerm,
    maxCreditsPerSemester,
  );
  if (semesters.length === 0)
    throw new AppErr("AI returned an invalid study plan", 502);

  const notes = leftOutCodes.length
    ? [
        ...aiPlan.notes,
        `${leftOutCodes.join(", ")} broke a prerequisite, term or credit rule and ${leftOutCodes.length === 1 ? "was" : "were"} left out.`,
      ]
    : aiPlan.notes;

  await appRepo.createStudyPlan(profile.id, {
    assumptions: aiPlan.assumptions,
    notes,
    semesters,
  });

  const plan = await getStudyPlan(userId);
  if (!plan) throw new AppErr("Could not load the new study plan", 500);
  return plan;
};
