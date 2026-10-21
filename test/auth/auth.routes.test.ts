/// <reference types="jest" />
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import request from "supertest";
import app from "../../src/index";
import * as authRepository from "../../src/repositories/auth.repository";
import type { AuthUserDto, SessionRecord } from "../../src/types/auth.types";

// Replace every repository function with a jest.fn(), so these tests run the real
// routes, validation, controller and service without touching the database.
// The factory means the real module (and the Prisma client it imports) is never loaded.
jest.mock("../../src/repositories/auth.repository", () => ({
  createStudent: jest.fn(),
  findUserByEmail: jest.fn(),
  createSession: jest.fn(),
  findSessionById: jest.fn(),
  rotateSession: jest.fn(),
  revokeAllUserSessions: jest.fn(),
}));
const repo = jest.mocked(authRepository);

const ACCESS_SECRET = process.env.ACCESS_TOKEN_SECRET!;
const REFRESH_SECRET = process.env.REFRESH_TOKEN_SECRET!;

const user: AuthUserDto = {
  id: "user-1",
  name: "Anas",
  email: "anas@example.com",
  role: "STUDENT",
  yearOfStudy: "YEAR_2",
};

// The third part of a JWT; this is what gets bcrypt-hashed into the Session row.
const signatureOf = (token: string) => token.split(".")[2]!;

// Pulls the refresh token out of the Set-Cookie header, along with the cookie's attributes.
function getRefreshCookie(res: request.Response) {
  const header = res.headers["set-cookie"] as unknown as string[] | undefined;
  const cookie = header?.find((c) => c.startsWith("refreshToken="));
  if (!cookie) return undefined;
  const token = decodeURIComponent(cookie.split(";")[0]!.slice("refreshToken=".length));
  return { token, attributes: cookie.toLowerCase() };
}

// Checks that the Session saved in the database belongs to the refresh token in the cookie:
// the token is a valid refresh JWT pointing at that session, and the stored hash is a
// bcrypt hash of the token's signature (never the token itself).
async function expectSessionMatchesToken(
  saved: { id: string; userId: string; refreshTokenHash: string },
  token: string,
) {
  const payload = jwt.verify(token, REFRESH_SECRET) as jwt.JwtPayload;
  expect(payload).toMatchObject({ sub: saved.userId, sid: saved.id });
  expect(saved.refreshTokenHash).not.toContain(signatureOf(token));
  await expect(bcrypt.compare(signatureOf(token), saved.refreshTokenHash)).resolves.toBe(true);
}

afterEach(() => {
  jest.resetAllMocks();
});

describe("POST /api/auth/signin", () => {
  const body = {
    name: "Anas",
    email: "Anas@Example.com",
    password: "correct-horse-battery",
    yearOfStudy: "YEAR_2",
  };

  it("creates the student and returns the user, an access token and a refresh cookie", async () => {
    repo.createStudent.mockResolvedValue(user);

    const res = await request(app).post("/api/auth/signin").send(body);

    expect(res.status).toBe(201);
    expect(res.body.data.user).toEqual(user);
    expect(jwt.verify(res.body.data.accessToken, ACCESS_SECRET)).toMatchObject({
      sub: user.id,
      role: "STUDENT",
    });

    const cookie = getRefreshCookie(res);
    expect(cookie).toBeDefined();
    expect(cookie!.attributes).toContain("httponly");
    expect(cookie!.attributes).toContain("path=/api/auth");
    expect(cookie!.attributes).toContain("samesite=strict");

    const saved = repo.createSession.mock.calls[0]![0];
    expect(saved.userId).toBe(user.id);
    await expectSessionMatchesToken(saved, cookie!.token);
  });

  it("stores a bcrypt hash of the password, never the password itself", async () => {
    repo.createStudent.mockResolvedValue(user);

    await request(app).post("/api/auth/signin").send(body);

    const saved = repo.createStudent.mock.calls[0]![0];
    expect(saved).toEqual({
      name: "Anas",
      email: "anas@example.com",
      passwordHash: expect.any(String),
      yearOfStudy: "YEAR_2",
    });
    expect(saved.passwordHash).not.toBe(body.password);
    await expect(bcrypt.compare(body.password, saved.passwordHash)).resolves.toBe(true);
  });

  it("ignores a role sent by the client", async () => {
    repo.createStudent.mockResolvedValue(user);

    await request(app).post("/api/auth/signin").send({ ...body, role: "ADMIN" });

    expect(repo.createStudent.mock.calls[0]![0]).not.toHaveProperty("role");
  });

  it("returns 409 when the email is already registered", async () => {
    repo.createStudent.mockResolvedValue(null);

    const res = await request(app).post("/api/auth/signin").send(body);

    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe("Email is already registered");
    expect(repo.createSession).not.toHaveBeenCalled();
    expect(getRefreshCookie(res)).toBeUndefined();
  });

  it("returns 400 with details for invalid input and does not touch the database", async () => {
    const res = await request(app)
      .post("/api/auth/signin")
      .send({ ...body, email: "not-an-email", password: "short" });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe("Validation failed");
    expect(res.body.error.details.map((d: { path: string }) => d.path)).toEqual(["email", "password"]);
    expect(repo.createStudent).not.toHaveBeenCalled();
  });

  it("returns 400 for a malformed JSON body", async () => {
    const res = await request(app)
      .post("/api/auth/signin")
      .set("Content-Type", "application/json")
      .send('{"name": ');

    expect(res.status).toBe(400);
    expect(repo.createStudent).not.toHaveBeenCalled();
  });
});

describe("POST /api/auth/login", () => {
  const password = "correct-horse-battery";
  let passwordHash: string;

  beforeAll(async () => {
    passwordHash = await bcrypt.hash(password, 4); // low cost keeps the test fast
  });

  it("returns the user, an access token and a refresh cookie for valid credentials", async () => {
    repo.findUserByEmail.mockResolvedValue({ user, passwordHash });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "Anas@Example.com", password });

    expect(res.status).toBe(200);
    expect(repo.findUserByEmail).toHaveBeenCalledWith("anas@example.com");
    expect(res.body.data.user).toEqual(user);
    expect(JSON.stringify(res.body)).not.toContain(passwordHash);
    expect(jwt.verify(res.body.data.accessToken, ACCESS_SECRET)).toMatchObject({ sub: user.id });

    const saved = repo.createSession.mock.calls[0]![0];
    expect(saved.userId).toBe(user.id);
    await expectSessionMatchesToken(saved, getRefreshCookie(res)!.token);
  });

  it("returns 401 for a wrong password", async () => {
    repo.findUserByEmail.mockResolvedValue({ user, passwordHash });

    const res = await request(app).post("/api/auth/login").send({ email: user.email, password: "wrong-password" });

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe("Invalid email or password");
    expect(repo.createSession).not.toHaveBeenCalled();
  });

  it("returns the same 401 for an unknown email, so emails cannot be probed", async () => {
    repo.findUserByEmail.mockResolvedValue(null);

    const res = await request(app).post("/api/auth/login").send({ email: "nobody@example.com", password });

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe("Invalid email or password");
  });

  it("returns 400 for invalid input", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "nope" });

    expect(res.status).toBe(400);
    expect(repo.findUserByEmail).not.toHaveBeenCalled();
  });
});

describe("POST /api/auth/refresh", () => {
  const sessionId = "session-1";
  const oldToken = jwt.sign({ sub: user.id, sid: sessionId }, REFRESH_SECRET, { expiresIn: "7d" });
  let storedHash: string;

  beforeAll(async () => {
    storedHash = await bcrypt.hash(signatureOf(oldToken), 4);
  });

  function activeSession(overrides: Partial<SessionRecord> = {}): SessionRecord {
    return {
      id: sessionId,
      userId: user.id,
      userRole: user.role,
      refreshTokenHash: storedHash,
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      ...overrides,
    };
  }

  const sendRefresh = (token: string) =>
    request(app).post("/api/auth/refresh").set("Cookie", `refreshToken=${token}`);

  it("rotates the session and returns a new access token and refresh cookie", async () => {
    repo.findSessionById.mockResolvedValue(activeSession());
    repo.rotateSession.mockResolvedValue(true);

    const res = await sendRefresh(oldToken);

    expect(res.status).toBe(200);
    expect(repo.findSessionById).toHaveBeenCalledWith(sessionId);
    expect(jwt.verify(res.body.data.accessToken, ACCESS_SECRET)).toMatchObject({
      sub: user.id,
      role: "STUDENT",
    });

    const newToken = getRefreshCookie(res)!.token;
    expect(newToken).not.toBe(oldToken);

    const [rotatedId, newSession] = repo.rotateSession.mock.calls[0]!;
    expect(rotatedId).toBe(sessionId);
    expect(newSession.id).not.toBe(sessionId);
    expect(newSession.userId).toBe(user.id);
    await expectSessionMatchesToken(newSession, newToken);
  });

  it("returns 401 when the cookie is missing", async () => {
    const res = await request(app).post("/api/auth/refresh");

    expect(res.status).toBe(401);
    expect(repo.findSessionById).not.toHaveBeenCalled();
  });

  it("returns 401 for a token that is not a valid refresh JWT", async () => {
    const res = await sendRefresh("not-a-jwt");

    expect(res.status).toBe(401);
    expect(repo.findSessionById).not.toHaveBeenCalled();
  });

  it("returns 401 for an access token sent as a refresh token", async () => {
    const accessToken = jwt.sign({ sub: user.id, sid: sessionId }, ACCESS_SECRET);

    const res = await sendRefresh(accessToken);

    expect(res.status).toBe(401);
    expect(repo.findSessionById).not.toHaveBeenCalled();
  });

  it("returns 401 for an unknown session", async () => {
    repo.findSessionById.mockResolvedValue(null);

    const res = await sendRefresh(oldToken);

    expect(res.status).toBe(401);
    expect(repo.rotateSession).not.toHaveBeenCalled();
  });

  it("returns 401 for a validly signed token that isn't the one stored, without logging the user out", async () => {
    // Same session id, but a different token than the one whose hash is stored.
    const otherToken = jwt.sign({ sub: user.id, sid: sessionId, n: 1 }, REFRESH_SECRET);
    repo.findSessionById.mockResolvedValue(activeSession({ revokedAt: new Date() }));

    const res = await sendRefresh(otherToken);

    expect(res.status).toBe(401);
    expect(repo.revokeAllUserSessions).not.toHaveBeenCalled();
    expect(repo.rotateSession).not.toHaveBeenCalled();
  });

  it("returns 401 for an expired session", async () => {
    repo.findSessionById.mockResolvedValue(activeSession({ expiresAt: new Date(Date.now() - 1000) }));

    const res = await sendRefresh(oldToken);

    expect(res.status).toBe(401);
    expect(repo.rotateSession).not.toHaveBeenCalled();
  });

  it("revokes all of the user's sessions when an already-used token is reused", async () => {
    repo.findSessionById.mockResolvedValue(activeSession({ revokedAt: new Date() }));

    const res = await sendRefresh(oldToken);

    expect(res.status).toBe(401);
    expect(repo.revokeAllUserSessions).toHaveBeenCalledWith(user.id);
    expect(repo.rotateSession).not.toHaveBeenCalled();
  });

  it("returns 401 when another request rotated the token first", async () => {
    repo.findSessionById.mockResolvedValue(activeSession());
    repo.rotateSession.mockResolvedValue(false);

    const res = await sendRefresh(oldToken);

    expect(res.status).toBe(401);
    expect(getRefreshCookie(res)).toBeUndefined();
  });
});

describe("unknown routes", () => {
  it("return 404 in the standard error shape", async () => {
    const res = await request(app).get("/api/does-not-exist");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { message: "Route not found" } });
  });
});
