import { randomUUID } from "node:crypto";
import AppErr from "../../libs/appErr.js";
import { QUIZ_PROMPT } from "../../libs/prompt.js";
import * as appRepo from "../../repositories/app.repo.js";
import { quizDataSchema, type QuizBody } from "../../schemas/app.schema.js";
import type { QuizDto } from "../../types/app.dto.js";
import { askAiForJson } from "../shared/index.js";

const shuffle = <T>(items: T[]) => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j] as T, copy[i] as T];
  }
  return copy;
};

const loadMaterial = async ({ resourceId, courseId }: QuizBody) => {
  if (resourceId) {
    const resource = await appRepo.getQuizResource(resourceId);
    if (!resource) throw new AppErr("Resource not found", 404);
    const { courses, ...rest } = resource;
    return { resource: rest, courses };
  }

  const course = await appRepo.getQuizCourse(courseId as string);
  if (!course) throw new AppErr("Course not found", 404);
  return { resource: null, courses: [course] };
};

/**
 * Generates a practice quiz for POST /quizzes from a resource's or course's
 * title, description and topics. The quiz isn't stored, so it carries the
 * answers for the client to score. Options are shuffled because the AI tends
 * to put the correct one in the same place.
 */
export const generateQuiz = async (body: QuizBody): Promise<QuizDto> => {
  const material = await loadMaterial(body);

  const quiz = await askAiForJson(
    QUIZ_PROMPT,
    { count: body.count, ...material },
    quizDataSchema,
    "AI returned an invalid quiz",
  );
  if (quiz.status === "insufficient")
    throw new AppErr("Not enough material to build a quiz", 422);

  const questions = quiz.questions
    .slice(0, body.count)
    .map(({ options, answer, ...question }, i) => {
      const order = shuffle([0, 1, 2, 3]);
      return {
        id: `q${i + 1}`,
        ...question,
        options: order.map((index) => options[index] as string),
        answer: order.indexOf(answer),
      };
    });

  return { id: randomUUID(), topic: quiz.topic, questions };
};
