import type { Term } from "../../generated/prisma/client.js";
import type { TermDto } from "../../types/app.dto.js";

const termOrder: Record<Term, number> = { SPRING: 0, SUMMER: 1, FALL: 2 };

export const termKey = ({ term, year }: TermDto) => year * 3 + termOrder[term];

export const calendarTerm = (date: Date): TermDto => {
  const month = date.getMonth();
  const term: Term = month < 5 ? "SPRING" : month < 7 ? "SUMMER" : "FALL";
  return { term, year: date.getFullYear() };
};

export const nextSemester = ({ term, year }: TermDto): TermDto =>
  term === "FALL" ? { term: "SPRING", year: year + 1 } : { term: "FALL", year };

export const termLabel = ({ term, year }: TermDto) =>
  `${term.charAt(0)}${term.slice(1).toLowerCase()} ${year}`;

export const graduationLabel = ({ term, year }: TermDto) =>
  `${term === "SPRING" ? "May" : term === "SUMMER" ? "August" : "December"} ${year}`;

export const groupByTerm = <T extends TermDto>(records: T[]) => {
  const groups = new Map<number, TermDto & { records: T[] }>();
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
