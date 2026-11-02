import type { LetterGrade } from "../../generated/prisma/client.js";

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

export const round2 = (value: number) => Math.round(value * 100) / 100;

export const gradeLabel = (grade: LetterGrade) =>
  grade.replace("_MINUS", "-").replace("_PLUS", "+");

export const weightedGpa = (
  items: { grade: LetterGrade | null; credits: number }[],
) => {
  let points = 0;
  let credits = 0;
  for (const item of items) {
    if (!item.grade) continue;
    points += gradePoints[item.grade] * item.credits;
    credits += item.credits;
  }
  return credits ? round2(points / credits) : null;
};
