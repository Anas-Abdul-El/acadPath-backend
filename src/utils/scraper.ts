import axios from "axios";
import * as cheerio from "cheerio";

export interface ParsedLink {
  text: string;
  href: string;
}

export interface ParsedPage {
  title: string;
  headings: string[];
  links: ParsedLink[];
}

// Pure function: takes raw HTML and pulls out the pieces we care about.
// Kept separate from fetching so it can be tested without any network calls.
export function parseHtml(html: string, baseUrl?: string): ParsedPage {
  const $ = cheerio.load(html);

  const title = $("title").first().text().trim();

  const headings = $("h1, h2, h3")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter((text) => text.length > 0);

  const links: ParsedLink[] = [];
  $("a[href]").each((_, el) => {
    const rawHref = $(el).attr("href");
    if (!rawHref) return;

    // Turn relative links ("/courses") into absolute ones using the page URL.
    // Invalid hrefs (e.g. "http://") throw, so we just skip them.
    let href: string;
    try {
      href = baseUrl ? new URL(rawHref, baseUrl).toString() : rawHref;
    } catch {
      return;
    }

    links.push({ text: $(el).text().trim(), href });
  });

  return { title, headings, links };
}

export async function fetchAndParse(url: string): Promise<ParsedPage> {
  // Only allow web URLs; blocks file:, ftp:, etc.
  const { protocol } = new URL(url);
  if (protocol !== "http:" && protocol !== "https:") {
    throw new Error(`Unsupported protocol: ${protocol}`);
  }

  const response = await axios.get<string>(url, {
    timeout: 10_000,
    maxContentLength: 5 * 1024 * 1024, // 5 MB
    responseType: "text",
    headers: { "User-Agent": "AcadPathBot/1.0" },
  });

  return parseHtml(response.data, url);
}
