import {
  AcademicRecordStatus,
  PlannedCourseStatus,
} from "../../../generated/prisma/client.js";
import AppErr from "../../../libs/appErr.js";
import { WHAT_IF_PROMPT } from "../../../libs/prompt.js";
import * as appRepo from "../../../repositories/app.repo.js";
import {
  whatIfIntentSchema,
  type WhatIfBody,
  type WhatIfIntent,
} from "../../../schemas/app.schema.js";
import type {
  ComparisonRowDto,
  PlanChangeDto,
  ScenarioResultDto,
  SemesterLoadDto,
  TermDto,
} from "../../../types/app.dto.js";
import { askAiForJson } from "../../shared/ai.js";
import { normalizeCode, sumCredits, type MajorCourse } from "../../shared/courses.js";
import { weightedGpa } from "../../shared/grades.js";
import { buildStudentProgress } from "../../shared/student-progress.js";
import {
  graduationLabel,
  groupByTerm,
  nextSemester,
  termKey,
  termLabel,
} from "../../shared/terms.js";
import {
  buildOutcome,
  type GpaEntry,
} from "./scenarios.js";
import { scheduleCourses, type PendingCourse } from "./scheduler.js";

const semestersText = (count: number) =>
  count === 1 ? "one semester" : `${count} semesters`;

const gpaOf = (entries: GpaEntry[]) => weightedGpa(entries) ?? 0;

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

  const intent: WhatIfIntent = await askAiForJson(
    WHAT_IF_PROMPT,
    {
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
    },
    whatIfIntentSchema,
    "AI returned an invalid scenario",
  );

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
  const outcome = buildOutcome({
    intent,
    course,
    other,
    status,
    statusDetail,
    plannedItem,
    plannedLabel,
    targetIndex,
    basePending,
    withoutPlanned,
    baseDone,
    doneWithout,
    baseEntries,
    currentTermCredits,
    termAt,
    statusOf,
    unclear,
  });
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
