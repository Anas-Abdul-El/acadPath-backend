import {
  AcademicRecordStatus,
  CourseCategory,
  CourseRelationType,
  type LetterGrade,
  PlannedCourseStatus,
  type Term,
  UserRole,
} from "../generated/prisma/client.js";
import AppErr from "../libs/appErr.js";
import { aiMessage, parseAiJson } from "../libs/model.js";
import { STUDY_PLAN_PROMPT, WHAT_IF_PROMPT } from "../libs/prompt.js";
import * as appRepo from "../repositories/app.repo.js";
import {
  studyPlanDataSchema,
  whatIfIntentSchema,
  type AcademicRecordsQuery,
  type GenerateStudyPlanBody,
  type StudentCoursesQuery,
  type StudyPlanData,
  type WhatIfBody,
  type WhatIfIntent,
} from "../schemas/app.schema.js";
import type {
  AcademicRecordDto,
  AcademicSummaryDto,
  ComparisonRowDto,
  CourseDetailsDto,
  CourseDto,
  PlanChangeDto,
  ScenarioResultDto,
  SemesterLoadDto,
  StudentCourseDto,
  StudentStatusDto,
  StudyPlanDto,
  TermDto,
} from "../types/app.dto.js";

type AcademicRecord = Awaited<
  ReturnType<typeof appRepo.listAcademicRecords>
>[number];

type LatestStudyPlan = Awaited<ReturnType<typeof appRepo.getLatestStudyPlan>>;

type PlanCourse = NonNullable<
  Awaited<ReturnType<typeof appRepo.getStudyPlan>>
>["semesters"][number]["courses"][number]["course"];

type MajorCourse = Awaited<
  ReturnType<typeof appRepo.listMajorCoursesWithRequisites>
>[number];

const gradePoints: Record<LetterGrade, number> = {
  A: 4.0,
  A_MINUS: 3.7,
  B_PLUS: 3.3,
  B: 3.0,
  B_MINUS: 2.7,
  C_PLUS: 2.3,
  C: 2.0,
  C_MINUS: 1.7,
  D_PLUS: 1.3,
  D: 1.0,
  F: 0.0,
};

const termOrder: Record<Term, number> = { SPRING: 0, SUMMER: 1, FALL: 2 };

const termKey = ({ term, year }: TermDto) => year * 3 + termOrder[term];

const round2 = (value: number) => Math.round(value * 100) / 100;

const sumCredits = (items: { course: { credits: number } }[]) =>
  items.reduce((sum, item) => sum + item.course.credits, 0);

const calculateGpa = (records: AcademicRecord[]) => {
  let points = 0;
  let credits = 0;
  for (const record of records) {
    if (!record.grade) continue;
    points += gradePoints[record.grade] * record.course.credits;
    credits += record.course.credits;
  }
  return credits ? round2(points / credits) : null;
};

const groupByTerm = (records: AcademicRecord[]) => {
  const groups = new Map<number, TermDto & { records: AcademicRecord[] }>();
  for (const record of records) {
    const key = termKey(record);
    const group = groups.get(key) ?? {
      term: record.term,
      year: record.year,
      records: [],
    };
    group.records.push(record);
    groups.set(key, group);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, group]) => group);
};

export const getAcademicSummary = async (
  userId: string,
): Promise<AcademicSummaryDto> => {
  const [profile, records, plan] = await Promise.all([
    appRepo.getSummaryProfile(userId),
    appRepo.listAcademicRecords(userId),
    appRepo.getLatestStudyPlan(userId),
  ]);
  if (!profile) throw new AppErr("Select your university first", 422);

  const finished = records.filter(
    (r) => r.status !== AcademicRecordStatus.IN_PROGRESS,
  );
  const completed = records.filter(
    (r) => r.status === AcademicRecordStatus.COMPLETED,
  );
  const inProgress = records.filter(
    (r) => r.status === AcademicRecordStatus.IN_PROGRESS,
  );

  const finishedTerms = groupByTerm(finished);
  const cumulative = calculateGpa(finished);
  const gpaBeforeLastYear = calculateGpa(
    finishedTerms.slice(0, -2).flatMap((group) => group.records),
  );

  const completedCredits = sumCredits(completed);
  const required = profile.major?.totalRequiredCredits ?? null;

  const semesters = [...(plan?.semesters ?? [])].sort(
    (a, b) => termKey(a) - termKey(b),
  );
  const lastSemester = semesters.at(-1);
  const plannedCourses = semesters
    .flatMap((semester) => semester.courses)
    .filter((c) => c.status === PlannedCourseStatus.PLANNED);

  const currentTerm = groupByTerm(inProgress).at(-1);
  const lastTerm = finishedTerms.at(-1);

  return {
    student: {
      name: profile.user.name,
      university: profile.university,
      major: profile.major,
      yearOfStudy: profile.yearOfStudy,
    },
    gpa: {
      cumulative,
      changeSinceLastYear:
        cumulative !== null && gpaBeforeLastYear !== null
          ? round2(cumulative - gpaBeforeLastYear)
          : null,
    },
    credits: {
      completed: completedCredits,
      inProgress: sumCredits(inProgress),
      required,
      remaining:
        required !== null ? Math.max(required - completedCredits, 0) : null,
    },
    graduation: {
      progressPercent: required
        ? Math.min(Math.round((completedCredits / required) * 100), 100)
        : null,
      expected: lastSemester
        ? { term: lastSemester.term, year: lastSemester.year }
        : null,
    },
    currentTerm: currentTerm
      ? {
          term: currentTerm.term,
          year: currentTerm.year,
          credits: sumCredits(currentTerm.records),
          courses: currentTerm.records.map((r) => ({
            recordId: r.id,
            course: r.course,
            expectedGrade: r.expectedGrade,
          })),
        }
      : null,
    lastTerm: lastTerm
      ? {
          term: lastTerm.term,
          year: lastTerm.year,
          gpa: calculateGpa(lastTerm.records),
          courses: lastTerm.records.map((r) => ({
            course: r.course,
            status: r.status,
            grade: r.grade,
          })),
        }
      : null,
    termHistory: finishedTerms.map((group) => ({
      term: group.term,
      year: group.year,
      gpa: calculateGpa(group.records),
      credits: sumCredits(group.records),
    })),
    requirements: Object.values(CourseCategory).map((category) => {
      const inCategory = (c: { course: { category: CourseCategory } }) =>
        c.course.category === category;
      const categoryCompleted = sumCredits(completed.filter(inCategory));
      return {
        category,
        completedCredits: categoryCompleted,
        plannedCredits:
          categoryCompleted +
          sumCredits(inProgress.filter(inCategory)) +
          sumCredits(plannedCourses.filter(inCategory)),
      };
    }),
  };
};

export const listAcademicRecords = async (
  userId: string,
  filters: AcademicRecordsQuery,
): Promise<AcademicRecordDto[]> => {
  const records = await appRepo.listAcademicRecords(userId, filters);
  return records.sort((a, b) => termKey(a) - termKey(b));
};

const buildStudentProgress = (
  records: AcademicRecord[],
  plan: LatestStudyPlan,
) => {
  const recordsByCourse = new Map<string, AcademicRecord[]>();
  for (const record of [...records].sort((a, b) => termKey(b) - termKey(a))) {
    const courseRecords = recordsByCourse.get(record.course.id) ?? [];
    courseRecords.push(record);
    recordsByCourse.set(record.course.id, courseRecords);
  }

  const plannedTerms = new Map<string, TermDto>();
  const semesters = [...(plan?.semesters ?? [])].sort(
    (a, b) => termKey(a) - termKey(b),
  );
  for (const semester of semesters) {
    for (const planned of semester.courses) {
      if (planned.status !== PlannedCourseStatus.PLANNED) continue;
      if (plannedTerms.has(planned.course.id)) continue;
      plannedTerms.set(planned.course.id, {
        term: semester.term,
        year: semester.year,
      });
    }
  }

  const findRecord = (courseId: string, status: AcademicRecordStatus) =>
    recordsByCourse.get(courseId)?.find((r) => r.status === status);

  const getStudentStatus = (courseId: string): StudentStatusDto => {
    for (const status of [
      AcademicRecordStatus.COMPLETED,
      AcademicRecordStatus.IN_PROGRESS,
      AcademicRecordStatus.FAILED,
    ]) {
      const record = findRecord(courseId, status);
      if (record) {
        return {
          status,
          statusDetail: {
            grade: record.grade,
            term: record.term,
            year: record.year,
          },
        };
      }
    }

    const planned = plannedTerms.get(courseId);
    if (planned) {
      return { status: "PLANNED", statusDetail: { grade: null, ...planned } };
    }

    return {
      status: "NOT_TAKEN",
      statusDetail: { grade: null, term: null, year: null },
    };
  };

  const isCompleted = (courseId: string) =>
    !!findRecord(courseId, AcademicRecordStatus.COMPLETED);

  const isInProgress = (courseId: string) =>
    !!findRecord(courseId, AcademicRecordStatus.IN_PROGRESS);

  return { getStudentStatus, isCompleted, isInProgress };
};

export const listCourses = async (
  userId: string,
  filters: StudentCoursesQuery,
): Promise<StudentCourseDto[]> => {
  const profile = await appRepo.getStudentMajorId(userId);
  if (!profile?.majorId) throw new AppErr("Select your major first", 422);

  const [courses, records, plan] = await Promise.all([
    appRepo.listMajorCoursesWithRequisites(profile.majorId, filters),
    appRepo.listAcademicRecords(userId),
    appRepo.getLatestStudyPlan(userId),
  ]);
  const { getStudentStatus, isCompleted, isInProgress } = buildStudentProgress(
    records,
    plan,
  );

  const result: StudentCourseDto[] = courses.map(
    ({ requisites, ...course }) => ({
      ...course,
      prerequisites: requisites
        .filter((r) => r.relationType === CourseRelationType.PREREQUISITE)
        .map(({ requiredCourse }) => ({
          ...requiredCourse,
          met: isCompleted(requiredCourse.id),
        })),
      corequisites: requisites
        .filter((r) => r.relationType === CourseRelationType.COREQUISITE)
        .map(({ requiredCourse }) => ({
          ...requiredCourse,
          met:
            isCompleted(requiredCourse.id) || isInProgress(requiredCourse.id),
        })),
      ...getStudentStatus(course.id),
    }),
  );

  return filters.status
    ? result.filter((course) => course.status === filters.status)
    : result;
};

export const getCourseDetails = async (
  courseId: string,
  userId: string,
  role: UserRole,
): Promise<CourseDetailsDto> => {
  const course = await appRepo.getCourseDetails(courseId);
  if (!course) throw new AppErr("Course not found", 404);

  let studentStatus: StudentStatusDto | null = null;
  if (role === UserRole.STUDENT) {
    const [records, plan] = await Promise.all([
      appRepo.listAcademicRecords(userId),
      appRepo.getLatestStudyPlan(userId),
    ]);
    studentStatus = buildStudentProgress(records, plan).getStudentStatus(
      course.id,
    );
  }

  const { requisites, requiredFor, ...rest } = course;
  return {
    ...rest,
    prerequisites: requisites
      .filter((r) => r.relationType === CourseRelationType.PREREQUISITE)
      .map((r) => r.requiredCourse),
    corequisites: requisites
      .filter((r) => r.relationType === CourseRelationType.COREQUISITE)
      .map((r) => r.requiredCourse),
    requiredFor: requiredFor.map((r) => r.course),
    studentStatus,
  };
};

const toCourseDto = ({ requisites, ...course }: PlanCourse): CourseDto => ({
  ...course,
  prerequisites: requisites
    .filter((r) => r.relationType === CourseRelationType.PREREQUISITE)
    .map((r) => r.requiredCourse),
  corequisites: requisites
    .filter((r) => r.relationType === CourseRelationType.COREQUISITE)
    .map((r) => r.requiredCourse),
});

export const getStudyPlan = async (
  userId: string,
): Promise<StudyPlanDto | null> => {
  const [plan, records] = await Promise.all([
    appRepo.getStudyPlan(userId),
    appRepo.listAcademicRecords(userId),
  ]);
  if (!plan) return null;

  const semesters = [...plan.semesters]
    .sort((a, b) => termKey(a) - termKey(b))
    .map((semester) => ({
      id: semester.id,
      term: semester.term,
      year: semester.year,
      rationale: semester.rationale,
      credits: sumCredits(
        semester.courses.filter(
          (c) => c.status !== PlannedCourseStatus.SKIPPED,
        ),
      ),
      courses: semester.courses.map((c) => ({
        id: c.id,
        status: c.status,
        course: toCourseDto(c.course),
      })),
    }));

  const plannedCredits = sumCredits(
    plan.semesters
      .flatMap((semester) => semester.courses)
      .filter((c) => c.status === PlannedCourseStatus.PLANNED),
  );
  const takenCredits = sumCredits(
    records.filter(
      (r) =>
        r.status === AcademicRecordStatus.COMPLETED ||
        r.status === AcademicRecordStatus.IN_PROGRESS,
    ),
  );
  const required = plan.student.major?.totalRequiredCredits ?? null;
  const last = semesters.at(-1);

  return {
    id: plan.id,
    name: plan.name,
    generatedAt: plan.createdAt,
    assumptions: plan.assumptions,
    notes: plan.notes,
    semesters,
    totals: {
      plannedCredits,
      creditsRequired: required,
      meetsDegreeTotal:
        required !== null ? takenCredits + plannedCredits >= required : null,
    },
    expectedGraduation: last ? { term: last.term, year: last.year } : null,
  };
};

const normalizeCode = (code: string) => code.toUpperCase().replace(/\s+/g, "");

const calendarTerm = (date: Date): TermDto => {
  const month = date.getMonth();
  const term: Term = month < 5 ? "SPRING" : month < 7 ? "SUMMER" : "FALL";
  return { term, year: date.getFullYear() };
};

const nextSemester = ({ term, year }: TermDto): TermDto =>
  term === "FALL" ? { term: "SPRING", year: year + 1 } : { term: "FALL", year };

const requisitesOf = (course: MajorCourse, type: CourseRelationType) => {
  const corequisiteIds = new Set(
    course.requisites
      .filter((r) => r.relationType === CourseRelationType.COREQUISITE)
      .map((r) => r.requiredCourse.id),
  );
  return course.requisites
    .filter((r) => r.relationType === type)
    .filter(
      (r) =>
        type === CourseRelationType.COREQUISITE ||
        !corequisiteIds.has(r.requiredCourse.id),
    )
    .map((r) => r.requiredCourse);
};

const requisiteIds = (course: MajorCourse, type: CourseRelationType) =>
  requisitesOf(course, type).map((r) => r.id);

const requisiteCodes = (course: MajorCourse, type: CourseRelationType) =>
  requisitesOf(course, type).map((r) => r.code);

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

  let reply: string | null;
  try {
    reply = await aiMessage(
      STUDY_PLAN_PROMPT,
      JSON.stringify({
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
      }),
      { webSearch: false },
    );
  } catch (error) {
    throw new AppErr("The AI provider failed, try again later", 502, {
      cause: error,
    });
  }

  const result = studyPlanDataSchema.safeParse(parseAiJson(reply));
  if (!result.success)
    throw new AppErr("AI returned an invalid study plan", 502);

  const { semesters, leftOutCodes } = checkPlan(
    result.data.semesters,
    remaining,
    takenIds,
    firstTerm,
    maxCreditsPerSemester,
  );
  if (semesters.length === 0)
    throw new AppErr("AI returned an invalid study plan", 502);

  const notes = leftOutCodes.length
    ? [
        ...result.data.notes,
        `${leftOutCodes.join(", ")} broke a prerequisite, term or credit rule and ${leftOutCodes.length === 1 ? "was" : "were"} left out.`,
      ]
    : result.data.notes;

  await appRepo.createStudyPlan(profile.id, {
    assumptions: result.data.assumptions,
    notes,
    semesters,
  });

  const plan = await getStudyPlan(userId);
  if (!plan) throw new AppErr("Could not load the new study plan", 500);
  return plan;
};

const termLabel = ({ term, year }: TermDto) =>
  `${term.charAt(0)}${term.slice(1).toLowerCase()} ${year}`;

const graduationLabel = ({ term, year }: TermDto) =>
  `${term === "SPRING" ? "May" : term === "SUMMER" ? "August" : "December"} ${year}`;

const gradeLabel = (grade: LetterGrade) =>
  grade.replace("_MINUS", "-").replace("_PLUS", "+");

const semestersText = (count: number) =>
  count === 1 ? "one semester" : `${count} semesters`;

type GpaEntry = {
  courseId: string;
  credits: number;
  grade: LetterGrade | null;
  current: boolean;
};

const gpaOf = (entries: GpaEntry[]) => {
  let points = 0;
  let credits = 0;
  for (const entry of entries) {
    if (!entry.grade) continue;
    points += gradePoints[entry.grade] * entry.credits;
    credits += entry.credits;
  }
  return credits ? round2(points / credits) : 0;
};

const withGrade = (
  entries: GpaEntry[],
  course: MajorCourse,
  grade: LetterGrade,
): GpaEntry[] => {
  const index = entries.findLastIndex((entry) => entry.courseId === course.id);
  return index === -1
    ? [
        ...entries,
        { courseId: course.id, credits: course.credits, grade, current: false },
      ]
    : entries.map((entry, i) => (i === index ? { ...entry, grade } : entry));
};

type PendingCourse = {
  course: MajorCourse;
  earliest: number;
  priority?: boolean;
  fails?: boolean;
  after?: PendingCourse;
};

const scheduleCourses = (
  pending: PendingCourse[],
  doneIds: Set<string>,
  termAt: (index: number) => TermDto,
  maxCredits: number,
  maxSemesters: number,
) => {
  const remaining = [...pending];
  const done = new Set(doneIds);
  const placedAt = new Map<PendingCourse, number>();
  const semesters: { term: TermDto; courses: MajorCourse[] }[] = [];

  for (let index = 0; index < maxSemesters && remaining.length > 0; index++) {
    const term = termAt(index);
    const eligible = remaining
      .filter((p) => p.earliest <= index)
      .filter((p) => !p.after || (placedAt.get(p.after) ?? index) < index)
      .filter(
        (p) =>
          p.course.offeredTerms.length === 0 ||
          p.course.offeredTerms.includes(term.term),
      )
      .filter((p) =>
        requisiteIds(p.course, CourseRelationType.PREREQUISITE).every((id) =>
          done.has(id),
        ),
      )
      .sort(
        (a, b) =>
          Number(!!b.priority) - Number(!!a.priority) ||
          a.earliest - b.earliest,
      );

    const chosen: PendingCourse[] = [];
    let credits = 0;
    for (const p of eligible) {
      if (credits + p.course.credits > maxCredits) continue;
      chosen.push(p);
      credits += p.course.credits;
    }
    for (const p of chosen) {
      remaining.splice(remaining.indexOf(p), 1);
      placedAt.set(p, index);
      if (!p.fails) done.add(p.course.id);
    }
    semesters.push({ term, courses: chosen.map((p) => p.course) });
  }

  while (semesters.at(-1)?.courses.length === 0) semesters.pop();
  return {
    semesters,
    placedAt,
    unscheduled: remaining.map((p) => p.course.code),
  };
};

type Outcome = {
  pending: PendingCourse[];
  done: Set<string>;
  entries: GpaEntry[];
  currentTermCredits: number;
  summary: string;
  gpaLabel?: string | undefined;
  retakes?: string[];
  carriedOver?: string[];
  target?: { pending: PendingCourse; index: number };
  assumptions?: string[];
};

export const analyzeWhatIf = async (
  userId: string,
  { scenario }: WhatIfBody,
): Promise<ScenarioResultDto> => {
  const profile = await appRepo.getStudentMajorId(userId);
  if (!profile?.majorId) throw new AppErr("Select your major first", 422);

  const [courses, records, plan] = await Promise.all([
    appRepo.listMajorCoursesWithRequisites(profile.majorId, {}),
    appRepo.listAcademicRecords(userId),
    appRepo.getStudyPlan(userId),
  ]);
  const planSemesters = [...(plan?.semesters ?? [])].sort(
    (a, b) => termKey(a) - termKey(b),
  );
  const firstSemester = planSemesters[0];
  if (!plan || !firstSemester)
    throw new AppErr("Generate a study plan first", 422);

  const { getStudentStatus } = buildStudentProgress(records, plan);
  const courseById = new Map(courses.map((course) => [course.id, course]));
  const courseByCode = new Map(
    courses.map((course) => [normalizeCode(course.code), course]),
  );

  const termAt = (index: number) => {
    let term: TermDto = { term: firstSemester.term, year: firstSemester.year };
    for (let i = 0; i < index; i++) term = nextSemester(term);
    return term;
  };
  const indexOf = (target: TermDto) => {
    let index = 0;
    while (termKey(termAt(index)) < termKey(target) && index < 40) index++;
    return index;
  };

  const basePending: PendingCourse[] = planSemesters.flatMap((semester) =>
    semester.courses.flatMap((planned) => {
      const course = courseById.get(planned.course.id);
      return planned.status === PlannedCourseStatus.PLANNED && course
        ? [{ course, earliest: indexOf(semester) }]
        : [];
    }),
  );

  const toLoad = (term: TermDto, list: MajorCourse[]): SemesterLoadDto => ({
    label: termLabel(term),
    courses: list.map((course) => course.code),
    credits: list.reduce((sum, course) => sum + course.credits, 0),
  });
  const lastBaseIndex = Math.max(0, ...basePending.map((p) => p.earliest));
  const currentLoads = Array.from({ length: lastBaseIndex + 1 }, (_, index) =>
    toLoad(
      termAt(index),
      basePending.filter((p) => p.earliest === index).map((p) => p.course),
    ),
  );
  const maxCredits = Math.max(16, ...currentLoads.map((load) => load.credits));
  const maxSemesters = currentLoads.length + 6;

  const inProgress = records.filter(
    (r) => r.status === AcademicRecordStatus.IN_PROGRESS,
  );
  const completed = records.filter(
    (r) => r.status === AcademicRecordStatus.COMPLETED,
  );
  const currentTerm = groupByTerm(inProgress).at(-1);
  const currentLabel = currentTerm ? termLabel(currentTerm) : null;
  const baseDone = new Set(
    [...completed, ...inProgress].map((r) => r.course.id),
  );
  const baseEntries: GpaEntry[] = records.map((r) => {
    const current = r.status === AcademicRecordStatus.IN_PROGRESS;
    return {
      courseId: r.course.id,
      credits: r.course.credits,
      grade: current ? r.expectedGrade : r.grade,
      current,
    };
  });
  const completedCredits = sumCredits(completed);
  const currentTermCredits = sumCredits(inProgress);
  const statusOf = (course: MajorCourse) => getStudentStatus(course.id);

  let reply: string | null;
  try {
    reply = await aiMessage(
      WHAT_IF_PROMPT,
      JSON.stringify({
        scenario,
        currentTerm: currentLabel,
        planTerms: currentLoads.map((load) => load.label),
        courses: courses.map((course) => {
          const { status, statusDetail } = statusOf(course);
          return {
            code: course.code,
            name: course.name,
            status,
            term:
              statusDetail.term && statusDetail.year
                ? termLabel({
                    term: statusDetail.term,
                    year: statusDetail.year,
                  })
                : null,
            grade: statusDetail.grade,
          };
        }),
      }),
      { webSearch: false },
    );
  } catch (error) {
    throw new AppErr("The AI provider failed, try again later", 502, {
      cause: error,
    });
  }

  const result = whatIfIntentSchema.safeParse(parseAiJson(reply));
  if (!result.success) throw new AppErr("AI returned an invalid scenario", 502);
  const intent: WhatIfIntent = result.data;

  const firstInProgress = inProgress[0]?.course.code;
  const lastPlanned = basePending.at(-1)?.course.code;
  const firstNotTaken = courses.find(
    (course) => statusOf(course).status === "NOT_TAKEN",
  )?.code;
  const examples = [
    firstInProgress && `What if I fail ${firstInProgress} this semester?`,
    lastPlanned && `What if I take ${lastPlanned} earlier?`,
    firstNotTaken && `What if I add ${firstNotTaken} next semester?`,
  ].filter((example): example is string => !!example);
  const unclear = (
    message: string,
    suggestions: string[] = examples,
  ): ScenarioResultDto => ({ status: "unclear", message, suggestions });

  if (intent.status === "unclear")
    return unclear(
      intent.message,
      intent.suggestions.length ? intent.suggestions : examples,
    );

  const picked: MajorCourse[] = [];
  for (const code of intent.courses) {
    const found = courseByCode.get(normalizeCode(code));
    if (!found)
      return unclear(
        `I couldn't find ${code} in your major's courses. Which course do you mean?`,
      );
    picked.push(found);
  }
  const [course, other] = picked;
  if (!course) return unclear("Which course do you mean?");

  const { status, statusDetail } = statusOf(course);
  const plannedItem = basePending.find((p) => p.course.id === course.id);
  const plannedLabel = plannedItem
    ? termLabel(termAt(plannedItem.earliest))
    : "";
  const targetIndex = intent.term ? indexOf(intent.term) : 0;
  const withoutPlanned = basePending.filter((p) => p.course.id !== course.id);
  const doneWithout = new Set([...baseDone].filter((id) => id !== course.id));
  const base = {
    done: baseDone,
    entries: baseEntries,
    currentTermCredits,
  };

  const failOutcome = (): Outcome | ScenarioResultDto => {
    if (status === "IN_PROGRESS")
      return {
        pending: [...basePending, { course, earliest: 0, priority: true }],
        done: doneWithout,
        entries: withGrade(baseEntries, course, "F"),
        currentTermCredits: currentTermCredits - course.credits,
        summary: `An F in ${course.code} counts toward your GPA this term, and you'd have to retake it. Courses that need it as a prerequisite move with it.`,
        retakes: [course.code],
        assumptions: [
          "The retake's grade isn't counted above. Under a grade-replacement policy it would replace the F.",
        ],
      };
    if (status === "PLANNED" && plannedItem) {
      const failed: PendingCourse = {
        course,
        earliest: plannedItem.earliest,
        priority: true,
        fails: true,
      };
      return {
        ...base,
        pending: [
          ...withoutPlanned,
          failed,
          {
            course,
            earliest: plannedItem.earliest + 1,
            priority: true,
            after: failed,
          },
        ],
        entries: withGrade(baseEntries, course, "F"),
        gpaLabel: `GPA with an F in ${course.code}`,
        summary: `Failing ${course.code} in ${plannedLabel} means retaking it the next time it's offered. Courses that need it as a prerequisite wait for the retake.`,
        retakes: [course.code],
      };
    }
    if (status === "COMPLETED")
      return unclear(
        `You already passed ${course.code}${statusDetail.grade ? ` with ${gradeLabel(statusDetail.grade)}` : ""}. Did you mean retaking it for a better grade?`,
        [`What if I retake ${course.code} and get an A?`],
      );
    return unclear(
      `${course.code} isn't in your current semester or your plan, so there's nothing to fail.`,
      [`What if I add ${course.code} next semester?`],
    );
  };

  const moveOutcome = (index: number): Outcome | ScenarioResultDto => {
    if (!plannedItem)
      return unclear(`${course.code} isn't in your plan, so it can't move.`, [
        `What if I add ${course.code} next semester?`,
      ]);
    if (index >= plannedItem.earliest)
      return unclear(
        `${course.code} is planned for ${plannedLabel}. Which earlier semester do you mean?`,
        [`What if I take ${course.code} in ${termLabel(termAt(0))}?`],
      );
    const moved: PendingCourse = { course, earliest: index, priority: true };
    return {
      ...base,
      pending: [...withoutPlanned, moved],
      summary: `Taking ${course.code} in ${termLabel(termAt(index))} instead of ${plannedLabel} frees up that semester, and courses that need it can start sooner.`,
      target: { pending: moved, index },
    };
  };

  const outcomeFor = (): Outcome | ScenarioResultDto => {
    switch (intent.kind) {
      case "fail":
        return failOutcome();

      case "drop":
        if (status === "IN_PROGRESS")
          return {
            pending: [...basePending, { course, earliest: 0, priority: true }],
            done: doneWithout,
            entries: baseEntries.filter(
              (entry) => !(entry.courseId === course.id && entry.current),
            ),
            currentTermCredits: currentTermCredits - course.credits,
            summary: `Withdrawing from ${course.code} leaves a W with no GPA effect, but its ${course.credits} credits move to a later semester, along with courses that need it.`,
            carriedOver: [course.code],
            assumptions: [
              "You withdraw before the deadline, so the course shows as W rather than F.",
            ],
          };
        if (status === "PLANNED")
          return {
            ...base,
            pending: withoutPlanned,
            summary: `Dropping ${course.code} from your plan removes its ${course.credits} credits. Courses that need it as a prerequisite can't be scheduled without it.`,
          };
        return unclear(
          `${course.code} isn't in your current semester or your plan, so there's nothing to drop.`,
        );

      case "grade-change": {
        const grade = intent.grade;
        if (!grade)
          return unclear(`Which grade do you mean for ${course.code}?`, [
            `What if I get an A in ${course.code}?`,
          ]);
        if (grade === "F" && (status === "IN_PROGRESS" || status === "PLANNED"))
          return failOutcome();
        if (status === "NOT_TAKEN")
          return unclear(
            `You haven't taken ${course.code} and it isn't in your plan.`,
            [`What if I add ${course.code} next semester?`],
          );
        if (status === "FAILED" || grade === "F")
          return unclear(
            `To change a passed or failed course, try a retake scenario.`,
            [`What if I retake ${course.code} and get a B?`],
          );
        return {
          ...base,
          pending: basePending,
          entries: withGrade(baseEntries, course, grade),
          gpaLabel:
            status === "IN_PROGRESS"
              ? undefined
              : `GPA with ${gradeLabel(grade)} in ${course.code}`,
          summary: `With ${gradeLabel(grade)} in ${course.code}, your GPA changes but your plan stays the same.`,
        };
      }

      case "retake":
        if (status !== "COMPLETED" && status !== "FAILED")
          return unclear(
            `You haven't finished ${course.code} yet, so there's nothing to retake.`,
            [`What if I fail ${course.code}?`],
          );
        if (plannedItem)
          return unclear(
            `${course.code} is already in your plan for ${plannedLabel}.`,
          );
        return {
          ...base,
          pending: [
            ...basePending,
            { course, earliest: targetIndex, priority: true },
          ],
          entries: intent.grade
            ? withGrade(baseEntries, course, intent.grade)
            : baseEntries,
          gpaLabel: intent.grade
            ? `GPA after retaking ${course.code}`
            : undefined,
          summary: intent.grade
            ? `Retaking ${course.code} adds ${course.credits} credits to your plan, and ${gradeLabel(intent.grade)} replaces your earlier grade.`
            : `Retaking ${course.code} adds ${course.credits} credits to your plan. Name a grade to see the GPA effect.`,
          retakes: [course.code],
          assumptions: intent.grade
            ? [
                "Your school replaces the earlier grade with the retake's grade.",
              ]
            : [],
        };

      case "add": {
        if (status === "PLANNED" && intent.term)
          return moveOutcome(targetIndex);
        if (status === "PLANNED")
          return unclear(
            `${course.code} is already in your plan for ${plannedLabel}.`,
            [`What if I take ${course.code} in ${termLabel(termAt(0))}?`],
          );
        if (status !== "NOT_TAKEN")
          return unclear(
            `You already took ${course.code}. Did you mean retaking it?`,
            [`What if I retake ${course.code} and get an A?`],
          );
        const added: PendingCourse = {
          course,
          earliest: targetIndex,
          priority: true,
        };
        return {
          ...base,
          pending: [...basePending, added],
          summary: `Adding ${course.code} puts ${course.credits} more credits into your plan.`,
          target: { pending: added, index: targetIndex },
        };
      }

      case "move-earlier":
        return moveOutcome(targetIndex);

      case "swap": {
        if (!other)
          return unclear(`Which course should replace ${course.code}?`);
        if (!plannedItem)
          return unclear(
            `${course.code} isn't in your plan, so it can't be swapped.`,
          );
        if (statusOf(other).status !== "NOT_TAKEN")
          return unclear(
            `${other.code} is already in your plan or on your record.`,
          );
        const added: PendingCourse = {
          course: other,
          earliest: plannedItem.earliest,
          priority: true,
        };
        const difference = other.credits - course.credits;
        return {
          ...base,
          pending: [...withoutPlanned, added],
          summary: `${other.code} replaces ${course.code} in ${plannedLabel}${difference ? `, which ${difference > 0 ? "adds" : "removes"} ${Math.abs(difference)} credits` : ""}.`,
          target: { pending: added, index: plannedItem.earliest },
        };
      }
    }
  };

  const outcome = outcomeFor();
  if ("status" in outcome) return outcome;

  const { semesters, placedAt, unscheduled } = scheduleCourses(
    outcome.pending,
    outcome.done,
    termAt,
    maxCredits,
    maxSemesters,
  );
  const scenarioLoads = semesters.map((semester) =>
    toLoad(semester.term, semester.courses),
  );

  const currentLast = currentLoads.length - 1;
  const scenarioLast = scenarioLoads.length
    ? scenarioLoads.length - 1
    : currentLast;
  const semestersDelta = scenarioLast - currentLast;
  const graduation = {
    current: graduationLabel(termAt(currentLast)),
    scenario: graduationLabel(termAt(scenarioLast)),
    semestersDelta,
  };

  const gpaLabel =
    outcome.gpaLabel ??
    (currentLabel ? `Projected GPA after ${currentLabel}` : "Cumulative GPA");
  const gpa = {
    label: gpaLabel,
    current: gpaOf(baseEntries),
    scenario: gpaOf(outcome.entries),
  };
  const credits = {
    label: currentLabel
      ? `Credits earned by end of ${currentLabel}`
      : "Credits earned so far",
    current: completedCredits + currentTermCredits,
    scenario: completedCredits + outcome.currentTermCredits,
  };

  const placement = (loads: SemesterLoadDto[]) =>
    new Map(
      loads.flatMap((load) =>
        load.courses.map((code) => [code, load.label] as const),
      ),
    );
  const before = placement(currentLoads);
  const after = placement(scenarioLoads);
  const titleOf = (code: string) =>
    courseByCode.get(normalizeCode(code))?.name ?? code;
  const planChanges: PlanChangeDto[] = [];
  for (const [code, label] of after) {
    const title = titleOf(code);
    const previous = before.get(code);
    if (outcome.retakes?.includes(code))
      planChanges.push({ kind: "retake", code, title, to: label });
    else if (outcome.carriedOver?.includes(code))
      planChanges.push({
        kind: "moved",
        code,
        title,
        ...(currentLabel && { from: currentLabel }),
        to: label,
      });
    else if (!previous)
      planChanges.push({ kind: "added", code, title, to: label });
    else if (previous !== label)
      planChanges.push({
        kind: "moved",
        code,
        title,
        from: previous,
        to: label,
      });
  }
  for (const [code, label] of before)
    if (!after.has(code))
      planChanges.push({
        kind: "removed",
        code,
        title: titleOf(code),
        from: label,
      });

  const compare = (
    label: string,
    current: number,
    scenarioValue: number,
    higherIsBetter: boolean | null,
    format: (value: number) => string = String,
  ): ComparisonRowDto => ({
    label,
    current: format(current),
    scenario: format(scenarioValue),
    effect:
      current === scenarioValue || higherIsBetter === null
        ? "neutral"
        : scenarioValue > current === higherIsBetter
          ? "better"
          : "worse",
  });
  const totalOf = (loads: SemesterLoadDto[]) =>
    loads.reduce((sum, load) => sum + load.credits, 0);
  const comparison: ComparisonRowDto[] = [
    compare(gpa.label, gpa.current, gpa.scenario, true, (v) => v.toFixed(2)),
    compare(credits.label, credits.current, credits.scenario, true),
    compare(
      `${termLabel(termAt(0))} credit load`,
      currentLoads[0]?.credits ?? 0,
      scenarioLoads[0]?.credits ?? 0,
      null,
    ),
    compare(
      "Semesters left in your plan",
      currentLoads.length,
      scenarioLoads.length,
      false,
    ),
    compare(
      "Total degree credits",
      credits.current + totalOf(currentLoads),
      credits.scenario + totalOf(scenarioLoads),
      null,
    ),
    {
      label: "Expected graduation",
      current: graduation.current,
      scenario: graduation.scenario,
      effect:
        semestersDelta > 0
          ? "worse"
          : semestersDelta < 0
            ? "better"
            : "neutral",
    },
  ];

  const warnings: string[] = [];
  if (outcome.target) {
    const placed = placedAt.get(outcome.target.pending);
    if (placed !== undefined && placed > outcome.target.index)
      warnings.push(
        `${outcome.target.pending.course.code} can't be taken in ${termLabel(termAt(outcome.target.index))} because of its prerequisites or offered terms, so it lands in ${termLabel(termAt(placed))}.`,
      );
  }
  if (unscheduled.length)
    warnings.push(
      `${unscheduled.join(", ")} couldn't be scheduled within the next ${maxSemesters} semesters.`,
    );

  const headline =
    semestersDelta > 0
      ? `Graduation moves ${semestersText(semestersDelta)} later`
      : semestersDelta < 0
        ? `Graduation moves ${semestersText(-semestersDelta)} earlier`
        : gpa.scenario !== gpa.current
          ? `Your GPA goes ${gpa.scenario > gpa.current ? "up" : "down"} to ${gpa.scenario.toFixed(2)}`
          : "Your graduation date holds";

  return {
    status: "ok",
    kind: intent.kind,
    headline,
    summary: outcome.summary,
    gpa,
    credits,
    graduation,
    planChanges,
    semesters: { current: currentLoads, scenario: scenarioLoads },
    comparison,
    warnings,
    assumptions: [
      ...(currentLabel
        ? [
            `Your other ${currentLabel} courses finish at their expected grades.`,
          ]
        : []),
      `Courses follow the catalog's offered terms, up to ${maxCredits} credits per semester.`,
      ...(outcome.assumptions ?? []),
    ],
  };
};
