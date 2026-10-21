/// <reference types="jest" />
import { loginSchema, signInSchema } from "../../src/schemas/auth.schema";

const validSignIn = {
  name: "Anas",
  email: "anas@example.com",
  password: "correct-horse-battery",
  yearOfStudy: "YEAR_2",
};

describe("signInSchema", () => {
  it("accepts valid input", () => {
    expect(signInSchema.safeParse(validSignIn).success).toBe(true);
  });

  it("trims the name and normalizes the email to lowercase", () => {
    const data = signInSchema.parse({ ...validSignIn, name: "  Anas  ", email: "  Anas@Example.COM " });

    expect(data.name).toBe("Anas");
    expect(data.email).toBe("anas@example.com");
  });

  it("drops fields the client is not allowed to set, like role", () => {
    const data = signInSchema.parse({ ...validSignIn, role: "ADMIN" });

    expect(data).not.toHaveProperty("role");
  });

  it.each([
    ["an invalid email", { email: "not-an-email" }],
    ["an empty name", { name: "   " }],
    ["a password shorter than 8 characters", { password: "short" }],
    ["a password longer than 72 bytes", { password: "é".repeat(37) }], // 74 bytes in UTF-8
    ["an unknown year of study", { yearOfStudy: "YEAR_9" }],
  ])("rejects %s", (_label, override) => {
    expect(signInSchema.safeParse({ ...validSignIn, ...override }).success).toBe(false);
  });

  it.each(["name", "email", "password", "yearOfStudy"])("requires %s", (field) => {
    const input: Record<string, unknown> = { ...validSignIn };
    delete input[field];

    expect(signInSchema.safeParse(input).success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("accepts an email and password and normalizes the email", () => {
    const data = loginSchema.parse({ email: " Anas@Example.com", password: "anything" });

    expect(data).toEqual({ email: "anas@example.com", password: "anything" });
  });

  it("does not enforce sign-in password rules, so older passwords still work", () => {
    expect(loginSchema.safeParse({ email: "anas@example.com", password: "short" }).success).toBe(true);
  });

  it.each([
    ["a missing password", { email: "anas@example.com" }],
    ["an empty password", { email: "anas@example.com", password: "" }],
    ["an invalid email", { email: "nope", password: "anything" }],
  ])("rejects %s", (_label, input) => {
    expect(loginSchema.safeParse(input).success).toBe(false);
  });
});
