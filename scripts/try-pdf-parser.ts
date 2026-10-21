// Manual check: pnpm exec tsx scripts/try-pdf-parser.ts [url | path/to/file.pdf]
// A URL goes through the "url" source; a local path is read and sent as a "buffer".
import { readFile } from "node:fs/promises";
import parsePdf from "../src/libs/pdfParser.js";

const input =
  process.argv[2] ?? "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf";

const text = /^https?:\/\//.test(input)
  ? await parsePdf({ type: "url", url: input })
  : await parsePdf({ type: "buffer", buffer: await readFile(input) });

console.log(`${text.length} characters\n`);
console.log(text);
