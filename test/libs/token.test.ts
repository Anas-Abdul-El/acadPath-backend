/// <reference types="jest" />
import jwt from "jsonwebtoken";
import AppErr from "../../src/libs/appErr";
import { generateToken, verifyToken } from "../../src/libs/token";

describe("generateToken / verifyToken", () => {
  it.each(["access", "refresh", "verify"] as const)("round-trips a %s token", (type) => {
    const token = generateToken({ sub: "user-1" }, type);

    expect(verifyToken(token, type)).toMatchObject({ sub: "user-1" });
  });

  it("gives access tokens a 1 hour lifetime and refresh tokens 7 days", () => {
    const lifetime = (token: string) => {
      const { iat, exp } = jwt.decode(token) as { iat: number; exp: number };
      return exp - iat;
    };

    expect(lifetime(generateToken({}, "access"))).toBe(60 * 60);
    expect(lifetime(generateToken({}, "refresh"))).toBe(7 * 24 * 60 * 60);
  });

  it("rejects a refresh token used as an access token", () => {
    const refreshToken = generateToken({ sub: "user-1" }, "refresh");

    expect(() => verifyToken(refreshToken, "access")).toThrow(AppErr);
  });

  it("rejects a tampered token with a 401", () => {
    const token = generateToken({ sub: "user-1" }, "access");
    const [header, , signature] = token.split(".");
    const forgedPayload = Buffer.from(JSON.stringify({ sub: "admin" })).toString("base64url");

    try {
      verifyToken(`${header}.${forgedPayload}.${signature}`, "access");
      throw new Error("expected verifyToken to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(AppErr);
      expect((error as AppErr).statusCode).toBe(401);
    }
  });

  it("rejects an expired token", () => {
    const expired = jwt.sign(
      { sub: "user-1", exp: Math.floor(Date.now() / 1000) - 10 },
      process.env.ACCESS_TOKEN_SECRET!,
    );

    expect(() => verifyToken(expired, "access")).toThrow("Invalid or expired token");
  });

  it("rejects a token signed with another algorithm", () => {
    const token = jwt.sign({ sub: "user-1" }, process.env.ACCESS_TOKEN_SECRET!, { algorithm: "HS512" });

    expect(() => verifyToken(token, "access")).toThrow(AppErr);
  });

  it("rejects garbage", () => {
    expect(() => verifyToken("not-a-jwt", "access")).toThrow(AppErr);
  });
});
