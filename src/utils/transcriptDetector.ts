import type { Page, Response } from "playwright";

/**
 * Transcript detector: decides whether the page open in the remote browser is the
 * student's transcript. No single keyword decides it; several independent signals
 * add up to a score:
 *
 *   signal                                             points
 *   URL says "transcript"                                +4
 *   URL says grades / academic record / marks             +2
 *   Page title says transcript                            +3
 *   A heading (not a menu link) says transcript           +3
 *   A table whose headers look like a transcript          +3
 *   3+ table rows with letter grades (A, B+…)             +2
 *   Text mentions GPA together with credits               +2
 *   2+ semesters listed (e.g. "Fall 2024")                +1
 *   A PDF named like "transcript" was received            +5
 *   A login / password form is on the page                -5
 *
 *   score >= THRESHOLD → it's a transcript
 *
 * Portal menus usually have a "Transcript" link on every page, so text inside
 * <nav>, <aside>, menus and links doesn't count as a heading.
 */
export const THRESHOLD = 5;

const LETTER_GRADE = /^(A\+?|A-|B[+-]?|C[+-]?|D[+-]?|F|P|NP|W|I|IP|TR)$/;

/** The raw facts read from one frame of the page. */
export interface FrameFeatures {
  headings: string[];
  tables: { headerCells: string[]; cells: string[][] }[];
  body: string;
  hasPasswordField: boolean;
}

export interface DetectionResult {
  onTranscript: boolean;
  loginForm: boolean;
  score: number;
  threshold: number;
  reasons: string[];
}

/**
 * Step 1: runs INSIDE the browser and reads the raw facts of one frame.
 *
 * It's a string, not a function: Playwright sends a function's source text to the
 * browser, and the TypeScript build can add helper calls to a function's body that
 * don't exist there.
 */
const EXTRACT_FEATURES = `(() => {
  const text = (el) => ((el && (el.innerText || el.textContent)) || "").trim();
  const inMenu = (el) => !!el.closest("nav, aside, header nav, [role=navigation], .menu, .sidebar, .navbar, a");

  const headings = [...document.querySelectorAll(
    "h1, h2, h3, h4, caption, legend, .page-title, .card-title, .panel-title, .title, .header-title"
  )]
    .filter((el) => !inMenu(el) && el.offsetParent !== null)
    .map(text)
    .filter(Boolean)
    .slice(0, 50);

  const tables = [...document.querySelectorAll("table, [role=table], [role=grid]")].slice(0, 30).map((t) => {
    const headerCells = [...t.querySelectorAll("th, thead td, [role=columnheader]")].map(text).slice(0, 40);
    const rows = [...t.querySelectorAll("tr, [role=row]")].slice(0, 300);
    const cells = rows.map((r) => [...r.querySelectorAll("td, [role=cell], [role=gridcell]")].map(text).slice(0, 20));
    return { headerCells, cells };
  });

  return {
    headings,
    tables,
    body: ((document.body && document.body.innerText) || "").slice(0, 100000),
    hasPasswordField: !!document.querySelector("input[type=password]"),
  };
})()`;

/** Step 2: turns the facts into a score. Pure, so it's easy to test. */
export const scoreFeatures = ({
  url = "",
  title = "",
  frames = [],
  pdf = null,
}: {
  url?: string;
  title?: string;
  frames?: FrameFeatures[];
  pdf?: string | null;
}): DetectionResult => {
  let score = 0;
  const reasons: string[] = [];
  const add = (points: number, why: string) => {
    score += points;
    reasons.push(`${points > 0 ? "+" : ""}${points} ${why}`);
  };

  if (/transcript/i.test(url)) add(4, "URL mentions transcript");
  else if (/grade|academic[-_ ]?record|marks|study[-_ ]?record/i.test(url))
    add(2, "URL mentions grades/academic record");

  if (/transcript/i.test(title)) add(3, "page title mentions transcript");

  // Portals often put content in iframes, so look at every frame.
  let heading = false;
  let gradeTable = false;
  let gradeRows = 0;
  let gpa = false;
  let semesters = 0;
  let login = false;

  for (const frame of frames) {
    if (frame.hasPasswordField) login = true;
    if (
      frame.headings.some((h) =>
        /transcript|academic record|grade report|statement of grades/i.test(h),
      )
    )
      heading = true;

    for (const table of frame.tables) {
      const headerText = table.headerCells.join(" | ").toLowerCase();
      const hits = [
        /course|subject/,
        /code/,
        /credit|cr\.?\b|hours/,
        /grade|mark/,
        /semester|term/,
        /gpa|points|quality/,
        /title|name|description/,
      ].filter((re) => re.test(headerText)).length;
      if (hits >= 3) gradeTable = true;

      const rowsWithGrade = table.cells.filter((row) =>
        row.some((cell) => LETTER_GRADE.test(cell)),
      ).length;
      gradeRows = Math.max(gradeRows, rowsWithGrade);
    }

    if (/\b(c?gpa|grade point average)\b/i.test(frame.body) && /credit/i.test(frame.body))
      gpa = true;
    const found =
      frame.body.match(/\b(fall|spring|summer|winter)\s*(semester\s*)?(19|20)\d{2}\b/gi) ?? [];
    semesters = Math.max(semesters, new Set(found.map((s) => s.toLowerCase())).size);
  }

  if (heading) add(3, "a page heading says transcript");
  if (gradeTable) add(3, "table with transcript columns (course/credits/grade…)");
  if (gradeRows >= 3) add(2, `${gradeRows} table rows contain letter grades`);
  if (gpa) add(2, "page shows GPA and credits");
  if (semesters >= 2) add(1, `${semesters} semesters listed`);
  if (pdf) add(5, `PDF received: ${pdf}`);
  if (login) add(-5, "login/password form on page");

  return {
    onTranscript: score >= THRESHOLD,
    loginForm: login,
    score,
    threshold: THRESHOLD,
    reasons,
  };
};

/** Step 3: runs the detector on a live Playwright page. */
export const detectTranscript = async (
  page: Page,
  { pdf = null }: { pdf?: string | null } = {},
): Promise<DetectionResult & { url: string; title: string }> => {
  const url = page.url();
  const title = await page.title().catch(() => "");
  const frames: FrameFeatures[] = [];
  for (const frame of page.frames()) {
    // Cross-origin or navigating frames can fail; skip them.
    const features = await frame
      .evaluate<FrameFeatures>(EXTRACT_FEATURES)
      .catch(() => null);
    if (features) frames.push(features);
  }
  return { url, title, ...scoreFeatures({ url, title, frames, pdf }) };
};

/** Is this network response a transcript PDF? Returns its file name, or null. */
export const transcriptPdfFrom = (response: Response): string | null => {
  const headers = response.headers();
  const type = headers["content-type"] ?? "";
  const disposition = headers["content-disposition"] ?? "";
  if (!/application\/pdf/i.test(type)) return null;

  const name =
    disposition.match(/filename\*?=(?:UTF-8'')?"?([^";]+)/i)?.[1] ?? response.url();
  if (!/transcript|grade|academic/i.test(name)) return null;

  const last = name.split("/").pop() ?? name;
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
};
