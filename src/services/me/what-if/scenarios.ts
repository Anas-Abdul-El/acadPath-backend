import type { LetterGrade } from "../../../generated/prisma/client.js";
import type { WhatIfIntent } from "../../../schemas/app.schema.js";
import type {
  ScenarioResultDto,
  StudentStatusDto,
  TermDto,
} from "../../../types/app.dto.js";
import { type MajorCourse, gradeLabel, termLabel } from "../../shared/index.js";
import type { PendingCourse } from "./scheduler.js";

export type GpaEntry = {
  courseId: string;
  credits: number;
  grade: LetterGrade | null;
  current: boolean;
};

export const withGrade = (
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

export type Outcome = {
  pending: PendingCourse[];
  done: Set<string>;
  entries: GpaEntry[];
  currentTermCredits: number;
  summary: string;
  gpaLabel?: string | undefined;
  retakes?: string[];
  carriedOver?: string[];
  target?: { pending: PendingCourse; index: number };
  blockedSummary?: (placed: number) => string;
  assumptions?: string[];
};

export type ScenarioContext = {
  intent: Extract<WhatIfIntent, { status: "ok" }>;
  course: MajorCourse;
  other: MajorCourse | undefined;
  status: StudentStatusDto["status"];
  statusDetail: StudentStatusDto["statusDetail"];
  plannedItem: PendingCourse | undefined;
  plannedLabel: string;
  targetIndex: number;
  basePending: PendingCourse[];
  withoutPlanned: PendingCourse[];
  baseDone: Set<string>;
  doneWithout: Set<string>;
  baseEntries: GpaEntry[];
  currentTermCredits: number;
  termAt: (index: number) => TermDto;
  statusOf: (course: MajorCourse) => StudentStatusDto;
  unclear: (message: string, suggestions?: string[]) => ScenarioResultDto;
};

const baseOf = (ctx: ScenarioContext) => ({
  done: ctx.baseDone,
  entries: ctx.baseEntries,
  currentTermCredits: ctx.currentTermCredits,
});

const failOutcome = (ctx: ScenarioContext): Outcome | ScenarioResultDto => {
  const {
    course,
    status,
    statusDetail,
    plannedItem,
    plannedLabel,
    basePending,
    withoutPlanned,
    doneWithout,
    baseEntries,
    currentTermCredits,
    unclear,
  } = ctx;
  const base = baseOf(ctx);
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

const moveOutcome = (
  ctx: ScenarioContext,
  index: number,
): Outcome | ScenarioResultDto => {
  const {
    course,
    plannedItem,
    plannedLabel,
    withoutPlanned,
    termAt,
    unclear,
  } = ctx;
  const base = baseOf(ctx);
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
    blockedSummary: (placed) =>
      placed >= plannedItem.earliest
        ? `${course.code} can't move earlier than ${plannedLabel} because of its prerequisites or offered terms.`
        : `${course.code} can't be taken in ${termLabel(termAt(index))}, but it can move up to ${termLabel(termAt(placed))} instead of ${plannedLabel}.`,
  };
};

export const buildOutcome = (
  ctx: ScenarioContext,
): Outcome | ScenarioResultDto => {
  const {
    intent,
    course,
    other,
    status,
    plannedItem,
    plannedLabel,
    targetIndex,
    basePending,
    withoutPlanned,
    doneWithout,
    baseEntries,
    currentTermCredits,
    termAt,
    statusOf,
    unclear,
  } = ctx;
  const base = baseOf(ctx);
  switch (intent.kind) {
    case "fail":
      return failOutcome(ctx);

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
        return failOutcome(ctx);
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
        return moveOutcome(ctx, targetIndex);
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
      return moveOutcome(ctx, targetIndex);

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
