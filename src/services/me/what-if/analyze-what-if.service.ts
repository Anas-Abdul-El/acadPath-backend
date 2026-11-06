import { WHAT_IF_PROMPT } from "../../../libs/prompt.js";
import {
  whatIfIntentSchema,
  type WhatIfBody,
} from "../../../schemas/app.schema.js";
import type { ScenarioResultDto } from "../../../types/app.dto.js";
import {
  askAiForJson,
  normalizeCode,
  termLabel,
  type MajorCourse,
} from "../../shared/index.js";
import { loadWhatIfContext } from "./context.js";
import { buildResult } from "./result.js";
import { buildOutcome } from "./scenarios.js";

export const analyzeWhatIf = async (
  userId: string,
  { scenario }: WhatIfBody,
): Promise<ScenarioResultDto> => {
  const w = await loadWhatIfContext(userId);

  const intent = await askAiForJson(
    WHAT_IF_PROMPT,
    {
      scenario,
      currentTerm: w.currentLabel,
      planTerms: w.currentLoads.map((load) => load.label),
      courses: w.courses.map((course) => {
        const { status, statusDetail } = w.statusOf(course);
        const { term, year, grade } = statusDetail;
        return {
          code: course.code,
          name: course.name,
          status,
          term: term && year ? termLabel({ term, year }) : null,
          grade,
        };
      }),
    },
    whatIfIntentSchema,
    "AI returned an invalid scenario",
  );

  const unclear = (
    message: string,
    suggestions: string[] = [],
  ): ScenarioResultDto => ({
    status: "unclear",
    message,
    suggestions: suggestions.length ? suggestions : w.examples,
  });

  if (intent.status === "unclear")
    return unclear(intent.message, intent.suggestions);

  const picked: MajorCourse[] = [];
  for (const code of intent.courses) {
    const found = w.courseByCode.get(normalizeCode(code));
    if (!found)
      return unclear(
        `I couldn't find ${code} in your major's courses. Which course do you mean?`,
      );
    picked.push(found);
  }
  const [course, other] = picked;
  if (!course) return unclear("Which course do you mean?");

  const outcome = buildOutcome(w, intent, course, other);
  if ("status" in outcome) return unclear(outcome.message, outcome.suggestions);
  return buildResult(w, intent.kind, outcome);
};
