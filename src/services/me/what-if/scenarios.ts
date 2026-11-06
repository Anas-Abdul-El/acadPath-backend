import type { LetterGrade } from "../../../generated/prisma/client.js";
import type { WhatIfIntent } from "../../../schemas/app.schema.js";
import type { UnclearScenarioDto } from "../../../types/app.dto.js";
import { gradeLabel, termLabel, type MajorCourse } from "../../shared/index.js";
import type { WhatIfContext } from "./context.js";
import type { PendingCourse } from "./scheduler.js";

export type GpaEntry = {
  courseId: string;
  credits: number;
  grade: LetterGrade | null;
  current: boolean;
};

export type Plan = {
  pending: PendingCourse[];
  done: Set<string>;
  entries: GpaEntry[];
  currentTermCredits: number;
};

export type Outcome = Plan & {
  summary: string;
  gpaLabel?: string | undefined;
  retakes?: string[];
  carriedOver?: string[];
  target?: PendingCourse;
  blockedSummary?: (placed: number) => string;
  assumptions?: string[];
};

type OkIntent = Extract<WhatIfIntent, { status: "ok" }>;
type Result = Outcome | UnclearScenarioDto;

const unclear = (
  message: string,
  suggestions: string[] = [],
): UnclearScenarioDto => ({ status: "unclear", message, suggestions });

const slot = (
  course: MajorCourse,
  earliest: number,
  extra?: Partial<PendingCourse>,
): PendingCourse => ({ course, earliest, priority: true, ...extra });

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

const describe = (
  w: WhatIfContext,
  intent: OkIntent,
  course: MajorCourse,
  other: MajorCourse | undefined,
) => {
  const planned = w.base.pending.find((p) => p.course.id === course.id);
  return {
    ...w,
    ...w.statusOf(course),
    intent,
    course,
    other,
    planned,
    plannedLabel: planned ? termLabel(w.termAt(planned.earliest)) : "",
    targetIndex: intent.term ? w.indexOf(intent.term) : 0,
    withoutPlanned: w.base.pending.filter((p) => p.course.id !== course.id),
  };
};

type Scenario = ReturnType<typeof describe>;

const carryOver = ({ base, course }: Scenario): Omit<Plan, "entries"> => ({
  pending: [...base.pending, slot(course, 0)],
  done: new Set([...base.done].filter((id) => id !== course.id)),
  currentTermCredits: base.currentTermCredits - course.credits,
});

const fail = (s: Scenario): Result => {
  const { course, status, statusDetail, planned, base } = s;
  if (status === "IN_PROGRESS")
    return {
      ...carryOver(s),
      entries: withGrade(base.entries, course, "F"),
      summary: `An F in ${course.code} counts toward your GPA this term, and you'd have to retake it. Courses that need it as a prerequisite move with it.`,
      retakes: [course.code],
      assumptions: [
        "The retake's grade isn't counted above. Under a grade-replacement policy it would replace the F.",
      ],
    };
  if (status === "PLANNED" && planned) {
    const failed = slot(course, planned.earliest, { fails: true });
    const retake = slot(course, planned.earliest + 1, { after: failed });
    return {
      ...base,
      pending: [...s.withoutPlanned, failed, retake],
      entries: withGrade(base.entries, course, "F"),
      gpaLabel: `GPA with an F in ${course.code}`,
      summary: `Failing ${course.code} in ${s.plannedLabel} means retaking it the next time it's offered. Courses that need it as a prerequisite wait for the retake.`,
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

const moveEarlier = (s: Scenario): Result => {
  const { course, planned, plannedLabel, targetIndex: index, termAt } = s;
  if (!planned)
    return unclear(`${course.code} isn't in your plan, so it can't move.`, [
      `What if I add ${course.code} next semester?`,
    ]);
  if (index >= planned.earliest)
    return unclear(
      `${course.code} is planned for ${plannedLabel}. Which earlier semester do you mean?`,
      [`What if I take ${course.code} in ${termLabel(termAt(0))}?`],
    );

  const moved = slot(course, index);
  return {
    ...s.base,
    pending: [...s.withoutPlanned, moved],
    summary: `Taking ${course.code} in ${termLabel(termAt(index))} instead of ${plannedLabel} frees up that semester, and courses that need it can start sooner.`,
    target: moved,
    blockedSummary: (placed) =>
      placed >= planned.earliest
        ? `${course.code} can't move earlier than ${plannedLabel} because of its prerequisites or offered terms.`
        : `${course.code} can't be taken in ${termLabel(termAt(index))}, but it can move up to ${termLabel(termAt(placed))} instead of ${plannedLabel}.`,
  };
};

const scenarios: Record<OkIntent["kind"], (s: Scenario) => Result> = {
  fail,

  "move-earlier": moveEarlier,

  drop: (s) => {
    const { course, status, base } = s;
    if (status === "IN_PROGRESS")
      return {
        ...carryOver(s),
        entries: base.entries.filter(
          (entry) => !(entry.courseId === course.id && entry.current),
        ),
        summary: `Withdrawing from ${course.code} leaves a W with no GPA effect, but its ${course.credits} credits move to a later semester, along with courses that need it.`,
        carriedOver: [course.code],
        assumptions: [
          "You withdraw before the deadline, so the course shows as W rather than F.",
        ],
      };
    if (status === "PLANNED")
      return {
        ...base,
        pending: s.withoutPlanned,
        summary: `Dropping ${course.code} from your plan removes its ${course.credits} credits. Courses that need it as a prerequisite can't be scheduled without it.`,
      };
    return unclear(
      `${course.code} isn't in your current semester or your plan, so there's nothing to drop.`,
    );
  },

  "grade-change": (s) => {
    const { course, status, base } = s;
    const grade = s.intent.grade;
    if (!grade)
      return unclear(`Which grade do you mean for ${course.code}?`, [
        `What if I get an A in ${course.code}?`,
      ]);
    if (grade === "F" && (status === "IN_PROGRESS" || status === "PLANNED"))
      return fail(s);
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
      entries: withGrade(base.entries, course, grade),
      gpaLabel:
        status === "IN_PROGRESS"
          ? undefined
          : `GPA with ${gradeLabel(grade)} in ${course.code}`,
      summary: `With ${gradeLabel(grade)} in ${course.code}, your GPA changes but your plan stays the same.`,
    };
  },

  retake: (s) => {
    const {
      course,
      status,
      base,
      intent: { grade },
    } = s;

    if (status !== "COMPLETED" && status !== "FAILED")
      return unclear(
        `You haven't finished ${course.code} yet, so there's nothing to retake.`,
        [`What if I fail ${course.code}?`],
      );
    if (s.planned)
      return unclear(
        `${course.code} is already in your plan for ${s.plannedLabel}.`,
      );
    return {
      ...base,
      pending: [...base.pending, slot(course, s.targetIndex)],
      entries: grade ? withGrade(base.entries, course, grade) : base.entries,
      gpaLabel: grade ? `GPA after retaking ${course.code}` : undefined,
      summary: grade
        ? `Retaking ${course.code} adds ${course.credits} credits to your plan, and ${gradeLabel(grade)} replaces your earlier grade.`
        : `Retaking ${course.code} adds ${course.credits} credits to your plan. Name a grade to see the GPA effect.`,
      retakes: [course.code],
      assumptions: grade
        ? ["Your school replaces the earlier grade with the retake's grade."]
        : [],
    };
  },

  add: (s) => {
    const { course, status } = s;
    if (status === "PLANNED" && s.intent.term) return moveEarlier(s);
    if (status === "PLANNED")
      return unclear(
        `${course.code} is already in your plan for ${s.plannedLabel}.`,
        [`What if I take ${course.code} in ${termLabel(s.termAt(0))}?`],
      );
    if (status !== "NOT_TAKEN")
      return unclear(
        `You already took ${course.code}. Did you mean retaking it?`,
        [`What if I retake ${course.code} and get an A?`],
      );
    const added = slot(course, s.targetIndex);
    return {
      ...s.base,
      pending: [...s.base.pending, added],
      summary: `Adding ${course.code} puts ${course.credits} more credits into your plan.`,
      target: added,
    };
  },

  swap: (s) => {
    const { course, other, planned } = s;
    if (!other) return unclear(`Which course should replace ${course.code}?`);
    if (!planned)
      return unclear(
        `${course.code} isn't in your plan, so it can't be swapped.`,
      );
    if (s.statusOf(other).status !== "NOT_TAKEN")
      return unclear(
        `${other.code} is already in your plan or on your record.`,
      );
    const added = slot(other, planned.earliest);
    const difference = other.credits - course.credits;
    return {
      ...s.base,
      pending: [...s.withoutPlanned, added],
      summary: `${other.code} replaces ${course.code} in ${s.plannedLabel}${difference ? `, which ${difference > 0 ? "adds" : "removes"} ${Math.abs(difference)} credits` : ""}.`,
      target: added,
    };
  },
};

export const buildOutcome = (
  w: WhatIfContext,
  intent: OkIntent,
  course: MajorCourse,
  other: MajorCourse | undefined,
) => scenarios[intent.kind](describe(w, intent, course, other));
