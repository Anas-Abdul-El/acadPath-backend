/// <reference types="jest" />
import { z } from "zod";
import { AppErr } from "../../src/libs/appErr";

describe("AppErr", () => {
  it("stores the message and status code", () => {
    const err = new AppErr("Course not found", 404);

    expect(err.message).toBe("Course not found");
    expect(err.statusCode).toBe(404);
    expect(err.name).toBe("AppErr");
  });

  it("defaults to status 500", () => {
    expect(new AppErr("Something broke").statusCode).toBe(500);
  });

  it("is an Error, so it works with instanceof checks and has a stack", () => {
    const err = new AppErr("Bad request", 400);

    expect(err).toBeInstanceOf(AppErr);
    expect(err).toBeInstanceOf(Error);
    expect(err.stack).toContain("AppErr: Bad request");
  });

  it("keeps the original error as the cause", () => {
    const original = new Error("connection refused");
    const err = new AppErr("Failed to fetch catalog", 502, { cause: original });

    expect(err.cause).toBe(original);
  });

  it("has no details for a plain message", () => {
    expect(new AppErr("Course not found", 404).details).toBeUndefined();
  });
});

describe("AppErr from a ZodError", () => {
  const courseSchema = z.object({
    code: z.string().min(1),
    credits: z.number().int().positive(),
    prerequisites: z.array(z.object({ code: z.string() })),
  });

  // Fails three ways: empty code, negative credits, and a non-string nested prerequisite code.
  const invalidCourse = { code: "", credits: -3, prerequisites: [{ code: 250 }] };

  function zodErrorFor(input: unknown): z.ZodError {
    const result = courseSchema.safeParse(input);
    if (result.success) throw new Error("expected the input to be invalid");
    return result.error;
  }

  it("becomes a 400 'Validation failed' error", () => {
    const err = new AppErr(zodErrorFor(invalidCourse));

    expect(err).toBeInstanceOf(AppErr);
    expect(err.message).toBe("Validation failed");
    expect(err.statusCode).toBe(400);
  });

  it("lists every invalid field with a dotted path", () => {
    const err = new AppErr(zodErrorFor(invalidCourse));

    expect(err.details?.map((issue) => issue.path)).toEqual([
      "code",
      "credits",
      "prerequisites.0.code",
    ]);
    expect(err.details?.every((issue) => issue.message.length > 0)).toBe(true);
  });

  it("does not copy the submitted values into details", () => {
    const err = new AppErr(zodErrorFor({ ...invalidCourse, code: 12345 }));

    expect(JSON.stringify(err.details)).not.toContain("12345");
  });

  it("uses an empty path for a problem with the whole input", () => {
    const err = new AppErr(zodErrorFor("not an object"));

    expect(err.details).toEqual([{ path: "", message: expect.any(String) }]);
  });

  it("keeps the ZodError as the cause", () => {
    const zodErr = zodErrorFor(invalidCourse);

    expect(new AppErr(zodErr).cause).toBe(zodErr);
  });

  it("allows overriding the status code", () => {
    expect(new AppErr(zodErrorFor(invalidCourse), 422).statusCode).toBe(422);
  });
});
