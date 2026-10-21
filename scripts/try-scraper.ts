// Manual check against a real page: pnpm exec tsx scripts/try-scraper.ts [url]
import { fetchAndParse } from "../src/libs/scraper.js";

const url = process.argv[2] ?? "https://www.google.com";
const res = await fetchAndParse(url);

console.log("heading", res.headings);
console.log("links", res.links);
console.log("title", res.title);
