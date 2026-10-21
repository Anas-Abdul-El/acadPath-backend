// Manual check against real URLs: pnpm exec tsx scripts/try-detect-content-type.ts [url...]
import detectContentType from "../src/libs/detectContentType.js";

const urls = process.argv.slice(2);
if (urls.length === 0) {
  urls.push(
    "https://example.com",
    "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
  );
}

for (const url of urls) {
  try {
    console.log(await detectContentType(url), url);
  } catch (error) {
    console.log("error", url, (error as Error).message);
  }
}
