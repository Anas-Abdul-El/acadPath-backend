import * as cheerio from "cheerio";
import type { AnyNode, Element } from "domhandler";

/**
 * htmlToText turns the raw HTML of a page into a clean, readable string:
 *   - scripts, styles, hidden elements and form controls (and their values) are removed
 *   - headings, paragraphs, list items, divs… each start on a new line
 *   - each table row becomes one line, cells joined with " | "
 *   - links and images keep only their visible text (or alt text)
 *   - extra whitespace and blank lines are collapsed
 *
 * The result is what we send to the AI: far smaller than the HTML, and the
 * " | " rows keep a transcript table's columns readable.
 */
const REMOVE =
  "script, style, noscript, template, svg, canvas, head, iframe, object, embed, " +
  "input, select, textarea, button, [hidden], [aria-hidden=true], " +
  "[style*='display:none'], [style*='display: none']";

const BLOCK = new Set([
  "address", "article", "aside", "blockquote", "body", "dd", "details", "dialog", "div", "dl", "dt",
  "fieldset", "figcaption", "figure", "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6", "header",
  "hr", "html", "legend", "main", "nav", "ol", "p", "pre", "section", "summary", "ul", "caption",
]);

export const htmlToText = (html: string): string => {
  const $ = cheerio.load(html);
  $(REMOVE).remove();

  const out: string[] = [];
  const newline = (): void => void out.push("\n");
  const cellText = (el: AnyNode) => $(el).text().replace(/\s+/g, " ").trim();

  // Each row on its own line, cells joined with " | ". Rows of nested tables are skipped
  // here (they're inside a cell, so their text is already part of that cell).
  const tableToText = (table: Element) => {
    newline();
    $(table)
      .find("caption")
      .each((_, caption) => void out.push(cellText(caption), "\n"));
    $(table)
      .find("tr")
      .each((_, tr) => {
        if ($(tr).closest("table")[0] !== table) return;
        const cells = $(tr)
          .children("th, td")
          .map((_, cell) => cellText(cell))
          .get();
        if (cells.some(Boolean)) out.push(cells.join(" | "), "\n");
      });
    newline();
  };

  const walk = (node: AnyNode): void => {
    if (node.type === "text") {
      out.push(node.data.replace(/\s+/g, " "));
      return;
    }
    if (node.type === "root") {
      node.children.forEach(walk);
      return;
    }
    if (node.type !== "tag") return;

    const tag = node.name;
    if (tag === "br") return newline();
    if (tag === "img") {
      const alt = $(node).attr("alt");
      if (alt) out.push(` ${alt} `);
      return;
    }
    if (tag === "table") return tableToText(node);

    const block = BLOCK.has(tag);
    if (block) newline();
    if (tag === "li") out.push("\n- ");
    if (/^h[1-6]$/.test(tag)) newline(); // blank line before headings
    node.children.forEach(walk);
    if (block) newline();
  };

  const root = $.root()[0];
  if (root) walk(root);

  return out
    .join("")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n") // at most one blank line in a row
    .trim();
};
