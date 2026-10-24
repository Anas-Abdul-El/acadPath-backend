import { randomUUID } from "node:crypto";
import AppErr from "../libs/appErr.js";
import authRepo from "../repositories/index.js";
import type { LoginInput, SigninInput } from "../schemas/auth.schema.js";
import type { PublicUser } from "../types/auth.dto.js";
import { createHash, compareHash } from "../utils/hash.js";
import {
  generateToken,
  getTokenSignature,
  verifyToken,
} from "../utils/token.js";

export const signIn = async (acc: SigninInput): Promise<PublicUser> => {
  const isUserExists = await authRepo.getUserByEmail(acc.email);
  if (isUserExists) throw new AppErr("Email already exists", 400);

  let passwordHash: string;
  try {
    passwordHash = await createHash(acc.password);
  } catch {
    throw new AppErr("Failed to hash password", 500);
  }

  const user = await authRepo.createAccount({ ...acc, password: passwordHash });

  return user;
};

const dummyHash = createHash("dummy-password-for-unknown-emails");

export const login = async (acc: LoginInput): Promise<PublicUser> => {
  const user = await authRepo.getUserByEmail(acc.email);

  const passwordMatch = await compareHash(
    acc.password,
    user?.passwordHash ?? (await dummyHash),
  );
  if (!user || !passwordMatch) throw new AppErr("wrong email or password", 401);

  const { passwordHash: _, ...publicUser } = user;
  return publicUser;
};

const signTokens = (user: PublicUser, sessionId: string) => {
  // jti makes every refresh token unique, even two issued in the same second.
  const refreshToken = generateToken(
    { sub: user.id, role: user.role, sid: sessionId, jti: randomUUID() },
    "refresh",
  );
  const accessToken = generateToken(
    { sub: user.id, role: user.role },
    "access",
  );

  return { accessToken, refreshToken };
};

export const startSession = async (user: PublicUser) => {
  const sessionId = randomUUID();

  const { accessToken, refreshToken } = signTokens(user, sessionId);

  const refreshTokenHash = await createHash(getTokenSignature(refreshToken));
  await authRepo.createSession(sessionId, user.id, refreshTokenHash);

  return { accessToken, refreshToken };
};

export const logout = async (refreshToken: string) => {
  let sessionId: unknown;
  try {
    sessionId = verifyToken(refreshToken, "refresh").sid;
  } catch {
    return;
  }
  if (typeof sessionId !== "string") return;

  const session = await authRepo.getSessionById(sessionId);
  if (!session) return;

  const tokenMatch = await compareHash(
    getTokenSignature(refreshToken),
    session.refreshTokenHash,
  );
  if (tokenMatch) await authRepo.deleteSession(session.id);
};
