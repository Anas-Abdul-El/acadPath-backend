import { PDFParse } from "pdf-parse";

// Exactly one source: `type` tells TypeScript which of `url` / `buffer` exists,
// so passing both, or the wrong one for the type, is a compile error.
export type PdfSource =
  | { type: "url"; url: string }
  | { type: "buffer"; buffer: Buffer };

const normalizeText = (text: string): string => {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

const createParser = (source: PdfSource): PDFParse => {
  if (source.type === "url") {
    const parsedUrl = new URL(source.url);

    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      throw new Error(`Unsupported protocol: ${parsedUrl.protocol}`);
    }

    return new PDFParse({ url: source.url });
  }

  // pdf.js takes ownership of the array it receives, which would break the
  // caller's Buffer (and other Buffers sharing its memory). Give it a copy.
  return new PDFParse({ data: new Uint8Array(source.buffer) });
};

// Extracts the plain text of a PDF from a URL or an in-memory buffer.
const parsePdf = async (source: PdfSource): Promise<string> => {
  const parser = createParser(source);

  try {
    // Empty pageJoiner drops the "-- 1 of 3 --" markers pdf-parse adds per page.
    const result = await parser.getText({ pageJoiner: "" });

    return normalizeText(result.text);
  } finally {
    await parser.destroy();
  }
};

export default parsePdf;
