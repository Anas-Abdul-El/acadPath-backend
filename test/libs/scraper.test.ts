/// <reference types="jest" />
import axios from "axios";
import { fetchAndParse, parseHtml } from "../../src/libs/scraper";

// Replace the real axios with a mock so tests never hit the network.
jest.mock("axios");
const mockedAxios = jest.mocked(axios);

const sampleHtml = `
  <html>
    <head><title>  LIU Course Catalog  </title></head>
    <body>
      <h1>Computer Science</h1>
      <h2>CSCI 250 - Data Structures</h2>
      <h3></h3>
      <a href="/courses/csci250">CSCI 250</a>
      <a href="https://example.com/syllabus.pdf">Syllabus</a>
      <a>No href</a>
    </body>
  </html>
`;

describe("parseHtml", () => {
  it("extracts the title, non-empty headings, and links", () => {
    const page = parseHtml(sampleHtml);

    expect(page.title).toBe("LIU Course Catalog");
    expect(page.headings).toEqual(["Computer Science", "CSCI 250 - Data Structures"]);
    expect(page.links).toEqual([
      { text: "CSCI 250", href: "/courses/csci250" },
      { text: "Syllabus", href: "https://example.com/syllabus.pdf" },
    ]);
  });

  it("resolves relative links against the base URL", () => {
    const page = parseHtml(sampleHtml, "https://liu.edu.lb/catalog/");

    expect(page.links[0]?.href).toBe("https://liu.edu.lb/courses/csci250");
  });

  it("returns empty values for an empty page", () => {
    expect(parseHtml("")).toEqual({ title: "", headings: [], links: [] });
  });
});

describe("fetchAndParse", () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it("fetches the page with axios and parses it", async () => {
    mockedAxios.get.mockResolvedValue({ data: sampleHtml });

    const page = await fetchAndParse("https://liu.edu.lb/catalog/");

    expect(mockedAxios.get).toHaveBeenCalledWith(
      "https://liu.edu.lb/catalog/",
      expect.objectContaining({ timeout: 10_000 }),
    );
    expect(page.title).toBe("LIU Course Catalog");
    expect(page.links[0]?.href).toBe("https://liu.edu.lb/courses/csci250");
  });

  it("rejects non-http URLs without fetching", async () => {
    await expect(fetchAndParse("file:///etc/passwd")).rejects.toThrow("Unsupported protocol");
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it("propagates network errors", async () => {
    mockedAxios.get.mockRejectedValue(new Error("timeout of 10000ms exceeded"));

    await expect(fetchAndParse("https://liu.edu.lb/")).rejects.toThrow("timeout");
  });
});
