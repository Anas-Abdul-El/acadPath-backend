import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import { authConfig } from "../config/auth.js";
import AppErr from "../libs/appErr.js";
import { generateToken, verifyToken } from "../libs/token.js";
import * as authRepository from "../repositories/auth.repository.js";
import type { UserRole } from "../generated/prisma/enums.js";
import type {
  AuthResult,
  AuthUserDto,
  LoginDto,
  NewSession,
  RefreshResult,
  SignInDto,
} from "../types/auth.types.js";

// A real bcrypt hash (cost 12) of a password nobody uses. Login compares against it when
// the email doesn't exist, so "unknown email" takes as long as "wrong password" and
// response times don't reveal which emails are registered.
const DUMMY_PASSWORD_HASH = "$2b$12$OX619Hp/e4VwRogh3rxw9eS1uYodh7Y6C3jmq8SkUntriXwTQdHLW";

// bcrypt only reads the first 72 bytes of its input, and the start of every JWT (the
// header and the beginning of the payload) is nearly the same for all tokens. The
// signature, the last part, is unique per token and 43 characters long, so we hash that.
const signatureOf = (token: string): string => token.split(".")[2] ?? "";

const signAccessToken = (user: { id: string; role: UserRole }): string =>
  generateToken({ sub: user.id, role: user.role }, "access");

// Signs a refresh JWT for a new session and prepares the Session row that backs it.
// The session id goes inside the token (`sid`), so on refresh we can load the row by
// id and then check the token against its bcrypt hash.
async function issueRefreshToken(userId: string): Promise<{ token: string; session: NewSession }> {
  const sessionId = randomUUID();
  const token = generateToken({ sub: userId, sid: sessionId }, "refresh");

  return {
    token,
    session: {
      id: sessionId,
      userId,
      refreshTokenHash: await bcrypt.hash(signatureOf(token), authConfig.bcryptSaltRounds),
      expiresAt: new Date(Date.now() + authConfig.refreshTokenTtlMs),
    },
  };
}

// Issues both tokens for a user who just signed in or logged in.
async function startSession(user: AuthUserDto): Promise<AuthResult> {
  const { token, session } = await issueRefreshToken(user.id);
  await authRepository.createSession(session);

  return { user, accessToken: signAccessToken(user), refreshToken: token };
}

export async function signIn(dto: SignInDto): Promise<AuthResult> {
  const passwordHash = await bcrypt.hash(dto.password, authConfig.bcryptSaltRounds);

  const user = await authRepository.createStudent({
    name: dto.name,
    email: dto.email,
    passwordHash,
    yearOfStudy: dto.yearOfStudy,
  });
  if (!user) throw new AppErr("Email is already registered", 409);

  return startSession(user);
}

export async function login(dto: LoginDto): Promise<AuthResult> {
  const found = await authRepository.findUserByEmail(dto.email);

  const passwordMatches = await bcrypt.compare(dto.password, found?.passwordHash ?? DUMMY_PASSWORD_HASH);
  // Same message for both cases, so attackers can't tell which emails exist.
  if (!found || !passwordMatches) throw new AppErr("Invalid email or password", 401);

  return startSession(found.user);
}

// Exchanges a valid refresh token for a new access token and a new refresh token.
// Each refresh token works once ("rotation"): the old one is revoked as the new one is issued.
export async function refresh(refreshToken: string | undefined): Promise<RefreshResult> {
  if (!refreshToken) throw new AppErr("Refresh token is missing", 401);

  const invalid = new AppErr("Invalid or expired refresh token", 401);

  // Checks the signature and expiry; throws a 401 if either is wrong.
  const payload = verifyToken(refreshToken, "refresh");
  if (typeof payload.sid !== "string") throw invalid;

  const session = await authRepository.findSessionById(payload.sid);
  if (!session) throw invalid;

  // Make sure this is the exact token issued for the session before acting on it.
  if (!(await bcrypt.compare(signatureOf(refreshToken), session.refreshTokenHash))) throw invalid;

  if (session.revokedAt) {
    // This token was already exchanged once. Either the client misbehaved or someone
    // stole it, and we can't tell which, so log the user out everywhere to be safe.
    await authRepository.revokeAllUserSessions(session.userId);
    throw invalid;
  }

  if (session.expiresAt <= new Date()) throw invalid;

  const next = await issueRefreshToken(session.userId);
  const rotated = await authRepository.rotateSession(session.id, next.session);
  if (!rotated) throw invalid;

  return {
    accessToken: signAccessToken({ id: session.userId, role: session.userRole }),
    refreshToken: next.token,
  };
}
