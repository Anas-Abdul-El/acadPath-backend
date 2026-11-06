import type {
  ComparisonRowDto,
  PlanChangeDto,
  ScenarioAnalysisDto,
  ScenarioKind,
  SemesterLoadDto,
} from "../../../types/app.dto.js";
import {
  graduationLabel,
  normalizeCode,
  termLabel,
  weightedGpa,
} from "../../shared/index.js";
import { toLoad, type WhatIfContext } from "./context.js";
import type { Outcome } from "./scenarios.js";
import { scheduleCourses } from "./scheduler.js";

const semestersText = (count: number) =>
  count === 1 ? "one semester" : `${count} semesters`;

const placement = (loads: SemesterLoadDto[]) =>
  new Map(
    loads.flatMap((load) =>
      load.courses.map((code) => [code, load.label] as const),
    ),
  );

const totalOf = (loads: SemesterLoadDto[]) =>
  loads.reduce((sum, load) => sum + load.credits, 0);

const listPlanChanges = (
  w: WhatIfContext,
  outcome: Outcome,
  scenarioLoads: SemesterLoadDto[],
) => {
  const before = placement(w.currentLoads);
  const after = placement(scenarioLoads);

  const titleOf = (code: string) =>
    w.courseByCode.get(normalizeCode(code))?.name ?? code;

  const changes: PlanChangeDto[] = [];
  for (const [code, to] of after) {
    const title = titleOf(code);
    const from = before.get(code);
    if (outcome.retakes?.includes(code))
      changes.push({ kind: "retake", code, title, to });
    else if (outcome.carriedOver?.includes(code))
      changes.push({
        kind: "moved",
        code,
        title,
        ...(w.currentLabel && { from: w.currentLabel }),
        to,
      });
    else if (!from) changes.push({ kind: "added", code, title, to });
    else if (from !== to)
      changes.push({ kind: "moved", code, title, from, to });
  }

  for (const [code, from] of before)
    if (!after.has(code))
      changes.push({ kind: "removed", code, title: titleOf(code), from });
  return changes;
};

const compare = (
  label: string,
  current: number | null,
  scenario: number | null,
  higherIsBetter: boolean | null,
  format: (value: number) => string = String,
): ComparisonRowDto => ({
  label,
  current: current === null ? "—" : format(current),
  scenario: scenario === null ? "—" : format(scenario),
  effect:
    current === null ||
    scenario === null ||
    current === scenario ||
    higherIsBetter === null
      ? "neutral"
      : scenario > current === higherIsBetter
        ? "better"
        : "worse",
});

export const buildResult = (
  w: WhatIfContext,
  kind: ScenarioKind,
  outcome: Outcome,
): ScenarioAnalysisDto => {
  const { termAt, currentLoads, currentLabel, maxCredits, maxSemesters } = w;
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
  const gpa = {
    label:
      outcome.gpaLabel ??
      (currentLabel ? `Projected GPA after ${currentLabel}` : "Cumulative GPA"),
    current: weightedGpa(w.base.entries),
    scenario: weightedGpa(outcome.entries),
  };
  const credits = {
    label: currentLabel
      ? `Credits earned by end of ${currentLabel}`
      : "Credits earned so far",
    current: w.completedCredits + w.base.currentTermCredits,
    scenario: w.completedCredits + outcome.currentTermCredits,
  };

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
    compare("Expected graduation", currentLast, scenarioLast, false, (i) =>
      graduationLabel(termAt(i)),
    ),
  ];

  const warnings: string[] = [];
  let summary = outcome.summary;
  const { target } = outcome;
  const placed = target && placedAt.get(target);
  if (target && placed !== undefined && placed > target.earliest) {
    warnings.push(
      `${target.course.code} can't be taken in ${termLabel(termAt(target.earliest))} because of its prerequisites or offered terms, so it lands in ${termLabel(termAt(placed))}.`,
    );
    if (outcome.blockedSummary) summary = outcome.blockedSummary(placed);
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
        : gpa.scenario === null || gpa.scenario === gpa.current
          ? "Your graduation date holds"
          : gpa.current === null
            ? `Your GPA would be ${gpa.scenario.toFixed(2)}`
            : `Your GPA goes ${gpa.scenario > gpa.current ? "up" : "down"} to ${gpa.scenario.toFixed(2)}`;

  return {
    status: "ok",
    kind,
    headline,
    summary,
    gpa,
    credits,
    graduation,
    planChanges: listPlanChanges(w, outcome, scenarioLoads),
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
