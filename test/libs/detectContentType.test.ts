/// <reference types="jest" />
import detectContentType from "../../src/libs/detectContentType";

// Build a fake fetch Response with the given content-type and a spy on body.cancel().
const fakeResponse = (contentType: string | null) => {
  const cancel = jest.fn().mockResolvedValue(undefined);
  const headers = new Headers();
  if (contentType !== null) headers.set("content-type", contentType);

  return { response: { headers, body: { cancel } } as unknown as Response, cancel };
};

describe("detectContentType", () => {
  let fetchSpy: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    // Replace the global fetch so tests never hit the network.
    fetchSpy = jest.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns 'pdf' for application/pdf", async () => {
    fetchSpy.mockResolvedValue(fakeResponse("application/pdf").response);

    await expect(detectContentType("https://liu.edu.lb/catalog.pdf")).resolves.toBe("pdf");
  });

  it("returns 'html' for text/html, ignoring the charset part", async () => {
    fetchSpy.mockResolvedValue(fakeResponse("text/html; charset=utf-8").response);

    await expect(detectContentType("https://liu.edu.lb/")).resolves.toBe("html");
  });

  it("returns 'unknown' for other content types", async () => {
    fetchSpy.mockResolvedValue(fakeResponse("application/json").response);

    await expect(detectContentType("https://liu.edu.lb/api")).resolves.toBe("unknown");
  });

  it("returns 'unknown' when there is no content-type header", async () => {
    fetchSpy.mockResolvedValue(fakeResponse(null).response);

    await expect(detectContentType("https://liu.edu.lb/file")).resolves.toBe("unknown");
  });

  it("requests only the first byte and follows redirects", async () => {
    fetchSpy.mockResolvedValue(fakeResponse("text/html").response);

    await detectContentType("https://liu.edu.lb/");

    expect(fetchSpy).toHaveBeenCalledWith("https://liu.edu.lb/", {
      method: "GET",
      headers: { Range: "bytes=0-0" },
      redirect: "follow",
    });
  });

  it("cancels the response body so the download stops", async () => {
    const { response, cancel } = fakeResponse("application/pdf");
    fetchSpy.mockResolvedValue(response);

    await detectContentType("https://liu.edu.lb/catalog.pdf");

    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("propagates network errors", async () => {
    fetchSpy.mockRejectedValue(new TypeError("fetch failed"));

    await expect(detectContentType("https://liu.edu.lb/")).rejects.toThrow("fetch failed");
  });
});
