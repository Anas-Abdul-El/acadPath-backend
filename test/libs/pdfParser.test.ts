/// <reference types="jest" />
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import parsePdf from "../../src/libs/pdfParser";

// Builds a small but real PDF in memory: one page per entry, one text line per string.
// This lets us test actual parsing without committing binary fixture files.
const makePdf = (pages: string[][]): Buffer => {
  const escape = (text: string) => text.replace(/[\\()]/g, "\\$&");
  const objects: string[] = [];

  const fontId = 3;
  const pageIds: number[] = [];
  objects[fontId] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";

  pages.forEach((lines, i) => {
    const pageId = 4 + i * 2;
    const contentId = pageId + 1;
    pageIds.push(pageId);

    const stream = [
      "BT /F1 12 Tf 72 720 Td",
      ...lines.map((line) => `(${escape(line)}) Tj 0 -20 Td`),
      "ET",
    ].join("\n");

    objects[pageId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ` +
      `/Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });

  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

  // Write objects while recording each one's byte offset for the xref table.
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (let id = 1; id < objects.length; id++) {
    offsets[id] = pdf.length;
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id++) {
    pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, "latin1");
};

describe("parsePdf with a buffer", () => {
  it("extracts the text of a PDF", async () => {
    const buffer = makePdf([["CSCI 250 Data Structures", "Credits: 3"]]);

    const text = await parsePdf({ type: "buffer", buffer });

    expect(text).toContain("CSCI 250 Data Structures");
    expect(text).toContain("Credits: 3");
  });

  it("normalizes whitespace and trims the result", async () => {
    const buffer = makePdf([["   CSCI    250  \t Data   Structures   "]]);

    const text = await parsePdf({ type: "buffer", buffer });

    expect(text).toBe("CSCI 250 Data Structures");
  });

  it("joins pages without '-- 1 of 2 --' markers", async () => {
    const buffer = makePdf([["Page one"], ["Page two"]]);

    const text = await parsePdf({ type: "buffer", buffer });

    expect(text).toContain("Page one");
    expect(text).toContain("Page two");
    expect(text).not.toMatch(/--\s*\d+ of \d+\s*--/);
  });

  it("leaves the caller's buffer intact", async () => {
    const buffer = makePdf([["Hello"]]);
    const copy = Buffer.from(buffer);

    await parsePdf({ type: "buffer", buffer });

    expect(buffer.equals(copy)).toBe(true);
  });

  it("rejects data that is not a PDF", async () => {
    const buffer = Buffer.from("this is not a pdf");

    await expect(parsePdf({ type: "buffer", buffer })).rejects.toThrow();
  });
});

describe("parsePdf with a URL", () => {
  // A throwaway local HTTP server, so the URL path is tested without the internet.
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const pdf = makePdf([["Served over HTTP"]]);

    server = createServer((req, res) => {
      if (req.url === "/courses.pdf") {
        res.writeHead(200, { "Content-Type": "application/pdf", "Content-Length": pdf.length });
        res.end(pdf);
        return;
      }
      res.writeHead(404).end();
    });

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("downloads and extracts the text of a PDF", async () => {
    const text = await parsePdf({ type: "url", url: `${baseUrl}/courses.pdf` });

    expect(text).toBe("Served over HTTP");
  });

  it("rejects when the URL returns an error status", async () => {
    await expect(parsePdf({ type: "url", url: `${baseUrl}/missing.pdf` })).rejects.toThrow();
  });

  it("rejects non-http protocols without fetching", async () => {
    await expect(parsePdf({ type: "url", url: "file:///etc/passwd" })).rejects.toThrow(
      "Unsupported protocol: file:",
    );
  });

  it("rejects an invalid URL", async () => {
    await expect(parsePdf({ type: "url", url: "not a url" })).rejects.toThrow();
  });
});
